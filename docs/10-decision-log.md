# 10 · Decision Log (ADRs)

| | |
|---|---|
| **Status** | v2.0 — records every significant architectural and product-engineering decision, including ones **changed from v1** |
| **Audience** | Anyone asking "why is it built this way?" or considering changing it |
| **Format** | Lightweight Architecture Decision Records: context → decision → consequences → alternatives → when to revisit |
| **Related** | [00-start-here](./00-start-here.md) · [11-audit-report](./11-audit-report.md) · [12-open-items](./12-open-items.md) |

**Status values.** **Accepted** — settled in v1 and retained. **Amended** — settled in v1 and *changed* in v2 (the v1 owner should confirm). **Proposed** — new in v2; needs owner sign-off or a spike. Items marked ◆ need the **owner's decision before the documents are handed over.**

| ADR | Decision | Status |
|---|---|---|
| 001 | Modular monolith on Next.js + tRPC + Postgres | Accepted |
| 002 ◆ | One deployable web app with route groups (not four apps) | Amended |
| 003 ◆ | Neon Postgres in Singapore, functions co-located; spike before commit | Amended |
| 004 ◆ | Auth library chosen by Sprint-0 spike; contract fixed | Proposed |
| 005 | Double-booking prevention: constraint + court lock + soft hold | Amended |
| 006 | Integer paise, one fee module, configuration and snapshots | Amended |
| 007 | Provider-authoritative payment confirmation through one idempotent function | Accepted (formalised) |
| 008 | Games and bookings are decoupled | Accepted |
| 009 | Reliability: descriptive in Phase 1, windowed score in Phase 2 | Amended |
| 010 ◆ | Game fees are informational and off-platform in Phase 1 | Proposed |
| 011 | Feature flags evaluated server-side; kill switches; fail closed | Amended |
| 012 | Coarse location only | Proposed |
| 013 | Time: `timestamptz` UTC, IST rules as minutes, half-open intervals | Proposed |
| 014 | Availability computed from rules, not stored as slots | Amended |
| 015 ◆ | 18+ only at launch | Proposed |
| 016 | Transactional outbox for jobs and notifications | Proposed |
| 017 ◆ | Staged Phase 1: games-first (1a), booking and payments (1b) | Proposed |
| 018 | Public, non-indexed share page for every game | Proposed |
| 019 ◆ | Settlement via Razorpay Route with a manual-payout fallback | Proposed |

---

## ADR-001 · Modular monolith

**Status:** Accepted.
**Context.** One to three engineers, a transactional domain (bookings, payments, capacity) and a need for shared types and one deploy to roll back.
**Decision.** A single TypeScript codebase (Next.js App Router, tRPC v11, Prisma, Postgres) organised as internal packages with enforced dependency directions (02 §5). No microservices, no Kubernetes; managed serverless components (Vercel, Neon, Upstash).
**Consequences.** Simple operations and strong consistency; the monolith's modules must stay disciplined. Serverless connection limits require the pooler (02 §4.1).
**Alternatives.** Microservices (operational cost with no benefit at this scale); a separate API service (extra deploy and auth surface).
**Revisit when.** A module needs independent scaling or a separate team owns it.

## ADR-002 · One deployable app, not four ◆

**Status:** Amended (v1: `apps/web`, `apps/player`, `apps/venue`, `apps/admin`).
**Context.** v1 planned four Next.js apps behind one domain with path-prefix routing (`/app`, `/venue`, `/admin`). Costs: four builds and deployments, subpath routing/rewrites or multi-zones, per-app `basePath`/asset prefixes, a service worker scope problem, duplicated middleware, one webhook endpoint per app, and four places for cookies and CSP to drift. Benefits at current scale: nearly none — route groups already give separation, and code-splitting keeps admin code out of player bundles.
**Decision.** One app `apps/web` with route groups `(marketing)`, `app`, `venue`, `admin`, `g/[code]`, and one tRPC endpoint. Keep the Turborepo `packages/*` split so extraction later is mechanical.
**Consequences.** One deploy, one cookie origin, one middleware, one webhook endpoint; simpler CI. A deploy of any surface redeploys all (acceptable); stricter isolation of admin must come from authorisation and 2FA rather than separate hosting.
**Alternatives.** Four apps (v1); multi-zone (extra complexity); separate admin host (revisit when needed).
**Revisit when.** Venue portal needs a separate release cadence, a separate team owns admin, or bundle/isolation requirements justify it.

