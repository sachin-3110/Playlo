# 08 · Engineering Operations: Environments, CI/CD, Testing, Observability, Runbooks

| | |
|---|---|
| **Status** | v2.0 — CI workflow parsed as valid YAML; test and runbook content is specification |
| **Audience** | Every engineer; whoever is on call |
| **Related** | [02-architecture](./02-architecture.md) · [05-business-logic](./05-business-logic.md) · [07-security-privacy-compliance](./07-security-privacy-compliance.md) · [09-delivery-plan](./09-delivery-plan.md) |

---

## 1. Environments

| Environment | Purpose | Code | Database | Secrets / providers |
|---|---|---|---|---|
| **Local** | Development | Working copy | Docker Postgres (`postgis/postgis:16-3.4`) | `.env.local` from `.env.example`; Razorpay **test** keys; fixed OTP allowed |
| **Preview** (per PR) | Review, E2E | Vercel preview | **Neon branch per PR** created from the `staging` branch (seed data only) | Test keys; no production secrets; deployment protection on |
| **Staging** | Pre-release, partner demos | `main` auto-deploy | Neon `staging` branch, seeded | Razorpay test mode; MSG91 sandbox/real test numbers |
| **Production** | Live | Promoted release | Neon `main` (production) | Live keys; env schema refuses test keys (02 §7.1) |

Rules: production data never flows to lower environments; lower environments never hold production secrets; each environment has its own Razorpay webhook endpoint and secret.

## 2. Local development — quick start

Target: a new engineer runs the app in under 15 minutes.

Prerequisites: Node.js **LTS** (22 or 24; Node 20 is end-of-life), pnpm 10, Docker, Git.

```bash
git clone <repo> playlo && cd playlo
pnpm install
cp .env.example .env.local            # fill the few values marked REQUIRED (Razorpay test keys, QStash dev token)
docker compose up -d db               # Postgres 16 + PostGIS on :5432
pnpm --filter @playlo/db prisma migrate deploy
pnpm --filter @playlo/db seed
pnpm dev                              # http://localhost:3000
```

Useful extras: `pnpm dlx @upstash/qstash-cli dev` (local QStash), a tunnel such as `cloudflared tunnel --url http://localhost:3000` to receive Razorpay test webhooks, `pnpm --filter @playlo/db prisma studio`. Seeded login uses the dev-only fixed OTP (disabled outside local/preview). The repository README must contain exactly this section; if it drifts, fix the README first.

## 3. Branching, review, release

- **Trunk-based:** short-lived branches, squash-merge into `main`, every PR gets a preview. Branch names `feat/…`, `fix/…`, `chore/…`.
- **Definition of Done (PR):** types and lint pass; tests for new logic (domain logic: unit; money/booking/game paths: integration against real Postgres); docs updated if behaviour or contract changed; accessibility checked for UI changes; feature behind a flag if user-visible and not ready; migration follows expand → migrate → contract; no new `any` or unvalidated input; changelog line for user-visible change.
- **Review checklist (author and reviewer):** authorisation on every by-ID access; money only through `packages/domain`; no PII in logs/events; raw SQL parameterised and identifiers quoted; idempotency considered; failure modes (retry, partial failure, replay) considered; copy goes through i18n.
- **Release:** merge to `main` → staging deploy and smoke test → production migration (manual approval gate) → promote the same build → verify synthetic booking probe → watch dashboards 30 minutes. **Rollback:** Vercel instant rollback; migrations are additive so the previous build still works with the new schema.

## 4. CI/CD pipeline

v1's workflow would not have run: it pointed at `localhost:5432` without defining a database service, skipped `prisma migrate`, started no application server for Playwright, used `pnpm/action-setup@v3` with Node 20 (end-of-life since April 2026), and ran the "concurrency" test with no PostGIS/`btree_gist`. The pipeline below fixes those and adds dependency audit and CodeQL. Pin each action to a commit SHA before launch.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read          # least privilege; add per-job permissions only where needed

env:
  NODE_VERSION: "24"      # current LTS line; Node 20 is end-of-life
  PNPM_VERSION: "10"
  # Throwaway local values — never real secrets in CI for PR builds
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/playlo_test
  DIRECT_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/playlo_test
  APP_ENV: local
  AUTH_SECRET: test-secret-test-secret-test-secret-123456
  RAZORPAY_KEY_ID: rzp_test_placeholder
  RAZORPAY_KEY_SECRET: test_secret_placeholder
  RAZORPAY_WEBHOOK_SECRET: test_webhook_secret

