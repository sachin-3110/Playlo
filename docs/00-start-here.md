# 00 · Start Here

| | |
|---|---|
| **Document set** | Playlo Engineering & Product Handbook, **v2.0** |
| **Date** | 27 October 2026 |
| **Supersedes** | The v1 plan and six specifications (archived unchanged in [`_archive/`](./_archive/)) |
| **Basis** | Full review of v1, corrections applied, rewritten pieces verified by running them (see [11 §6](./11-audit-report.md)) |
| **Audience** | Anyone picking this project up: engineers, designers, product, finance/legal advisers, investors doing diligence |

---

## 1. Playlo in 60 seconds

**Playlo** (*Chalo Khelein*) helps people in **Sirsa, Haryana** find badminton games, organise sessions, and — in the second release — book courts and pay online. Players discover and join games; hosts fill seats and share a link in WhatsApp; venues fill empty hours; a small operations team keeps it safe.

**Hypothesis to prove first:** *we can consistently help badminton players in one city find reliable people to play with, while giving venues a measurable reason to participate.*

**How it is built:** one Next.js (TypeScript) app with route groups for the public site, the player PWA (`/app`), the venue portal (`/venue`) and the admin console (`/admin`); one tRPC API; one Postgres database (Neon) with PostGIS; Upstash Redis/QStash for rate limits and delayed jobs; Razorpay for payments and venue payouts; MSG91 for OTP SMS; Cloudflare R2 for images and KYC documents. Run by one to three engineers.

**Five rules that shape every design choice** (details in [05 §1](./05-business-logic.md)):

1. **The database guarantees no double bookings** — an exclusion constraint, not just application code.
2. **A booking is confirmed only by a verified provider payment**, through one idempotent function that handles late, duplicate and out-of-order events.
3. **Money is integer paise, calculated in one module and snapshotted** on every booking.
4. **Games and bookings are separate lifecycles.**
5. **Anything that restricts a person is reviewable, explainable and audited.**

## 2. Reading order by role

| If you are… | Read, in order | Time |
|---|---|---|
| **Owner / founder** | This page → [09 Delivery plan §3–§4](./09-delivery-plan.md) (scope options, lead-time work) → [12 Open items](./12-open-items.md) → [10 Decision log](./10-decision-log.md) (◆ items) → [11 Audit summary](./11-audit-report.md) | 45 min |
| **Engineering lead** | [02 Architecture](./02-architecture.md) → [03 Data model](./03-data-model.md) → [05 Business logic](./05-business-logic.md) → [04 API](./04-api-specification.md) → [08 Operations](./08-engineering-operations.md) → [09 §5.2 spikes](./09-delivery-plan.md) | 3 h |
| **Backend engineer** | 03 → 05 → 04 → 08 §5 (test catalogue) | 2–3 h |
| **Frontend engineer** | [01 Requirements §3, §5](./01-product-requirements.md) → [06 Frontend](./06-frontend-design-system.md) → 04 §4 | 2 h |
| **Designer** | 01 → 06 → [05 §8–§9](./05-business-logic.md) (share page, notifications) | 1.5 h |
| **QA / test** | 01 §5 (acceptance criteria) → 08 §5 → 07 §4, §8 | 1.5 h |
| **Finance / CA** | 05 §2.2–§2.6 → [07 §5](./07-security-privacy-compliance.md) (C1–C8) → 12 §2.2 | 1 h |
| **Legal / counsel** | 07 §5–§7 → 03 §8 → 01 §3.1 → 12 §2.3 | 1 h |
| **Ops / support** | 08 §7–§9 (alerts, runbooks, support) → 01 §2 | 1 h |
| **New engineer, day one** | [08 §2 quick start](./08-engineering-operations.md) → 02 §5 (repo layout) → 05 §1 (rules) | 30 min |

## 3. Document map