## ADR-003 · Database provider and region ◆

**Status:** Amended (v1: Neon in `ap-south-1` Mumbai).
**Context.** Neon's published region list (checked October 2026) has **no Mumbai region**; nearest is Singapore (`aws-ap-southeast-1`). v1's "sub-15 ms to Vercel Mumbai" and Mumbai-region claims cannot hold. Serverless Postgres plus ~6 queries per booking transaction makes DB-to-function latency matter more than user-to-region latency.
**Decision.** Use Neon in Singapore and pin Vercel functions to the nearest Singapore region so function↔DB hops stay in-region. Treat this as provisional until **Spike S1** (09 §5.2) measures p95 from Sirsa.
**Consequences.** Users pay roughly one extra round-trip to Singapore (tens of ms); DB hops remain ~1–3 ms. Data is stored outside India — check against DPDP cross-border provisions and any venue/payment data-localisation expectations with counsel (open item L-06).
**Alternatives.** Mumbai-hosted managed Postgres (e.g., a provider with an `ap-south-1` region or AWS RDS/Aurora Mumbai) — lower user latency and clearer data residency, higher cost/ops; Prisma/SQL are portable so migration cost is low.
**Revisit when.** Spike S1 fails the latency target, counsel requires in-country storage, or Neon adds an India region.

## ADR-004 · Authentication library and session strategy ◆

**Status:** Proposed.
**Context.** v1 chose NextAuth/Auth.js v5 with a phone-OTP credentials flow. As of this review Auth.js is maintained by the Better Auth team in security-patch mode, and v5 remains a beta release line; Credentials-based flows in Auth.js also constrain you to JWT sessions. v1 additionally exposed OTP as tRPC procedures, which duplicates session ownership.
**Decision.** Fix the **contract** (04 §7: OTP send/verify endpoints, cookie session, session version for revocation, platform-role claims) and choose the library in **Spike S5**, with a bias to **Better Auth** (actively developed, has a phone-number/OTP plugin, database sessions) unless the spike finds blockers. Isolate it behind `packages/auth` so replacing it is local.
**Consequences.** One owner of sessions; OTP logic (hashing, attempts, cooldown) is ours regardless of library; revocation is simple with database sessions or a `sessionVersion` claim.
**Alternatives.** Auth.js v5 beta (works but upstream in maintenance); custom minimal session layer (more security surface to own); a hosted provider such as Clerk (cost, phone-OTP DLT support, vendor lock-in).
**Revisit when.** The spike fails; the library changes licence/direction; a native app needs token-based auth.

## ADR-005 · Double-booking prevention

**Status:** Amended (v1: Redis hold + transaction with "`SELECT … FOR UPDATE`"/advisory lock).
**Context.** v1's application-level checks ignored `PENDING` and `IN_PROGRESS` bookings, used an overflowing advisory-lock key and never actually locked rows, so a lapsed Redis hold could allow two live bookings. Redis alone cannot be the guarantee (eviction, outage, TTL skew).
**Decision.** Three tiers, with the database authoritative: (1) **PostgreSQL exclusion constraint** `bookings_no_overlap` over `(courtId, tstzrange(start,end,'[)'))` for statuses `PENDING, PAYMENT_PENDING, CONFIRMED, COMPLETED`; (2) a per-court **advisory transaction lock** (`hashtextextended(courtId,0)`) to serialise lazy hold-expiry plus insert and yield clean errors; (3) an optional **Redis soft hold** purely for instant "someone is checking out" feedback. Lock-ordering rule in 05 §2.1.
**Consequences.** Correctness no longer depends on Redis or on every developer remembering a check; the constraint is not expressible in Prisma (hand-written migration, 03 §5.1 — verified by tests); constraint violations map to `SLOT_UNAVAILABLE`.
**Alternatives.** Serializable isolation (retries and complexity); materialised slot rows with a unique key (fixed grid only, extra jobs); Redis-only locks (rejected).
**Revisit when.** Variable-length/overlapping resource types appear (the range constraint already supports them).

