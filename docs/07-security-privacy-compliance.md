# 07 · Security, Privacy & Compliance

| | |
|---|---|
| **Status** | v2.0 — new document; v1 covered security only as an OWASP table and a CSP snippet |
| **Audience** | Engineering lead, whoever owns compliance/finance/legal, security reviewers |
| **Not legal advice** | Regulatory items below are research notes to brief qualified counsel and a chartered accountant. Statements about Indian law are marked **[confirm]** where interpretation matters. Dates were checked against public summaries in October 2026. |
| **Related** | [02-architecture](./02-architecture.md) · [04-api-specification](./04-api-specification.md) · [08-engineering-operations](./08-engineering-operations.md) · [12-open-items](./12-open-items.md) |

---

## 1. Security posture in one page

Playlo handles three things worth attacking: **money** (court payments and venue payouts), **identity** (phone numbers, venue KYC documents) and **inventory** (court slots). The controls below exist to make the following sentences true:

1. A booking is confirmed only when the payment provider says money moved, for the right amount (05 §2.4).
2. No two live bookings overlap (database constraint, 03 §5.1).
3. A user can read or change only their own data and the venues they staff (04 §3).
4. SMS cost cannot be inflated by an attacker (§3.1).
5. Venue KYC documents are never publicly reachable (§3.4).
6. Every sensitive admin action has a reason and an audit row (03 `AuditLog`).
7. Personal data collected is the minimum needed, retained only as long as needed, and erasable (§6).

## 2. Assets and trust boundaries

| Asset | Sensitivity | Stored in | Main threats |
|---|---|---|---|
| Phone number, email, name | Personal | Postgres | Enumeration, scraping, leakage in logs |
| Venue owner KYC documents | **Sensitive** | Private R2 bucket | Public URL exposure, insider access |
| Payment records & IDs | Financial | Postgres (no card/UPI/bank data) | Tampering, replay, refund abuse |
| Session tokens | Credential | Cookie | Theft, fixation |
| Razorpay/MSG91/R2 secrets | Credential | Vercel env | Leak via logs, repo, preview deployments |
| Court inventory | Business | Postgres | Double booking, slot hoarding, scraping |
| Reliability/attendance | Reputational | Postgres | False reports, coordinated abuse |

Trust boundaries: browser ↔ Vercel; Vercel ↔ Neon/Redis/QStash/R2; Razorpay/QStash → Vercel (inbound, untrusted until verified); admin users ↔ admin console (highest privilege).

## 3. Controls

### 3.1 Authentication and OTP abuse

