# 11 · Audit Report: Review of the v1 Plan and Documentation

| | |
|---|---|
| **Scope** | All eight v1 documents (`README`, `product-plan-phased`, and the six numbered specifications), now archived in `_archive/` |
| **Method** | Full read-through; cross-document consistency check; code and SQL reviewed line by line; schema validated with the Prisma CLI; the rewritten integrity SQL, domain logic and validators executed against a real Postgres engine / test runner; vendor facts checked against public sources (October 2026) |
| **Audience** | The owner, and any engineer who wants to know *why v2 differs from v1* |
| **Related** | [10-decision-log](./10-decision-log.md) · [00-start-here](./00-start-here.md) |

---

## 1. Summary

v1 is a strong **product and architecture sketch**: well-ordered phases, a sensible India-first stack, explicit "what not to build", good instincts (integer paise, provider-authoritative payments, decoupled game and booking lifecycles, tests concentrated on money paths). It was not yet a document set someone else could build from safely. The review found:

| Severity | Count | Meaning |
|---|---:|---|
| **Critical** | 8 | Would cause money loss, data exposure, inventory corruption, or block launch |
| **High** | 17 | Would cause serious defects, rework, or compliance gaps |
| **Medium** | 26 | Correctness, consistency, UX, or maintainability problems |
| **Low** | 4 | Polish |

**The five that matter most**

1. **Double-booking was not actually prevented** (C-01, C-03): the overlap check ignored held and in-progress bookings, the lock key would overflow, and nothing in the database forbade overlaps.
2. **The payment webhook could confirm a booking it should not** (C-02): unconditional update, no amount check, no replay protection — a late payment could re-confirm a slot that was already sold to someone else.
3. **Any venue owner could read or edit any other venue** (C-07), and the one endpoint that costs real money per call (SMS OTP) had no rate limit (C-06).
4. **Launch blockers that v1 never mentioned:** India SMS DLT registration (C-08), a database region that does not exist (C-05), and a 7-week plan for roughly 28–39 weeks of scope (H-06).
5. **Three incompatible fee models** and no way to collect game fees (H-02, H-03).

All are resolved or explicitly tracked in v2 (§6 maps each finding to its fix).

## 2. What v1 got right (kept)