## ADR-006 · Money

**Status:** Amended.
**Context.** Integer paise was a good v1 decision; v1 then had three incompatible fee models and hard-coded amounts.
**Decision.** Integer paise (`Int`) everywhere; all calculation in `packages/domain/fees.ts`; defaults held in `PlatformConfig`; every booking stores an **immutable snapshot** of every component plus the config version; DB CHECK constraints assert the accounting identities. The default model is in 05 §2.2.
**Consequences.** Auditable history even when pricing changes; any model change touches one module. Tax treatment must be confirmed by a CA (open item F-02).
**Alternatives.** Decimal types (more error-prone); floats (rejected).
**Revisit when.** Multi-currency, tax-inclusive pricing for venues, or venue-funded discounts are introduced.

## ADR-007 · Payment confirmation is provider-authoritative and idempotent

**Status:** Accepted (v1 principle), formalised.
**Context.** Product rule: a redirect or click is not a payment. v1's webhook updated unconditionally.
**Decision.** One `confirmPayment()` reached by the webhook, the client verify call and the reconciliation job; verifies amount and currency; handles late payments with auto-refund; webhook inbox dedupes events; constant-time signature checks (05 §2.4).
**Consequences.** Any order or repetition of the three triggers converges; more code than the naïve version, but every branch is testable (T-02…T-04, T-06, T-12).
**Revisit when.** Adding another payment provider (extract an interface).

## ADR-008 · Games and bookings are decoupled

**Status:** Accepted.
**Decision.** Separate tables and state machines; optional `Game.bookingId`/`venueId`; "confirmed court" is `bookingId != null`. Cancelling a game never auto-cancels a booking.
**Consequences.** Supports casual park games and private bookings; requires UI to distinguish *proposed* from *confirmed* location.

## ADR-009 · Reliability

**Status:** Amended.
**Context.** v1's `100 − 25·no-shows − 10·late-cancels + 2·games` is lifetime-cumulative, order-insensitive, unfair to small samples, and auto-restricted users — contrary to the product plan's principles.
**Decision.** Phase 1: descriptive facts only, no stored score, no automatic restriction. Phase 2: a smoothed attendance ratio over the last 20 counted outcomes (05 §6.2), `NEW` tier until 5 outcomes, restrictions only as reviewed, appealable moderator actions.
**Consequences.** Forgivable, explainable, harder to game; needs a dispute workflow before the score is shown.
**Revisit when.** Phase-2 data shows the formula mis-ranks players; consider weighting recency within the window.

## ADR-010 · Game fees are informational and off-platform in Phase 1 ◆

**Status:** Proposed.
**Context.** v1's schema had `costPerPlayerPaise` and `hasPaid` but `Payment` required a booking, so there was no payment path for per-player fees; adding player-to-player collection means more Route flows, refunds, disputes and regulatory surface.
**Decision.** In Phase 1 the fee on a game is a **note** ("₹100 per player, pay the host") with a host-side "marked paid" tick; the only money Playlo processes is the court booking. On-platform splitting is revisited in Phase 2/3.
**Consequences.** Smaller scope and risk; hosts still carry collection friction (they do today). Booker-pays-then-shares is the common real-world pattern.
**Alternatives.** On-platform split now (large scope); UPI deep-link request to host (possible Phase 1.5).
**Revisit when.** Hosts consistently report collection as their top pain.