| Risk | Control |
|---|---|
| **SMS pumping / toll fraud** (bots trigger OTPs to numbers the attacker profits from) | India-only (`+91` allow-list) at launch; per-phone limits (1 per 30 s, 3 per 10 min), per-IP (10/hour), **global daily spend cap with alert**; a bot-resistant challenge (e.g., Cloudflare Turnstile) before the *first* OTP from a new device/IP; monitor conversion (sent vs verified) and block numbers/prefixes with abnormal ratios |
| OTP guessing | 6 digits, 5 attempts then destroy challenge, 5-minute TTL, hashed at rest (HMAC), constant-time compare, generic error messages |
| Account enumeration | `send` returns the same shape whether the number exists; timing equalised |
| **Recycled phone numbers** (Indian numbers are reassigned) | Treat phone as a login factor, not proof of lifetime identity: require OTP re-verification for high-risk actions (change payout, change phone, delete account) and re-verify numbers inactive > 12 months |
| Session theft | HttpOnly, Secure, SameSite=Lax cookies; short-lived JWT (≤ 15 min) + rotating refresh, or DB sessions (ADR-004); `sessionVersion` bump revokes all sessions; "sign out of all devices" |
| Fixation / CSRF | New session on login; `Origin` header must equal the app origin for every non-GET tRPC call (v1's `x-trpc-source` check is not a security boundary — any script can set a header on a same-origin request, but cross-site requests cannot; the **Origin check** is what matters) |
| Privileged accounts | **ADMINISTRATOR and SUPPORT_AGENT accounts require a second factor** (TOTP/passkey), not phone OTP alone; admin sessions ≤ 8 h; admin access from an allow-listed set of accounts only |
| Dev backdoors | A fixed test OTP exists only when `APP_ENV !== 'production'`, enforced by env schema and a CI check that greps for the bypass flag in production config |

### 3.2 Authorisation

- Permissions and ownership checks are in the API layer, never only in the UI (04 §2–3).
- **Resource ownership on every by-ID read/write.** Query patterns must include the owner in the `where` clause (`where: { id, userId }`), not "fetch then compare" in a separate step.
- Venue-scoped permissions resolve the venue from input and check `VenueStaff` (v1's `venueOwnerProcedure` allowed any owner to access any venue).
- Not-found and forbidden return the same response for resources the caller may not know about.
- **Automated IDOR suite:** for every procedure taking an ID, a test calls it as (a) the owner, (b) another user, (c) a user with a different venue's permissions, and asserts 403/404 for (b) and (c). This runs in CI (T-09 in 08).
- Row-level security (RLS) in Postgres is **not** used in the MVP: Prisma through a pooler makes per-request `SET LOCAL role/claims` awkward, and the permission matrix is small. Revisit when more than one team writes queries. Compensating control: a DB role for the app with no `DROP/TRUNCATE`, and a separate read-only role for analytics.

### 3.3 Application hardening

**Security headers** (set in `middleware.ts`):

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (after verifying all subdomains are HTTPS) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(self), camera=(), microphone=(), payment=(self "https://checkout.razorpay.com")` — adjust after testing Checkout |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` (Razorpay/Google popups) |
| `X-Frame-Options` / `frame-ancestors` | `DENY` / `'none'` |
| `Content-Security-Policy` | see below |

**Content Security Policy.** v1's policy contained `script-src 'self' 'unsafe-eval' 'unsafe-inline'`, which defeats the point of the "strict CSP" the same document promised, listed server-only hosts (`*.neon.tech`, `*.upstash.io`) in `connect-src` (browsers never talk to them), and used the deprecated `block-all-mixed-content`. v2:

```ts
// apps/web/middleware.ts  (excerpt)
const nonce = crypto.randomUUID().replace(/-/g, '');
const dev = process.env.NODE_ENV === 'development';

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ''}`, // eval only for dev HMR
  `style-src 'self' 'nonce-${nonce}'`,                       // see note on Tailwind/next-font inline styles
  `img-src 'self' blob: data: https://cdn.playlo.in`,
  `font-src 'self'`,
  `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://eu.i.posthog.com https://*.ingest.sentry.io`,
  `frame-src https://api.razorpay.com https://checkout.razorpay.com`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join('; ');
// Ship as Content-Security-Policy-Report-Only for the first week, fix violations, then enforce.
```

Notes: (1) The Razorpay and PostHog hostnames above must be **verified against the vendors' current documentation** during Sprint 0 — the exact required origins change over time and the research for this document could not confirm Razorpay's list from its own docs. (2) Nonces require dynamic rendering, which is fine for `/app`, `/venue`, `/admin`; **static marketing pages** cannot carry per-request nonces, so they use a policy with `script-src 'self'` plus build-time hashes (or, as a documented exception, `'unsafe-inline'` for scripts on marketing pages only — they hold no session, no payment and no user data). (3) If Tailwind/`next/font` inline styles force `'unsafe-inline'` for `style-src`, accept that for styles only; script injection is the dangerous class.

**Other controls**

| Area | Control |
|---|---|
| SQL injection | Prisma parameterisation; raw SQL only through tagged `$queryRaw`/`$executeRaw` templates (never `$queryRawUnsafe`/string concatenation); ESLint rule bans the unsafe variants |
| XSS | React escaping; **no** `dangerouslySetInnerHTML`; user-generated text (titles, bio, rules) rendered as text; length caps in Zod |
| File uploads | Pre-signed direct-to-R2 uploads with an allow-listed content type; a post-upload job verifies magic bytes and size, **re-encodes images** (strips EXIF, including GPS), and quarantines failures. KYC documents go to the **private** bucket and are served only by short-lived signed URLs |
| Open redirects | `returnTo` accepted only if it is a relative path starting with `/app` or `/venue` |
| SSRF | No server-side fetch of user-supplied URLs |
| Clickjacking | `frame-ancestors 'none'` |
| Supply chain | Lockfile committed; `pnpm audit` + Dependabot/Renovate; GitHub Actions **pinned to commit SHAs**; minimal permissions on workflow tokens; `postinstall` scripts reviewed |
| Secrets | Only in Vercel environment/secret store; separate values per environment; **preview deployments never receive production secrets or production data**; rotation calendar (quarterly, and on any suspected leak); secret scanning in CI |
| Logging | Structured, PII-free (02 §7); webhook payloads stored in `webhook_events` are access-controlled and purged after 90 days |

### 3.4 Data protection

- **In transit:** TLS everywhere (`sslmode=require` to Postgres, HTTPS only, HSTS).
- **At rest:** provider-level encryption (Neon, R2, Upstash). Column-level encryption is not planned for the MVP; sensitive documents live in a private bucket with restricted access, and **no card, UPI ID or bank account data is stored by Playlo**.
- **Minimisation:** profile location is rounded to ~1 km; analytics events carry internal IDs only; support tools mask phone/email unless the agent reveals them (audited).
- **Environment isolation:** local and preview databases contain **seed data only**. Copying production data into a lower environment is prohibited (if a bug reproduction needs it, use a scrubbed export).
- **Backups:** Neon PITR; restore drill quarterly (08 §Runbooks R5). R2 object versioning on the KYC bucket.
- **Access:** production database access via a small number of named accounts; no shared credentials; every access to KYC documents writes an audit row.

### 3.5 Trust and safety

| Topic | Policy |
|---|---|
| Reporting | Report buttons on games, profiles, venues, reviews; moderators triage in the admin console; response targets (e.g., first response ≤ 24 h) tracked |
| Blocking | Blocked users cannot see each other's games or request to join each other's games |
| Suspension | Requires reason + moderator/admin permission + notification to the user with a way to appeal; audited; time-boxed where possible. **No automatic penalties from a single event or a disputed report** (product plan §6.10) |
| Coordinated abuse | Detect clusters of reports/no-show disputes from the same accounts or devices; weight reports by reporter credibility; rate-limit reports |
| Booking abuse | Velocity limits on holds per user; repeated expire-without-pay patterns throttle further holds (graduated, not punitive) |
| Fake reviews | Reviews require a shared completed game/booking; one per author/target/game (DB-enforced); moderators can hide |
| Safety | No in-app free-form messaging at launch (reduces harassment surface); contact between players is via the host-managed game and WhatsApp the user chooses to share; phone numbers are never shown to other users by default; community guidelines and a visible safety page |
| Minors | Launch is **18+ only** (ADR-015): age self-declaration at signup, `ageConfirmedAt` stored. Supporting minors needs verifiable parental consent under the DPDP Act and a safeguarding policy — a deliberate later decision |
| Venue-side risk | Terms place responsibility for facility safety on the venue; injury/liability language to be drafted by counsel |

### 3.6 Payment security

- Razorpay Checkout is hosted/iframed by Razorpay, keeping Playlo in the lightest PCI scope (SAQ A-type); card and UPI data never touch Playlo servers.
- Amounts are computed server-side; the order is created for the booking's stored total; the webhook re-checks amount and currency (05 §2.4).
- Webhook authenticity: HMAC over the raw body, constant-time comparison, event-ID deduplication.
- Card-testing defence: per-user and per-IP limits on `createOrder`; Razorpay risk tooling enabled; alerts on failure-rate spikes.
- Refunds: initiated only by the cancellation engine or an admin with `admin:refund:issue`; dual control above a configured amount; amounts bounded by the payment under row lock.
- Reconciliation: nightly comparison of Razorpay settlements/refunds with `Payment`, `Refund`, `Transfer`; unexplained differences page the owner.
- Chargebacks/disputes: documented evidence pack (booking record, confirmation, policy accepted — `ConsentRecord`).

### 3.7 Infrastructure

| Control | Detail |
|---|---|
| Database roles | `app_rw` (DML only), `migrator` (DDL, used by CI only), `analytics_ro`. No superuser in application config |
| Network | Neon requires TLS; use IP allow-listing where the platform supports it for admin tooling; Vercel deployment protection on previews |
| Least privilege CI | Separate tokens for Neon branching, Vercel and GitHub; no production secrets in PR builds |
| Uptime/abuse | Vercel Firewall rules for obvious bad traffic; rate limits (04 §5); alert on 4xx/5xx spikes |
| Backups & DR | 02 §12 |

## 4. Threat model (top risks)

| # | Threat | Likelihood | Impact | Mitigation | Verified by |
|---|---|---|---|---|---|
| T1 | Double booking via race condition | High without constraint | High (refunds, venue trust) | Exclusion constraint + lock + idempotency | T-01, nightly integrity query |
| T2 | Forged or replayed payment webhook | Medium | Critical | HMAC (raw body), constant-time compare, event dedupe, amount check, provider re-fetch on client path | T-03, T-04 |
| T3 | Late payment after hold expiry confirms a taken slot | Medium | High | `confirmPayment` branches + constraint + auto-refund | T-02 |
| T4 | SMS pumping drains budget | **High** for any public OTP endpoint | Medium–High | Limits, India-only, bot challenge, spend cap | T-10, alert |
| T5 | IDOR across venues/bookings/games | High in CRUD-heavy apps | High | Scoped procedures, ownership in `where` | T-09 |
| T6 | Admin account takeover | Medium | Critical | 2FA, short sessions, audit, allow-list | Manual checklist |
| T7 | KYC document exposure | Low–Medium | High (regulatory) | Private bucket, signed URLs ≤ 5 min, audit access | T-11 (attempt unauthenticated read) |
| T8 | Mass scraping of players/venues | Medium | Medium | Rate limits, no phone/email in public payloads, `discoverable` flag, pagination caps | Review |
| T9 | Coordinated fake no-show reports | Medium | Medium | Host-only marking, dispute path, moderator review, credibility weighting | Process |
| T10 | Venue cancels after confirming (supply-side flakiness) | Medium | High (player trust) | Venue reliability metrics, penalties, instant full refund | Process, metric |
| T11 | Secret leak via logs/previews | Medium | Critical | Log scrubbing, env separation, secret scanning | CI |
| T12 | Dependency compromise | Medium | High | Pinning, audit, minimal deps, SHA-pinned actions | CI |
| T13 | Phone number recycling → account takeover | Low–Medium | Medium | Re-verify on risky actions | Design |
| T14 | Stored XSS in game titles/rules | Medium | Medium | Escaping, no raw HTML, CSP | Unit + E2E |
| T15 | Redis outage causing unfair rate-limit bypass | Medium | Low–Medium | Fail closed on OTP/payment policies | T-10 |

## 5. India compliance checklist

Items with long lead times are on the **critical path** — start in Week 0 (09 §1). Status and owners live in [12-open-items](./12-open-items.md).

| # | Requirement | Why it matters here | Notes / lead time |
|---|---|---|---|
| C1 | **Business entity, PAN, bank account, GST registration** | Required to onboard with Razorpay, issue invoices, collect GST on fees | Weeks. Decide proprietorship vs company with the CA |
| C2 | **Razorpay account activation + Route (marketplace) approval** | Split payments to venues need Route; linked-account KYC per venue | Approval is *not* instantaneous and can be declined or restricted; **have the fallback** (platform collects, manual payouts) ready (05 §2.6) |
| C3 | **TRAI DLT registration for SMS** — principal entity, sender header, content templates (each OTP/transactional message) | Indian carriers block SMS that are not on registered templates; **OTP login cannot work in production without it** | Typically days to a couple of weeks; templates need re-approval when text changes. v1 never mentioned DLT |
| C4 | **DPDP Act 2023 + DPDP Rules 2025** | Playlo is a Data Fiduciary. Rules notified **13 Nov 2025**; consent-manager provisions apply **13 Nov 2026**; **core obligations (notice, consent, security safeguards, breach reporting, retention/erasure, children's data) apply from ~13 May 2027** (some sources differ by a day) — i.e., soon after a Q1 2027 launch **[confirm with counsel]** | Build compliance in now: consent records, notices, erasure, breach process, grievance contact, vendor agreements |
| C5 | **Legal documents**: Terms of Service, Privacy Policy, Refund Policy, Cancellation Policy, Community Guidelines, Cookie Policy | Required before launch; refunds/cancellation text must match the engine (05 §2.5) | Counsel review; version and store (`ConsentRecord`) |
| C6 | **Consumer protection / e-commerce obligations** (grievance officer, seller details, refund disclosures) | As a platform connecting venues and consumers **[confirm applicability]** | Publish a named grievance contact |
| C7 | **GST treatment** of convenience fee, commission, and possible tax collection at source for facilitated supplies | Affects fee design, invoices, venue payouts | CA decision before launch **[confirm]** |
| C8 | **TDS on payments to venues** (a section of the Income-tax Act applies to e-commerce operators facilitating sales/services) | Could require deducting tax from payouts and filing returns **[confirm applicability and rate]** | CA decision before first payout |
| C9 | **Wallets / stored value** | Holding user balances may trigger RBI prepaid-instrument rules | **Do not build** (product plan §7.8) until regulatory review |
| C10 | **Trademark and domain** | Brand name and `playlo.in` should be cleared and secured | Cheap, do now |
| C11 | **Liability and insurance** for injuries at partner venues | User and reputational risk | Terms + venue agreement; counsel |
| C12 | **Venue agreement** (commercial terms, cancellation, settlement, data handling, KYC consent) | Contracts with the supply side | Template with counsel before pilot |

## 6. Privacy by design

### 6.1 Data inventory

| Data | Purpose | Collected when | Basis (DPDP) | Retention |
|---|---|---|---|---|
| Phone number | Login, transactional notices | Signup | Consent (notice at signup) | Life of account |
| Name, avatar, bio | Profile display | Onboarding | Consent | Life of account |
| Sports, skill, availability | Matching and discovery | Onboarding | Consent | Life of account |
| Approx. location (≈ 1 km) | Distance in search | Onboarding / on use | Consent, revocable | Life of account |
| Attendance, reliability | Trust features | Gameplay | Consent / legitimate use per counsel | Rolling; summarised after 12 months |
| Booking, payment records | Contract, tax law | Booking | Contract / legal obligation | ≥ 8 years (confirm) |
| Venue KYC documents | Verification, payout compliance | Venue onboarding | Consent / legal obligation | Per law, then delete |
| Analytics events | Product improvement | During use | Consent (analytics toggle) | 90 days raw |
| Consent records | Evidence | Each acceptance | Legal obligation | ≥ 3 years |

### 6.2 Consent and notice

- Notice at signup in plain language (English and Hindi): what is collected, why, retention, rights, grievance contact, how to withdraw. **Itemised and unbundled:** Terms + Privacy (required), marketing messages (optional, default off), analytics (optional).
- Withdrawing consent must be as easy as giving it (Settings → Privacy).
- Cookie/analytics banner shows only what is optional; "decline" is as prominent as "accept" and PostHog does not start until accepted.
- Every acceptance writes a `ConsentRecord` with document and version; re-acceptance is required when a document version changes materially.

### 6.3 Data-subject requests

| Request | Handling | Target |
|---|---|---|
| Access / copy | Export of profile, games, bookings, consents as JSON/PDF from Settings | Self-service or ≤ 30 days |
| Correction | Self-service edit; support for locked fields | Immediate / ≤ 30 days |
| Erasure | Account deletion algorithm (03 §8): anonymise, retain only legally required financial rows | ≤ 30 days |
| Withdrawal of consent | Settings toggles | Immediate |
| Grievance | Named officer + email on the site | Acknowledge ≤ 7 days |
| Nomination (right to nominate a representative) | Policy text; manual process | As required |

### 6.4 Third parties (processors)

Neon, Vercel, Upstash, Cloudflare, Razorpay, MSG91, Firebase, PostHog, Sentry, Axiom. Keep a vendor register with: data shared, location, DPA/terms accepted, breach-notification contact. Pass only identifiers needed (PostHog gets internal user IDs, never phone/email; Sentry scrubs request bodies and cookies). Confirm cross-border-transfer position under the DPDP Rules **[confirm]**.

## 7. Incident response

| Severity | Examples | Response |
|---|---|---|
| **SEV-1** | Payment tampering, data exposure, double bookings at scale, admin takeover | Page owner immediately; contain (disable feature flag / revoke keys / rollback); preserve logs; start the clock for notification duties |
| **SEV-2** | Webhook backlog, OTP delivery failure, reconciliation mismatch | Same-day fix; status note to affected venues/players |
| **SEV-3** | Minor bugs, degraded non-critical features | Normal backlog |

Personal-data breach procedure: **detect → contain → assess (what, whose, how many) → notify.** The DPDP Rules require intimation to affected individuals and to the Data Protection Board, with a detailed report following within a short fixed window (reported as 72 hours) **[confirm exact timing and content with counsel]**. Keep a breach register; run a tabletop exercise before launch. Operational runbooks are in 08 §Runbooks.

## 8. Security testing plan

| When | What |
|---|---|
| Every PR | Lint (incl. `jsx-a11y`, no-unsafe-raw-SQL rule), typecheck, unit/integration tests, `pnpm audit`, secret scan, CodeQL |
| Every preview | OWASP ZAP baseline scan against the preview URL; axe checks in Playwright |
| Before launch | **Authorisation test pass** (T-09), webhook forgery/replay tests (T-03/T-04), rate-limit tests (T-10), manual review of CSP in Report-Only logs, review of all `$queryRaw` calls, secrets and environment audit, restore drill |
| Before paid scale-up | External penetration test of auth, payments, admin; remediate before opening bookings to the public |
| Quarterly | Dependency and access review, secret rotation, backup restore drill, tabletop |

## 9. Changes from v1

| v1 | v2 |
|---|---|
| CSP with `unsafe-eval` and `unsafe-inline` | Nonce-based on dynamic surfaces; dev-only eval; verified-origin list; Report-Only rollout |
| Server-only hosts in `connect-src` | Removed |
| `x-trpc-source` header called CSRF protection | Origin check |
| Public OTP endpoint unprotected; IP fallback `127.0.0.1` | Per-phone/IP/global limits, fail-closed, bot challenge, India-only |
| `venueOwnerProcedure` role-only | Venue-scoped permission checks |
| No admin 2FA | Required for privileged roles |
| No DLT, GST/TDS, DPDP, venue agreement, breach plan | Checklist C1–C12, privacy design, incident process |
| KYC bucket mentioned, not specified | Private bucket, signed URLs, audited access |
| Webhook compared with `!==` | Constant-time compare, inbox dedupe, amount check |