jobs:
  validate:
    name: Lint, typecheck, unit + integration tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgis/postgis:16-3.4      # PostGIS included; btree_gist ships with Postgres contrib
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: playlo_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4          # pin every action to a commit SHA before launch
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: pnpm }

      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
      - run: pnpm --filter @playlo/db prisma generate
      - run: pnpm --filter @playlo/db prisma migrate deploy     # applies 0001_init + 0002_integrity to the service DB
      - run: pnpm --filter @playlo/db seed

      - run: pnpm turbo run lint typecheck
      - run: pnpm turbo run test                                 # unit (domain, validators) + integration (real Postgres)

  e2e:
    name: Playwright (critical paths)
    needs: validate
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 25
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: playlo_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: "${{ env.PNPM_VERSION }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @playlo/db prisma generate
      - run: pnpm --filter @playlo/db prisma migrate deploy
      - run: pnpm --filter @playlo/db seed
      - run: pnpm exec playwright install --with-deps chromium
      # playwright.config.ts defines webServer: `pnpm --filter web build && pnpm --filter web start` on :3000
      - run: pnpm test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: apps/web/playwright-report, retention-days: 7 }

  codeql:
    name: CodeQL
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write }
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with: { languages: javascript-typescript }
      - uses: github/codeql-action/analyze@v3