| # | Document | What it answers | Status |
|---|---|---|---|
| 00 | **Start here** (this page) | Where do I begin? What changed? What must the owner decide? | Complete |
| 01 | [Product requirements](./01-product-requirements.md) | What are we building, for whom, with what acceptance criteria and metrics? | Complete |
| 02 | [System architecture](./02-architecture.md) | Components, topology, conventions, non-functional targets, resilience, cost | Complete (cost figures unverified) |
| 03 | [Data model](./03-data-model.md) | Schema, database-enforced invariants, state machines, queries, retention | **Schema validated; SQL executed** |
| 04 | [API specification](./04-api-specification.md) | Procedures, permissions, rate limits, validation, errors, webhooks | **Validators tested**; middleware = reference |
| 05 | [Business logic](./05-business-logic.md) | Booking, fees, refunds, games, availability, reliability, sharing, notifications | **Domain code tested**; services = reference |
| 06 | [Frontend & design system](./06-frontend-design-system.md) | Tokens, components, states, PWA, i18n, accessibility, performance | Contrast **computed**; code = reference |
| 07 | [Security, privacy & compliance](./07-security-privacy-compliance.md) | Controls, threat model, India compliance checklist, incident response | Complete; legal items **[confirm]** |
| 08 | [Engineering operations](./08-engineering-operations.md) | Environments, CI/CD, test catalogue, flags, alerts, runbooks | CI YAML **parsed**; rest specification |
| 09 | [Delivery plan](./09-delivery-plan.md) | Effort, scope options, timeline, spikes, gates, risks | Estimates are ranges |
| 10 | [Decision log](./10-decision-log.md) | Why each major decision was made; what changed from v1 | Complete |
| 11 | [Audit report](./11-audit-report.md) | What was wrong or missing in v1, severity, fix, how verified | Complete |
| 12 | [Open items](./12-open-items.md) | Everything undecided or unverified, with owner and default | Living register |

## 4. Decisions the owner should confirm before hand-over ◆

v1 recorded a set of decisions. This review **changed or added** some; the engineering team will build to the defaults below unless told otherwise. Full reasoning is in the [decision log](./10-decision-log.md).

| ADR | Change | Default | Why you might disagree |
|---|---|---|---|
| **017** Staged release | Ship **games-first (1a)** before **booking + payments (1b)** | Option A | You believe venues will only engage if online booking exists from day one → choose Option B and plan **7–9 months**, not 7 weeks |
| **002** One app | Single deployable with route groups instead of four apps | One app | You need separate hosting/teams for admin or venue portal now |
| **003** Database region | **Neon has no Mumbai region**; use Singapore pending a latency spike | Neon Singapore | Data must stay in India → use a Mumbai-hosted Postgres |
| **004** Auth library | Auth.js v5 is in maintenance; choose by spike, lean Better Auth | Spike S5 | You prefer a hosted identity provider |
| **010** Game fees | Per-player fees are informational and settled off-platform in Phase 1 | Off-platform | You want on-platform cost splitting at launch (adds weeks and compliance) |
| **015** Age | Adults (18+) only at launch | 18+ | You need junior/academy players from day one (needs a guardian-consent flow) |
| **019** Settlement | Route automated settlement **with** a manual-payout fallback | Both supported | Route is approved early and you want to skip the fallback |

Also expect the owner's input on pricing hypotheses (fee ₹20, commission 10 %) and refund tiers — tracked in [12](./12-open-items.md).

## 5. What changed from v1 — the ten that matter