## ADR-011 · Feature flags

**Status:** Amended.
**Decision.** Server-side evaluation, typed registry, Edge Config/env for kill switches, PostHog for experiments, fail closed, `FEATURE_DISABLED` from gated procedures (08 §6).
**Consequences.** Cannot be bypassed from the client; no flicker; works when ad-blockers block analytics.

## ADR-012 · Coarse location only

**Status:** Proposed.
**Decision.** Profiles store approximate coordinates rounded to ~1 km (or a neighbourhood centroid); exact coordinates are used transiently in a request and not stored. Venue locations are precise (public business addresses).
**Consequences.** Reduces privacy risk and DPDP exposure; distance is approximate for players.

## ADR-013 · Time handling

**Status:** Proposed.
**Decision.** `timestamptz(3)` in UTC for instants; half-open intervals; recurring business rules stored as ISO weekday + minutes after local midnight in `Asia/Kolkata`; all conversion in `packages/domain/availability.ts`; client timestamps must include an offset.
**Consequences.** No off-by-5.5-hours bugs; India has no DST so a constant offset is correct, but the module is the only place that may assume this — revisit before any non-IST market.

## ADR-014 · Availability is computed from rules

**Status:** Amended (v1 had both a slot table and hard-coded hours).
**Decision.** `CourtSchedule`, `PricingRule`, `CourtBlock` + live bookings → computed grid (03 §3.1, 05 §4). Drop `AvailabilitySlot`.
**Consequences.** Rule edits apply immediately; no generation jobs; pricing per slot is derived and then snapshotted on the booking.

## ADR-015 · 18+ only at launch ◆

**Status:** Proposed.
**Context.** The DPDP Rules impose verifiable parental consent for children's data; badminton has many under-18 players, so this is a real product trade-off.
**Decision.** Launch for adults only with age self-declaration (`ageConfirmedAt`); revisit with counsel for a guardian-managed flow.
**Consequences.** Excludes minors (and junior academies) initially; avoids children's-data obligations at launch.
**Revisit when.** Demand from academies/schools or counsel confirms a workable guardian flow.

## ADR-016 · Transactional outbox

**Status:** Proposed.
**Decision.** Jobs and notifications are written to `OutboxJob` inside business transactions and dispatched to QStash after commit, with a sweeper (02 §8).
**Consequences.** No lost or phantom jobs; an extra table and dispatcher.

## ADR-017 · Staged Phase 1 ◆

**Status:** Proposed.
**Context.** The riskiest component (money plus inventory) is also the one least needed to test whether players want to play together; v1's 7-week plan covered a quarter of its own scope.
**Decision.** Release **1a (games-first, no payments)** before **1b (booking and payments)**, gated on evidence (09 §3, §6).
**Consequences.** Earlier real users and learning; deferred payment compliance. The data model already supports 1b.
**Alternatives.** Full Phase 1 at once (valid if venues will only engage with online booking, but plan for 7–9 months).

## ADR-018 · Public share page

**Status:** Proposed.
**Decision.** `/g/{shareCode}` is server-rendered, `noindex`, with Open Graph metadata and no personal data; private games show a generic card. (05 §8.)
**Consequences.** Working WhatsApp previews and a login-free first touch; careful field whitelisting is required.

## ADR-019 · Settlement via Route with fallback ◆

**Status:** Proposed.
**Context.** Route approval and per-venue KYC have unpredictable lead times.
**Decision.** Implement the `Transfer` model so that settlement can be **Route-automated** or **platform-collected with manual weekly payout** without changing bookings or payments.
**Consequences.** Launch is not blocked by Route; finance must reconcile manually in the fallback.
**Revisit when.** Route is approved and stable.