```

**Release workflow** (`.github/workflows/release.yml`, manual or on tag): `environment: production` with required reviewer → `pnpm --filter @playlo/db prisma migrate deploy` using the **direct** URL from the production environment's secrets → promote the verified Vercel build. Migrations never run from PR workflows against shared databases.

**Vercel/Neon:** use Neon's GitHub/Vercel integration to create and delete a database branch per preview; Next.js `output` and functions region follow ADR-003.

## 5. Test strategy

Effort goes where bugs cost money or inventory. UI layout tests are not a priority; domain, concurrency and security tests are.

| Level | Scope | Tooling | Runs |
|---|---|---|---|
| **Unit (pure)** | `packages/domain` (fees, refunds, availability, reliability) and `packages/validators` | Vitest (or `node:test`); executed already in this documentation set | Every PR |
| **Integration (real Postgres)** | Services: booking, payment confirmation, game join, expiry, webhooks | Vitest + Postgres service container + Prisma | Every PR |
| **E2E** | Auth → search → availability → hold → checkout up to the payment sheet; signed-webhook simulation for confirmation | Playwright + axe | PR (critical paths), nightly (full) |
| **Security** | AuthZ matrix, webhook forgery, rate limits, private bucket | Vitest/Playwright API tests, ZAP baseline | PR / preview |
| **Load (light)** | Hold contention, availability read | k6 against staging | Before launch, before each growth step |

### 5.1 Required test catalogue

Every row is a launch gate. IDs are referenced elsewhere in these docs.

| ID | Test | Assertion | Level |
|---|---|---|---|
| **T-01** | **Concurrent reservation** — 20 parallel `initiateHold` calls for the same court/interval from 20 users, using separate DB connections | Exactly **1** `PENDING` booking exists in the table; 19 `SLOT_UNAVAILABLE`/`SLOT_HELD`; also repeat for partially overlapping intervals and for adjacent intervals (both succeed) | Integration |
| **T-02** | **Late payment after expiry** — hold expires, another user books, then the first user's payment webhook arrives | Second booking untouched; first booking `REFUND_PENDING`; full refund created; nobody double-booked | Integration |
| **T-03** | **Webhook forgery** — wrong signature, signature over re-serialised body, missing event ID | 400; no state change | Integration/API |
| **T-04** | **Webhook replay and ordering** — same event ×5 concurrently; `payment.captured` then `order.paid`; reverse order | Exactly one payment success, one transfer, one confirmation notification; final state identical in every ordering | Integration |
| **T-05** | **Concurrent game join** — 20 users join a 4-seat game (host + 3 seats) | `confirmedCount = 4`, 3 `CONFIRMED` joiners + host, 17 waitlisted/`GAME_FULL`; counter equals participant rows; same user joining twice in parallel counts once | Integration |
| **T-06** | Amount mismatch — webhook amount ≠ order amount | Payment flagged `AMOUNT_MISMATCH`, no confirmation, alert emitted | Integration |
| **T-07** | Refund tiers — table-driven at boundaries (24 h, 12 h, after start, venue cancel) incl. transfer reversal arithmetic | Matches 05 §2.5; platform retains exactly fee + GST + commission + GST | Unit (exists) |
| **T-08** | Expiry job — `PENDING`, `PAYMENT_PENDING` with and without a captured payment at the provider (stubbed) | Correct final state; Redis key removed; idempotent on re-run | Integration |
| **T-09** | **IDOR matrix** — each by-ID procedure as owner / other user / other venue's staff / suspended user | 403/404 for all but the owner; same response for "not found" and "forbidden" | Integration |
| **T-10** | OTP and rate limits — resend cooldown, 5-attempt cap, per-IP cap, Redis outage behaviour | Fail closed on OTP/payment; reads fail open | Integration |
| **T-11** | Private bucket — unauthenticated and cross-user access to KYC document URLs | Denied; signed URL expires | API |
| **T-12** | Reconciliation — payment captured at provider, no webhook ever delivered | Reconcile job confirms the booking within the SLA | Integration |
| **T-13** | Fee identities and rounding | Total and payout identities for ₹1–₹2 000 | Unit (exists) |
| **T-14** | Availability grid — IST boundaries, peak bands, blocks, horizon | See `domain.test.ts` | Unit (exists) |
| **T-15** | Validators — cross-field and timestamp strictness | See `validators.test.ts` | Unit (exists) |

Sketch of T-01 (corrects v1's version, which referenced an unseeded court ID, imported unused helpers, asserted only on promise outcomes within one Node process, and would not have detected a missing constraint):

```ts
// packages/api/src/services/booking/__tests__/initiate-hold.concurrency.test.ts — reference
it('allows exactly one of 20 simultaneous holds on the same court interval', async () => {
  const court = await seedCourt();                                   // fresh venue/court per test
  const users = await seedUsers(20);
  const start = inTwoDays('18:00'), end = inTwoDays('19:00');

  const results = await Promise.allSettled(
    users.map((u) => initiateHold({ userId: u.id, courtId: court.id, startTime: start, endTime: end, idempotencyKey: crypto.randomUUID() }, depsWithOwnDbConnection())),
  );

  const ok = results.filter((r) => r.status === 'fulfilled');
  expect(ok).toHaveLength(1);
  results.filter((r) => r.status === 'rejected').forEach((r) => expect(domainCodeOf(r)).toMatch(/SLOT_(HELD|UNAVAILABLE)/));

  const rows = await db.booking.count({ where: { courtId: court.id, status: { in: ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'] } } });
  expect(rows).toBe(1);                                              // the DB agrees, not just the return values
});
```

Helper for simulating Razorpay in E2E and integration tests (real Checkout cannot be driven reliably in CI):

```ts
export function signedWebhook(event: unknown, secret = process.env.RAZORPAY_WEBHOOK_SECRET!, eventId = crypto.randomUUID()) {
  const body = JSON.stringify(event);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return { body, headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId, 'content-type': 'application/json' } };
}
```

**Quality gates:** no merge with failing T-01…T-05 once those exist; unit coverage is *reported* for `packages/domain` and `packages/validators` (expect > 90 %) but not enforced globally — coverage targets elsewhere reward trivial tests.

## 6. Feature flags and phase gating

v1 put flags in PostHog and read them with a **client-side** hook (`useFeatureFlagEnabled`). That hides UI but leaves the server procedures callable, flickers on load, and fails *open* if PostHog is blocked (ad-blockers are common). v2:

| Concept | Rule |
|---|---|
| **Evaluation** | **Server-side**, per request, from a small typed registry (`packages/config/src/flags.ts`) backed by Vercel Edge Config (or environment variables) for **operational kill switches**, and PostHog server SDK for **experiments/gradual rollouts**. Client receives resolved booleans from the server |
| **Default** | Missing/unreachable flag → **off** (fail closed) |
| **Enforcement** | Procedures for gated features check the flag and throw `FEATURE_DISABLED`; UI hiding is cosmetic only |
| **Lifecycle** | Every flag has an owner and a removal date; flags that have been 100 % on for two weeks are deleted from the code |
| **Not flags** | Authorisation and entitlements (use permissions), and "login method" (`PHONE_OTP_LOGIN` in v1 is core, not a rollout) |

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `kill.signups` | Kill switch | on | Stop new accounts during abuse |
| `kill.otp` | Kill switch | on | Disable OTP sending (SMS outage / pumping attack); enables Google sign-in banner |
| `kill.bookings` | Kill switch | on | Stop new holds (venue outage, payment incident) |
| `kill.payments` | Kill switch | on | Stop order creation |
| `phase2.matchmaking`, `phase2.communities`, `phase2.reliability`, `phase2.achievements`, `phase2.promotions` | Phase | off | Phase-2 features, enabled per cohort after Phase-1 metrics are met |
| `phase3.subscriptions`, `phase3.tournaments`, `expansion.sports`, `expansion.cities` | Phase | off | Phase 3 |
| `exp.*` | Experiment | – | A/B tests, PostHog-evaluated |

## 7. Observability

### 7.1 Signals

- **Logs** (Axiom): structured JSON; `requestId`, `route/procedure`, `durationMs`, `outcome`, hashed `userId`; **no PII** (02 §7).
- **Errors** (Sentry): server and client; scrub bodies/cookies; release tagging; source maps uploaded privately.
- **Metrics:** latency per procedure, error rates, webhook lag, job success rate, outbox backlog, hold→confirm conversion, payment success rate, OTP sent→verified ratio, SMS spend.
- **Product analytics** (PostHog): event dictionary in [01 §7](./01-product-requirements.md); no PII in properties.
- **Synthetic probe:** every 5 minutes from India, a script performs signup (test number) → availability → hold → release against **staging**, and a read-only availability probe against **production**.

### 7.2 Alerts

| Alert | Condition | Severity | Runbook |
|---|---|---|---|
| Payment stuck | Any `PAYMENT_PENDING` older than 15 min, or `INITIATED` older than 30 min | SEV-2 | R1 |
| Reconciliation mismatch | Any row from 03 §7.3 queries | **SEV-1** | R1 / R2 |
| Double-booking attempt reaching the constraint at an abnormal rate | `23P01` > 20 / 10 min | SEV-3 (informational: constraint working) | – |
| Webhook failures | Any `webhook_events.status = FAILED` older than 30 min | SEV-2 | R3 |
| Webhook silence | No Razorpay event for > 60 min during active hours | SEV-2 | R3 |
| OTP failure | Send failure > 5 % over 10 min; or sent→verified < 40 % (possible pumping) | SEV-2 | R4 |
| SMS spend | > 2× trailing 7-day daily average | SEV-2 | R4 |
| Outbox backlog | `PENDING` older than 10 min > 20 rows | SEV-2 | – |
| Error rate | 5xx > 2 % for 5 min | SEV-2 | R5 (rollback) |
| Latency | `venue.getAvailability` p95 > 600 ms for 10 min | SEV-3 | – |
| Refund failure | Any `Refund` `FAILED`, or `INITIATED` > 2 h | SEV-2 | R6 |
| Database | Connection errors, pooler saturation, storage > 80 % | SEV-2 | R5 |
| Cert/domain/keys | Expiry within 14 days | SEV-3 | – |

For a solo operator, route SEV-1/2 to a phone push/SMS channel and SEV-3 to a daily digest; state expected response times honestly ("SEV-2 within 2 hours, 08:00–23:00 IST").

### 7.3 Business and unit-economics metrics (from day one)

Computed nightly into an admin view: registered users, MAU, games created/joined/completed, **join rate = joiners ÷ eligible game viewers** (01 §6), bookings (paid and fulfilled), GMV, platform revenue, payment cost, refund and chargeback cost, **contribution per booking** (product plan §7.9 formula), cancellation and refund rates, venue activation (approved → first fulfilled booking), supply/demand by day-part.

## 8. Runbooks

Each runbook follows: **When · Check · Act · Verify · Escalate.**

**R1 — Payment taken but booking not confirmed / stuck `PAYMENT_PENDING`**
*When:* alert, or a player reports "money debited, no booking".
*Check:* admin → payments → search by order/payment ID; `webhook_events` for the order; Razorpay dashboard payment status.
*Act:* (a) Captured at Razorpay and webhook missing → "Reconcile" (calls `confirmPayment(source:'reconcile')`). (b) Webhook `FAILED` → read the error, fix, **Replay** (idempotent). (c) Booking `EXPIRED` and slot taken → system already refunds; confirm `Refund` exists, else issue full refund (reason `SLOT_UNAVAILABLE`). (d) Not captured → tell the player the bank will auto-reverse authorised-only payments; do not confirm.
*Verify:* booking state and receipt; integrity queries return zero rows.
*Escalate:* repeated failures → SEV-1, activate `kill.payments`.

**R2 — "Double booking" reported (should be impossible)**
Treat as SEV-1. Check: query both bookings; confirm statuses (one may be `EXPIRED`/`CANCELLED`). If two live bookings truly overlap, the constraint is missing/disabled: **stop bookings (`kill.bookings`)**, re-apply `0002_integrity`, inspect migration history, then compensate the affected player (full refund + goodwill) and notify the venue. Postmortem within 48 h.

**R3 — Razorpay webhook outage or backlog**
Check Razorpay webhook dashboard (delivery attempts), Vercel logs for 4xx/5xx, `webhook_events`. If our endpoint is failing: fix/rollback, then Razorpay retries automatically; replay failed events from admin. If Razorpay is not sending: rely on `payment.reconcile` (runs T+10 min and hourly) and run it manually for pending payments. Tell affected players confirmations may be delayed.

**R4 — OTP not delivering / suspected SMS pumping**
Check provider dashboard (delivery reports, DLT rejections, spend), sent→verified ratio, top destination prefixes/IPs. Act: enable `kill.otp` if spend spikes; block offending prefixes/IPs; confirm the DLT template is still approved; switch to Google sign-in fallback banner. After recovery, add detection for the pattern.

**R5 — Bad deploy or bad migration**
*Bad deploy:* Vercel → instant rollback to the previous deployment; confirm health; open an incident note. *Bad migration:* additive migrations should not break the previous build; if data is damaged, create a **Neon branch from a timestamp before the migration**, verify, then promote or copy back the affected tables (do not restore over production blindly). **Restore drill (quarterly):** restore PITR to a branch, run integrity queries and a smoke test, record elapsed time against the RTO in 02 §12.

**R6 — Refund failed or stuck**
Check `Refund` row, Razorpay refund status, payment captured amount (cannot refund more than captured). Re-issue via admin (same idempotency key so it cannot duplicate); if Razorpay rejects, contact support with the refund/payment IDs; keep the player informed; booking stays `REFUND_PENDING` until `processed`.

**R7 — Venue cancels or the court is unavailable on the day**
Support uses `admin.bookings.cancel` (or the venue uses `venuePortal.cancelBooking`) with reason; the system issues 100 % refund incl. fee and reverses the transfer; offer the player alternative slots at other venues; record a venue reliability note; two incidents in 30 days → account-management call.

**R8 — Secret leak or suspected compromise**
Rotate the affected secret (Razorpay keys, webhook secret, MSG91, DB credentials, `AUTH_SECRET` — rotating the latter signs everyone out), redeploy, review audit logs and provider logs for misuse, notify per 07 §7, write a postmortem.

## 9. Support and on-call (minimum viable)

- One public support channel (email + WhatsApp Business number) and an in-app "Report a problem" that attaches the request ID.
- A macros document for: payment issues (R1), cancellation/refund questions, venue disputes (R7), account issues, safety reports.
- Weekly review of: support tickets by category, refund reasons, no-show disputes, venue complaints — feed the backlog.

## 10. Changes from v1

| v1 | v2 |
|---|---|
| Client-side PostHog flags as the gating mechanism | Server-evaluated registry; kill switches; fail closed; `FEATURE_DISABLED` |
| CI without a database, migrations or app server | Service container, migrate+seed, build+start for E2E, CodeQL, audit |
| Node 20 | Node LTS (22/24) |
| One concurrency test using an unseeded court | 15-item test catalogue with launch gates |
| E2E that "verifies Razorpay modal is primed" | E2E to payment sheet + signed-webhook simulation for confirmation |
| No alerts, runbooks, drills | Alert table, 8 runbooks, restore drill |
| No definition of done | PR checklist |