1. Database now **forbids** overlapping bookings (v1's checks could be bypassed).
2. Payment confirmation rewritten: late, duplicate, replayed and forged events handled; refunds automatic when a slot can't be given.
3. Venue-scoped authorisation (v1 let any venue owner act on any venue); rate limiting on the SMS endpoint.
4. One fee model with tested accounting identities (v1 had three).
5. Availability computed from venue rules (hours, price bands, blocks) instead of two conflicting designs.
6. Realistic plan: **28–39 weeks** for full Phase 1; staged release recommended; lead-time work (DLT, Route, legal) made explicit.
7. India compliance added: DLT SMS, GST/TDS questions, DPDP Act timeline, venue agreement, breach process.
8. Accessibility: brand colours re-assigned so text passes WCAG AA; Devanagari font added.
9. Public share page so WhatsApp links preview and don't hit a login wall.
10. Verification: schema validated, SQL/domain/validators executed, CI parsed; unverified items listed explicitly.

## 6. Conventions used in these documents

| Convention | Meaning |
|---|---|
| **Release labels** | **1a** games-first · **1b** booking and payments · **2** retention · **3** monetisation ([09](./09-delivery-plan.md)) |
| **Priorities** | **Must / Should / Could** |
| **IDs** | Requirements `AUTH-01`, `GAM-04`…; acceptance `AC-05`; tests `T-01`…`T-15`; spikes `S1`–`S7`; compliance `C1`–`C12`; findings `C-/H-/M-/L-`; ADRs `ADR-001`…; open items `P-/F-/L-/S-/B-/O-`; runbooks `R1`–`R8` |
| **Code blocks** | *Executable & tested* (domain, validators, SQL, CI YAML — noted in each document's header) vs *reference implementation* (service-layer sketches that define the algorithm but have not been run against a database) |
| **◆** | Needs an owner decision |
| **[confirm]** | A legal/tax statement to verify with counsel or a chartered accountant |
| **Normative words** | "must" = required for correctness or safety; "should" = recommended; "may" = optional |
| **Money** | Always paise (integers); `₹423.60` = `42360` |
| **Time** | Stored in UTC; displayed in IST; intervals half-open `[start, end)` |

## 7. Verification summary

Run during the review and **reproducible with one command** — see [`_verification/`](./_verification/README.md) (`npm install && npm test`):

- Prisma schema (v6): **valid**.
- Integrity migration with the generated DDL on an embedded Postgres: **21 checks passed** (overlap rejection, adjacency, expiry, late-revival rejection, fee identities, atomic capacity, audit immutability).
- Domain logic: **16 tests passed**; validators: **7 tests passed**; CI workflow: **valid YAML**.
- **Not** verified: live multi-connection concurrency on Neon, PostGIS queries, Razorpay Route behaviour, vendor prices, tax/legal interpretation, and the service-layer reference code. These are scheduled as spikes and tracked in [11 §7](./11-audit-report.md) and [12](./12-open-items.md).

## 8. Keeping these documents alive

- **Docs live with code.** A PR that changes behaviour, a contract or a decision updates the relevant document in the same PR (part of the Definition of Done, [08 §3](./08-engineering-operations.md)).
- **Decisions:** add or amend an ADR in [10](./10-decision-log.md); never silently edit history — supersede with a new ADR.
- **Open items:** close them in [12](./12-open-items.md) with the decision, date and decider.
- **Findings:** new defects found later extend the audit numbering only if they reveal a *documentation* error; otherwise use the issue tracker.
- **Review cadence:** re-read 02, 05 and 07 at each phase gate ([09 §6](./09-delivery-plan.md)) and re-verify vendor facts (regions, prices, APIs, regulations) at least quarterly — several of them changed during this review's lifetime.
- **Ownership:** each document has one named maintainer (to be assigned by the owner).

## 9. Glossary

| Term | Meaning |
|---|---|
| **Booking** | A reservation of one court for one time interval, with a price snapshot and a payment |
| **Game** | A playing session organised by a player; may or may not use a booking |
| **Hold** | A 5-minute reservation of a slot while a player checks out |
| **Court / Venue** | A bookable playing area / the facility containing courts |
| **Slot** | One cell of a court's day grid (e.g. 60 minutes); computed, not stored |
| **Paise** | 1/100 rupee; all money is stored in paise |
| **Convenience fee** | Flat fee the player pays the platform, with GST |
| **Commission** | Share of the court price withheld from the venue's payout, with GST |
| **Route / linked account** | Razorpay's marketplace split-payment product and a venue's payout account in it |
| **Webhook / inbox** | A provider's server-to-server callback / our table that records each event once |
| **Idempotency key** | A client-generated ID that makes a retried request safe |
| **Exclusion constraint** | A Postgres rule preventing overlapping ranges in a table |
| **Outbox** | Jobs/notifications recorded inside a transaction and dispatched after commit |
| **DLT** | India's mandatory registry for commercial SMS senders and templates |
| **DPDP Act/Rules** | India's Digital Personal Data Protection Act 2023 and Rules 2025 |
| **IST** | Indian Standard Time, UTC+05:30, no daylight saving |
| **Eligible viewer / join rate** | The headline metric's denominator and result ([01 §6](./01-product-requirements.md)) |
| **Contribution per booking** | Platform revenue minus variable costs of a booking ([05 §2.3](./05-business-logic.md)) |
| **PWA** | Installable web app with a service worker |
| **ADR** | Architecture Decision Record |