- Phase ordering, MVP hypothesis, success metrics, and the **"what not to build early"** discipline.
- **Integer paise** for money; UTC storage; audit logging; permissions-not-roles intent.
- **Provider-authoritative payment confirmation**, HMAC verification over the *raw* webhook body, and an idempotency mindset.
- **Games and bookings as separate lifecycles**; state-machine thinking.
- Zod as the single source of input truth; tRPC for end-to-end types.
- Pragmatic solo-developer stack and a cost model that shows infrastructure is not the binding constraint.
- Concentrating tests on revenue-critical paths rather than layouts.
- Honest product rules (don't present planned features as live; publish only verified numbers).

## 3. Severity definitions

**Critical** — exploitable or certain to occur in normal use with serious consequences (financial loss, privacy breach, corrupted inventory) or an external blocker to launching. **High** — likely to cause a significant defect, security weakness, compliance gap or major rework. **Medium** — incorrect or inconsistent behaviour with contained impact. **Low** — clarity or polish.

## 4. Findings — Critical and High

**Location column:** section references in the *Location* column point at the **v1** documents using their own numbering — e.g. "02 §3" is v1 `02-database-and-data-model.md` §3. The *Resolution* column points at the **v2** documents.

| ID | Sev | v1 location | Finding | Consequence | v2 resolution |
|---|:-:|---|---|---|---|
| C-01 | Crit | 02 §3 booking engine; 02 schema | Overlap query checks only `CONFIRMED` and `PAYMENT_PENDING` — not `PENDING` or `IN_PROGRESS`; no DB-level constraint; the `PENDING` row never expires (no job in the code path). After the 5-min Redis TTL a second user can create a second `PENDING` booking for the same slot | Two paid bookings for one court-hour | Exclusion constraint on all live statuses; court lock; lazy expiry; expiry job — 03 §5.1, 05 §2.1, ADR-005. **Tested** |
| C-02 | Crit | 03 §4 webhook | Sets `CONFIRMED` unconditionally; no amount/currency check; no event-ID dedupe (race between `order.paid` and `payment.captured`); a payment arriving after expiry would flip a cancelled booking back to confirmed even if the slot was re-sold; `payment.failed`, refunds and transfers ignored | Double booking; accepting wrong amounts; stuck states | `confirmPayment()` with branches, auto-refund, inbox table, amount check — 05 §2.4, ADR-007 |
| C-03 | Crit | 02 §3 `hashCourtSlotToBigInt` | Hand-rolled `BigInt` hash with `\|= 0n` (no 64-bit truncation); can exceed `int8` and error; also hashes `(court,start)`, so overlapping-but-different slots take different locks | Runtime failure or ineffective lock | `pg_advisory_xact_lock(hashtextextended(courtId,0))` — **verified to run**; ADR-005 |
| C-04 | Crit | 02 §4 `findNearbyVenues` | Raw SQL selects `v.address_line1`, `c.base_hourly_rate_paise`, `c.venue_id` … but the Prisma schema maps **tables** only (`@@map`) and leaves column names camelCase, so those columns do not exist | Venue discovery (a core feature) fails at runtime | Quoted camelCase identifiers; convention documented — 03 §1, §7.2 (executed against the generated DDL names; PostGIS part pending Spike S3) |
| C-05 | Crit | README, 01 §3.1, cost model | Neon `ap-south-1` (Mumbai) **does not exist** (Neon lists Singapore and Sydney in Asia-Pacific). "Sub-15 ms to Mumbai edge" is false | Latency/data-residency assumptions wrong | ADR-003, 02 §4.2, Spike S1 |
| C-06 | Crit | 03 §2 | `publicProcedure = t.procedure` has **no rate limiting**, yet `auth.sendOtp` is public; limiter also falls back to IP `127.0.0.1` shared by every unidentifiable client | SMS-pumping cost attack; shared-bucket DoS | Policies per endpoint, fail-closed for OTP/payments, per-phone + per-IP + global caps, refuse unidentified clients — 04 §2, §5, 07 §3.1 |
| C-07 | Crit | 03 §2 `venueOwnerProcedure` | Checks only the global `VENUE_OWNER` role, not ownership of *that* venue | Any owner can read/modify any venue (IDOR) | `venueProcedure` resolves venue from input and checks `VenueStaff`; IDOR test matrix T-09 — 04 §2–3 |
| C-08 | Crit | Whole plan | **No mention of TRAI DLT registration.** Indian carriers block unregistered SMS templates, so OTP login cannot work in production | Launch blocker with lead time | Compliance checklist C3; Week-0 workstream — 07 §5, 09 §4 |
| H-01 | High | 04 §2.1 `joinGameSession` | Comment says "lock game row" but `findUnique` takes no lock; count is computed in memory then written back (`currentConfirmed + 1`); the host is never inserted as a participant while `confirmedCount` defaults to 1 | Overbooked games; counter drift; off-by-one from the first join | Atomic conditional `UPDATE`, host participant row, CHECK constraint — 05 §3.2, T-05. **UPDATE semantics tested** |
| H-02 | High | 02 booking engine, 04 §1.1, 06 E2E | Three fee models: literals `49200` with taxes = 18 % of the court price; GST on the *platform fee only* (₹423.60); a 10 % commission with no GST and no payout-identity checks | Wrong charges, unreconcilable books | Single definition and module — 05 §2.2; CHECK constraints; **tested** (identities for every ₹1 up to ₹2 000) |
| H-03 | High | 02 schema | `Payment.bookingId` required, but game `costPerPlayerPaise`/`hasPaid` and tournament `isPaid` have no payment path | Features specified but impossible to build | ADR-010 (fees off-platform in Phase 1), `purpose` on `Payment` |
| H-04 | High | 03 `listSettlements`; 02 schema | Settlement/payout referenced but no `Transfer`, linked account or KYC model; Route needs per-venue linked accounts | Cannot implement payouts | `VenueLinkedAccount`, `Transfer`, fallback — 03, 05 §2.6, ADR-019 |
| H-05 | High | README, 01, 06 | NextAuth v5 as the base of phone-OTP auth: Auth.js is now in maintenance under the Better Auth team and v5 is still beta; OTP also modelled as tRPC procedures competing for session ownership | Foundational churn | Contract-first auth, spike S5 — ADR-004, 04 §7 |
| H-06 | High | 06 §4 | 7 weeks for one developer; component counting gives ~114–155 dev-days (≈ 28–39 weeks). Non-code lead-time work (Route, DLT, legal, venue/organiser recruitment) absent | Missed launch, rushed payments code | Effort model, staged plan, lead-time table — 09 |
| H-07 | High | 06 §2 CI | Points to `localhost:5432` with no Postgres service; no `prisma migrate`; Playwright has no running app; the "concurrency test" needs PostGIS/`btree_gist`; Node 20 is past end-of-life | Pipeline could not pass; false confidence | Corrected workflow (valid YAML), service containers, build+start — 08 §4 |
| H-08 | High | 04 §3 vs 02 schema | `AvailabilitySlot` table with 1:1 booking vs a scheduler hard-coding 06:00–22:00 hourly slots and ignoring peak prices and venue hours | Two models; venues can't set hours; no peak pricing | Rules-based availability — 03 §3.1, 05 §4, ADR-014. **Tested** |
| H-09 | High | 02/03 | Idempotency only on `Payment`; `Booking`, `Refund`, notifications and webhooks had none | Duplicates on retries/double taps | Idempotency keys, webhook inbox, outbox — 03, 04 §9 |
| H-10 | High | 04 §4 PRS | Lifetime cumulative formula (`100 − 25N − 10L + 2G`), order-insensitive, harsh on small samples, auto-restricts players below 75 % — contradicting the product plan (publish criteria, disputes, no single-event penalties) | Unfair restrictions; trust backlash | Phase 1 descriptive; Phase 2 windowed smoothed score with soft gates — 05 §6, ADR-009. **Tested** |
| H-11 | High | 04 §5 WhatsApp | Shares `/app/games/{id}`: login-walled and `noindex` ⇒ no link preview and a login wall on first click — undermining the stated viral loop | Growth mechanism ineffective | Public `/g/{code}` page with OG preview — 05 §8, ADR-018 |
| H-12 | High | 06 §1 flags | Feature flags evaluated by a client hook only; Phase-2 procedures stay callable; ad-blockers make flags fail unpredictably | Unreleased features reachable; flicker | Server-side registry, kill switches, `FEATURE_DISABLED` — 08 §6, ADR-011 |
| H-13 | High | 05 §2–4 | Primary button white on `#10b981` = **2.54 : 1**; `emerald-600` 3.77 : 1; `slate-400` text 2.56 : 1; error `#ef4444` 3.76 : 1 — all below WCAG AA 4.5 : 1 | Accessibility failure, hard to read outdoors | Re-specified tokens with computed ratios — 06 §3.1 |
| H-14 | High | 01 §4.3 CSP | Claims a "strict CSP" but allows `'unsafe-eval' 'unsafe-inline'` in `script-src`; lists server-only hosts in `connect-src` | XSS protection effectively off | Nonce-based CSP, Report-Only rollout — 07 §3.3 |
| H-15 | High | Whole plan | No DPDP Act/Rules plan (core duties apply ~13 May 2027), GST/TDS decisions, venue agreement, breach process, retention policy, account-deletion algorithm | Compliance exposure | 07 §5–7, 03 §8, open items |
| H-16 | High | 02 schema `Role` | Global role enum mixes venue roles (`VENUE_OWNER`) with platform roles and invents "GAME_ORGANIZER" as a role; "owner of *which* venue?" unanswerable; roles cached in session go stale | Authorisation holes; hard to revoke | Platform roles + `VenueStaff.role`; permission matrix; session version — 03, 04 §3 |
| H-17 | High | 01 §2, 05 §1 | Four Next.js apps: four deployments, subpath routing or multi-zones, a webhook endpoint "in each app", service-worker scope, duplicated middleware/CSP/cookies — for one developer | Complexity with no benefit | One app, route groups — ADR-002 |

## 5. Findings — Medium and Low

| ID | Sev | Location | Finding | Resolution |
|---|:-:|---|---|---|
| M-01 | Med | 01 §3.1 | "PgBouncer on port 6543" is a Supabase convention; Neon's pooled endpoint uses a `-pooler` hostname | 02 §4.1 |
| M-02 | Med | 02 schema | `Booking.slotId` 1:1 prevents multi-slot bookings | Interval bookings (03) |
| M-03 | Med | 04 §3 | `dayEnd = 23:59:59` mixes inclusive/exclusive bounds; 16 sequential Redis `GET`s per call | Half-open intervals; `MGET` — 03 §7.1, 05 §4 |
| M-04 | Med | 02 | Booking number from `Date.now()` base-36 (collision-prone; does not match "BK-2026-00123") | Postgres sequence — **tested** |
| M-05 | Med | 02 schema | Redundant indexes (`@@index([phone])` beside `@unique`; same for Razorpay order ID) | Removed |
| M-06 | Med | 02 `AuditLog` | Actor required (no system/webhook actors); table not tamper-resistant | Nullable actor + `actorType`; append-only trigger — **tested** |
| M-07 | Med | 02 `PlayerProfile` | Exact latitude/longitude stored; contradicts "keep precise location private" | Coarse location — ADR-012 |
| M-08 | Med | 02 `Review` | No anchor to a shared game/booking; no uniqueness; target XOR not enforced | `gameId` anchor; unique constraint (Phase 2) |
| M-09 | Med | 02 `Notification` | In-app only; no delivery channel, retry or dedupe | Outbox + `dedupeKey` |
| M-10 | Med | 02 enums | `IN_PROGRESS` stored (needs a cron, queried nowhere); `Refund.status` reuses `PaymentStatus`; refund concept leaks into payment enum | Derived in-progress; `RefundStatus`; trimmed `PaymentStatus` |
| M-11 | Med | 05 §6 | Hindi plural form missing; no Devanagari font; "Hindi from Day 1" vs "Hindi-ready plumbing" | 06 §8, §3.2 |
| M-12 | Med | 05 §3 PWA | Orientation lock; combined `any maskable` icon; SW at `/sw.js` with `/app` start URL; offline "will sync" promise for actions involving money/capacity | 06 §7, §6 |
| M-13 | Med | 05 §5 | Eight screen states; product plan requires nine (dropped *unavailable resource*) | 06 §6 |
| M-14 | Med | 05 §4.1 `GameCard` | Ignores `sport` prop; hard-coded English; function props in a server component; `slate-400` text; whole card not one link target | 06 §5.1 |
| M-15 | Med | 01 §8 cost | Omits gateway fees, Route fees, WhatsApp messaging, domain/legal/CA; FX assumption old; "2 % absorbed" leaves the bearer unspecified | 02 §13, 05 §2.3 |
| M-16 | Med | 01 §5, 03 §4 | Env schema defined but webhook reads `process.env` and imports the schema unused; missing private bucket, FCM, DLT sender; no guard against live keys outside production | 02 §7.1 |
| M-17 | Med | 03 §3 | Title max 100 in Zod vs 120 in DB; `z.date()` over JSON; no lead-time or duration limit; no skill/participant cross-checks; free-text `sportSlug`; naive timestamps allowed | 04 §6 — **tested** |
| M-18 | Med | 02 §5 seed | Seed admin `admin@playlo.in` on the production domain | `.test` addresses; refuses production — 03 §9 |
| M-19 | Med | 06 §3 tests | Concurrency test uses an unseeded court, unused imports, asserts promise outcomes only; E2E "verifies modal is primed" | 08 §5 |
| M-20 | Med | 03 §5 | Comment "fire immediately if under 2 hours" but code just `return`s — reminder silently skipped | 02 §8, 05 §9 |
| M-21 | Med | 04 §5 | WhatsApp text hard-codes "Sirsa" and its own plural logic | i18n ICU — 05 §8 |
| M-22 | Med | 01 §4.2 | `x-trpc-source` header presented as CSRF protection | Origin check — 07 §3.1 |
| M-23 | Med | 02 §1 | `previewFeatures = ["postgresqlExtensions"]` but no `extensions = [postgis]`; the migration would not enable PostGIS | Added (`postgis`, `btree_gist`) |
| M-24 | Med | 01 §7 | "Redis loss falls back gracefully to DB validation" — untrue without a DB constraint | True after ADR-005; 02 §12 |
| M-25 | Med | 02 schema | Timestamps declared `DateTime` → `timestamp` without zone | `@db.Timestamptz(3)` |
| M-26 | Med | 02 geo query | Computes `ST_MakePoint` per row (cannot use an index) while claiming "spatial indexing" | 03 §7.2 with honest MVP note |
| L-01 | Low | 01 §1 | Both Cloudflare R2 and Cloudflare Images listed without a decision | Resolve in Sprint 0 (resize via Next/Image or Images) |
| L-02 | Low | README | "Next.js 15" while the current major is later; pin one version in Sprint 0 | 03 §1 |
| L-03 | Low | Plan §1 | Malformed table cell (`Badminton | Futsal`); placeholders still in brackets after decisions were made | Reconciled — 12 |
| L-04 | Low | README | Index duplicated content now living in separate docs; no reading order or status | New README and 00 |

## 6. What was verified (and how)

Every row marked *Pass* below is reproducible: `cd docs/_verification && npm install && npm test` ([README](./_verification/README.md)).

| Claim | Method | Result |
|---|---|---|
| Rewritten Prisma schema is valid | `prisma validate` (Prisma 6) | Pass |
| Integrity SQL works with the generated DDL | Executed on an embedded Postgres engine (PGlite + `btree_gist`): 21 checks | Pass — including overlap rejection, adjacency allowed, expiry frees slot, **revival of an expired booking rejected after re-sale**, atomic join capacity, audit append-only, advisory-lock function |
| Fee, refund, reliability and availability logic | 16 unit tests (`node --test`) | Pass |
| Validators | 7 tests on Zod 4 | Pass |
| CI workflow syntax | YAML parse | Pass (actions not executed) |
| Colour contrast | WCAG relative-luminance calculation | Ratios in 06 §3.1 |
| Neon regions | Vendor documentation | No India region |
| Auth.js status | Public announcement and project discussions | Maintenance under Better Auth |
| DPDP timeline | Law-firm and government summaries | Rules notified 13 Nov 2025; consent managers +12 months; core duties +18 months |

## 7. What could not be verified (treat as open)

- **Multi-connection concurrency on Neon through the pooler** — the SQL semantics are proven, not the live behaviour (Spike S2, test T-01).
- **PostGIS query execution** (Spike S3).
- **Razorpay Route parameters, fees and settlement timing; Razorpay's exact CSP origins** (Spikes S6–S7, open items F-03, S-02).
- **Current vendor prices** (cost model is v1's estimates with caveats).
- **Indian tax and law interpretations** (GST on fees/commission, tax collection at source, TDS on payouts, DPDP specifics, e-commerce rules) — need a CA and counsel.
- Whether Prisma Migrate leaves hand-written constraints alone on every `migrate dev` (Spike S4).
- Everything in the service-layer *reference* code: it is a specification, not executed code.

## 8. Recommended next actions (in order)

1. Owner decisions marked ◆ in the [decision log](./10-decision-log.md) (notably ADR-017: staged release).
2. Start Week-0 workstreams: DLT, entity/GST, Razorpay application, legal drafting, organiser and venue outreach ([09 §4](./09-delivery-plan.md)).
3. Run Sprint-0 spikes S1–S7 ([09 §5.2](./09-delivery-plan.md)).
4. Confirm tax and legal items with a CA and counsel ([12-open-items](./12-open-items.md)).
5. Begin implementation in the order of [09 §5](./09-delivery-plan.md), with T-01…T-05 written *before* the engines.
