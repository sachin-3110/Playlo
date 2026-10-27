# BUILD PLAN — ordered, small, resumable tasks

How to use: take the task in `STATUS.md → Current`. Read only its **Refs**. Done = the **Done when** line passes. Tick `[x]`, commit, update STATUS. Tasks are ordered; each is ~½–1 day. Reuse code from `docs/_verification/`. Defaults for open items: `docs/12`.

Refs shorthand: `D03§5.1` = `docs/03-data-model.md` §5.1, etc. `V:` = file under `docs/_verification/`.

## Phase 0 — Foundations (Sprint 0)
- [ ] **B0-01** Monorepo: pnpm + Turborepo, `apps/web` (Next.js, TS, Tailwind v4), `packages/{db,api,auth,validators,domain,ui,config,logger}`, ESLint/TS configs, `.env.example`, fill the Commands block in AGENTS.md. Refs: D02§5. Done when: `pnpm dev` serves a page; `pnpm turbo run lint typecheck` green.
- [ ] **B0-02** Copy `V:domain/*` → `packages/domain` (+ tests, run with Vitest), `V:validators` → `packages/validators`. Done when: all 23 tests pass in the monorepo.
- [ ] **B0-03** `packages/db`: `V:prisma/schema.prisma`; Docker Compose Postgres (`postgis/postgis:16-3.4`); migration `0001_init` (prepend the two sequences) + `0002_integrity` from `V:sql/integrity.sql`. Refs: D03§4.1. Done when: `migrate deploy` works on fresh DB and `V:sql` checks pass against real Postgres.
- [ ] **B0-04** Seed script (idempotent, refuses production). Refs: D03§9. Done when: 2 venues, 10 players, 4 games seeded.
- [ ] **B0-05** CI: copy `V:workflows/ci.yml` to `.github/workflows/`. Done when: PR runs green.
- [ ] **B0-06** Config: Zod env schemas, logger (JSON, requestId, no PII), flags registry (kill switches). Refs: D02§7, D08§6.
- [ ] **B0-07** tRPC setup: context, `publicProcedure/authedProcedure/adminProcedure/venueProcedure`, rate-limit policies (Upstash), error mapping. Refs: D04§2,§5,§8. Done when: unit tests for ratelimit + authz middleware.
- [ ] **B0-08** Auth spike + implementation: phone OTP (dev fixed OTP outside prod), session, `user.me`. Contract in D04§7; decide library per ADR-004 (lean Better Auth). Done when: login works locally; note choice in STATUS.
- [ ] **B0-09** Design tokens + base UI (Button, Input, Card, Dialog, Sheet, Skeleton, Toast) using tokens. Refs: D06§3,§5. Done when: axe clean on a demo page.
- [ ] **B0-10** i18n scaffold (`next-intl`, en + hi, Devanagari font). Refs: D06§8.
- [ ] **B0-11** Spikes S1–S7 as far as possible locally; record results in STATUS (1 line each). Refs: D09§5.2.

## Phase 1a — Games-first (no payments)
**Identity & profile**
- [ ] **B1-01** Middleware: security headers, nonce CSP (report-only), noindex for private paths, origin check. Refs: D07§3.3.
- [ ] **B1-02** Consent + 18+ declaration screens, `ConsentRecord`. AC-01, AUTH-05.
- [ ] **B1-03** Onboarding flow (6 steps, skippable), coarse location rounding. Refs: D01 ONB-01.
- [ ] **B1-04** Profile + settings (privacy, language, notifications), block/report. PRF-*, ACC-03.
- [ ] **B1-05** Account deletion/anonymisation + data export. D03§8, AC-16.

**Games**
- [ ] **B1-06** `game.create` (+ `CreateGameSchema`, shareCode, host participant row). AC-03.
- [ ] **B1-07** `game.list` filters + cursor pagination + UI list with all states. GAM-01.
- [ ] **B1-08** Game detail page + `game.getById`. GAM-02.
- [ ] **B1-09** Atomic `joinGame` / `leaveGame` / waitlist promotion (copy SQL from D05§3.2). Tests **T-05**, AC-04/05/06.
- [ ] **B1-10** Approval joins: request / approve / decline / remove. GAM-05/06.
- [ ] **B1-11** Host tools: edit (notify), confirm, cancel (reason), complete. State machine D03§6.2.
- [ ] **B1-12** My Games tabs. GAM-07.
- [ ] **B1-13** Attendance marking + defaults job. GAM-08, P-08.
- [ ] **B1-14** Create-game UI (stepper) incl. venue picker / custom location. GAM-03.

**Sharing, notifications, jobs**
- [ ] **B1-15** Public `/g/[code]` page, OG image, noindex, no PII. AC-07/08. D05§8.
- [ ] **B1-16** WhatsApp share sheet. SHR-02.
- [ ] **B1-17** Outbox table dispatcher + QStash verified job endpoints. D02§8.
- [ ] **B1-18** Notifications: in-app list + SMS adapter (MSG91, dev stub) + reminder T-2h. Matrix D05§9. NTF-*.
- [ ] **B1-19** Web push (FCM) + PWA manifest/SW under `/app/`. D06§7.

**Venues (directory) & admin-lite**
- [ ] **B1-20** Venue directory: `venue.searchNearby` (D03§7.2 SQL — run it, Spike S3), `getBySlug`, UI, lead-click event. VEN-01..03.
- [ ] **B1-21** Admin shell + 2FA for admin roles; venue create/edit on owners' behalf (courts, hours, prices) + review queue. ADM-01, VPT-01.
- [ ] **B1-22** Admin: users search/suspend (reason + notify), reports moderation, audit viewer, config editor. ADM-02/03/05/06. AC-15.
- [ ] **B1-23** Analytics events (D01§7) with consent gate.

**Public site & hardening**
- [ ] **B1-24** Marketing pages (Home, How it works, Players, Venue partners, Help, Contact, Legal placeholders). PLT-03.
- [ ] **B1-25** E2E (Playwright + axe): login → list → create → share → join. AC-18.
- [ ] **B1-26** Security pass: IDOR matrix **T-09**, OTP/rate-limit **T-10**, enforce CSP. D07§8.
- [ ] **B1-27** Perf/a11y pass vs budgets D06§10; offline behaviour AC-17.
- [ ] **B1-28** Launch checklist 1a (D09§7); alerts + synthetic probe (D08§7).

**Gate:** pilot metrics (D09§6) before Phase 1b.

## Phase 1b — Booking & payments
- [ ] **B2-01** Availability service: load rules + live bookings → `computeDaySlots`; `venue.getAvailability`. D05§4.
- [ ] **B2-02** `initiateHold` per D05§2.1 incl. lazy expiry + court lock. Test **T-01** on real Postgres (20 parallel).
- [ ] **B2-03** `PlatformConfig` pricing + `booking.quote` using `calculateFees`.
- [ ] **B2-04** `payment.createOrder` (Razorpay order; Route transfer or manual-payout mode). Spike S7.
- [ ] **B2-05** `confirmPayment()` D05§2.4 + webhook inbox route + client `payment.verify`. Tests **T-02, T-03, T-04, T-06**.
- [ ] **B2-06** Jobs: `booking.expire`, `payment.reconcile`, `booking.complete`. **T-08, T-12**.
- [ ] **B2-07** Cancellation + refunds with `computeRefund`, transfer reversal, `booking.previewCancellation`. **T-07**. AC-12/13.
- [ ] **B2-08** Booking UI: slot picker, hold countdown, itemised checkout, confirmation, my bookings, payments/receipts. BKG-*.
- [ ] **B2-09** Link booking↔game. BKG-07.
- [ ] **B2-10** Venue portal: register/KYC docs (private bucket), courts/schedule/pricing editors, calendar (+offline-booking blocks), bookings list/cancel, dashboard. VPT-02..07. AC-14.
- [ ] **B2-11** Admin: bookings, payments, refunds, reconcile, webhook replay. ADM-04.
- [ ] **B2-12** Nightly integrity queries D03§7.3 + alerts + runbooks wired. D08§7–8.
- [ ] **B2-13** Pricing/fees page; legal refund/cancellation pages live.
- [ ] **B2-14** Launch checklist 1b + external pen test (D09§7).

## Phase 2 (only after gate) — retention
Recurring games · player matching (D05§7) · communities · reliability score + disputes (D05§6.2, uses `V:domain/reliability.ts`) · reviews · achievements · venue promotions/customers · referrals · extra public pages. Break into B3-xx tasks when starting; flags `phase2.*`.

## Phase 3 (only after gate) — monetisation & scale
Venue subscriptions/billing · tournaments · analytics · more sports/cities · fraud/reconciliation tooling. Break into B4-xx when starting; flags `phase3.*`.

## Parking lot (not now)
Wallets, on-platform fee splitting, in-app chat, AI recommendations, social feed, leagues.
