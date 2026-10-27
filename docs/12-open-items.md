# 12 · Open Items, Decisions & Placeholder Register

| | |
|---|---|
| **Status** | v2.0 — single register of everything still undecided or unverified. Replaces v1's "Appendix G: Placeholder checklist" and the scattered `[BRACKETED]` placeholders |
| **Audience** | Owner (to decide), engineering lead (to unblock), counsel and CA (to confirm) |
| **How to use** | Each item has an owner, a *needed-by* milestone from [09](./09-delivery-plan.md) and a **default** engineering will build against if no decision arrives, so work is never blocked. Update **Status** as items close; move closed items to the bottom |
| **Legend** | ◆ = blocks hand-over or a launch gate · Status: **Open**, **Proposed** (default exists, needs a yes), **Spike** (resolved by testing), **Decided** |

---

## 1. Decisions already made (from v1 and the owner's brief)

| Item | Decision |
|---|---|
| Product name and tagline | **Playlo — Chalo Khelein** |
| Launch market | **Sirsa, Haryana, India**; Indian mobile numbers; INR; IST |
| Launch sport | **Badminton** (futsal and others only after local supply and demand) |
| Payment provider | **Razorpay** (UPI and cards; Route for venue splits, subject to approval) |
| Login | **Phone OTP** (MSG91, DLT-registered); Google sign-in as fallback |
| Web push | Firebase Cloud Messaging |
| Platform | One role-based platform: Next.js, TypeScript, Postgres, Prisma, tRPC, Tailwind v4 (versions pinned in Sprint 0) |
| Money | Integer paise |
| Game/booking relationship | Decoupled lifecycles |
| Visual direction | Energetic, high-contrast, sporty; tokens in [06 §3](./06-frontend-design-system.md) (pending B-01 sign-off); Plus Jakarta Sans + Inter + Noto Sans Devanagari; Lucide icons |

## 2. Open items

### 2.1 Product

| ID | Item | Why it matters | Default if undecided | Owner | Needed by | Status |
|---|---|---|---|---|---|---|
| **P-01 ◆** | **Scope option:** A games-first (recommended), B full Phase 1, or C concierge ([09 §3](./09-delivery-plan.md); ADR-017) | Determines the whole calendar and what is built first | Option A | Founder | Before Sprint 1 | Open |
| P-02 | Stage-gate thresholds (join rate, attendance, repeat, games/week) | Defines when to build booking/Phase 2 | Suggested values in 09 §6 | Founder | End of 1a pilot | Proposed |
| P-03 | Convenience fee, commission rate, GST handling defaults | Revenue and price perception ([05 §2.2](./05-business-logic.md)) | ₹20 + 18 % GST; 10 % commission | Founder + CA | Before 1b | Proposed |
| P-04 | How much freedom venues have in cancellation policy | Player trust vs venue autonomy | Platform default tiers; venue overrides allowed within platform-set bounds (bounds to be decided) | Founder | Before 1b | Open |
| P-05 | Who bears payment-gateway fees (platform absorbs / part of the convenience fee / venue) | Unit economics | Platform absorbs | Founder + CA | Before 1b | Open |
| P-06 | Price display: show court price on lists, all-in total at checkout | Pricing FAQ; "are fees included in the displayed price?" | List shows court price "from"; checkout shows itemised total | Founder + design | Before 1b | Proposed |
| P-07 | Booking rule defaults: hold 5 min (+ bounded extension), min/max duration 1–2 h, advance 14 days | Behaviour and inventory | As stated | Founder | Before 1b | Proposed |
| P-08 | Attendance default: unmarked rows count as attended after 72 h unless disputed | Fairness to players vs host effort | As stated | Founder | Before 1a | Proposed |
| P-09 | Languages at launch: English only vs English + Hindi switched on | Effort and reach | English on, Hindi catalog at parity, switch on after native review | Founder | Before 1a | Proposed |
| P-10 ◆ | **Minors:** adults-only at launch (ADR-015) | Legal and safeguarding | 18+ only | Founder + counsel | Before 1a | Proposed |
| P-11 ◆ | **Game fees off-platform in Phase 1** (ADR-010) | Scope and regulatory surface | Informational note + host tick | Founder | Before 1a | Proposed |
| P-12 | Phase 3 monetisation parameters: player premium price/benefits, venue plan prices, tournament fee model, sponsorship, advertising | Deferred; do not guess | None — decide after Phase 1b data | Founder | Phase 3 | Deferred |

### 2.2 Finance and commercial

| ID | Item | Default | Owner | Needed by | Status |
|---|---|---|---|---|---|
| F-01 ◆ | Business entity, PAN, bank account | Per CA advice | Founder + CA | Week 0 | Open |
| **F-02 ◆** | **Tax treatment:** GST on convenience fee and commission; tax collection at source for facilitated supplies; TDS on venue payouts; invoice formats; venue GST status | Code is parameterised; defaults in 05 §2.2 | CA | Before 1b | Open |
| **F-03 ◆** | **Razorpay terms:** UPI/card pricing, Route fees and approval, settlement timing, on-hold options, disputes/chargebacks | Fallback: platform-collects + manual weekly payout | Founder | Application in Week 0–2 | Open |
| F-04 | Refund policy figures (24 h/12 h tiers) signed off | As in 05 §2.5 | Founder + counsel | Before 1b | Proposed |
| F-05 | Venue payout schedule (e.g., weekly) and commission invoicing | Weekly, net of commission and GST on commission | Founder + CA | Before 1b | Open |
| F-06 | Budget/runway for tools, legal, CA | – | Founder | Week 0 | Open |
| F-07 | Re-price the cost model with current vendor pricing and exchange rate ([02 §13](./02-architecture.md)) | v1 estimates | Lead | Sprint 0 | Open |

### 2.3 Legal and compliance

| ID | Item | Default | Owner | Needed by | Status |
|---|---|---|---|---|---|
| **L-01 ◆** | Legal documents drafted by counsel: Terms of Service, Privacy Policy, Refund Policy, Cancellation Policy, Community Guidelines, Cookie Policy | – | Counsel | Terms/Privacy/Guidelines before 1a; Refund/Cancellation before 1b | Open |
| **L-02 ◆** | **DPDP review:** notice and consent text, retention periods, breach process, processor agreements, children's data position (core duties apply ~13 May 2027) | 07 §6 design | Counsel | Before 1a | Open |
| L-03 | Confirm retention periods ([03 §8](./03-data-model.md)): financial ≥ 8 years, audit ≥ 3 years, KYC per law | As proposed | Counsel + CA | Before 1a | Proposed |
| L-04 | Venue agreement template (commercial terms, cancellation, settlement, data, KYC consent) | – | Counsel | Before first venue | Open |
| L-05 | Consumer/e-commerce obligations applicable to a marketplace; named grievance officer | Publish a grievance contact | Counsel | Before 1a | Open |
| L-06 | Data residency/cross-border position for storing data in Singapore ([ADR-003](./10-decision-log.md)) | Neon Singapore | Counsel | Before 1a | Open |
| L-07 | Liability, injury disclaimers; insurance for events | Terms + venue agreement language | Counsel | Before 1a | Open |
| L-08 | Cookie/analytics consent mechanism | Opt-in banner for optional analytics | Counsel + lead | Before 1a | Proposed |
| L-09 | Wallets/stored value — **not built** until a regulatory review | Not built | Counsel | Phase 3 | Deferred |

### 2.4 Technology and security

| ID | Item | Resolution | Owner | Needed by | Status |
|---|---|---|---|---|---|
| **S-01 ◆** | Auth library (Better Auth vs Auth.js v5) ([ADR-004](./10-decision-log.md)) | Spike S5 | Lead | Sprint 0 | Spike |
| S-02 | Verify exact CSP origins for Razorpay Checkout, PostHog, Sentry | Spike S6 | Lead | Sprint 0 | Spike |
| S-03 | Pin Prisma, Next.js, Node, Zod, tRPC majors; confirm migrations leave hand-written constraints intact | Spike S4 | Lead | Sprint 0 | Spike |
| **S-04 ◆** | Database region latency from Sirsa; fallback to Mumbai-hosted Postgres | Spike S1 | Lead | Sprint 0 | Spike |
| S-05 | Concurrency of the booking constraint on Neon via pooler; PostGIS query | Spikes S2, S3 | Lead | Sprint 0 | Spike |
| S-06 | Razorpay Route API parameters, reversal behaviour (sandbox) | Spike S7 | Lead | Before 1b | Spike |
| S-07 | Image pipeline: R2 + Next/Image vs Cloudflare Images | Pick in Sprint 0 | Lead | Sprint 0 | Open |
| S-08 | PostHog region (EU/US/self-host), consent gating | Pick with L-08 | Lead | Before 1a | Open |
| S-09 | Transactional email provider (receipts, venue notices) — `[EMAIL_PROVIDER]` | Any reputable provider (e.g., SES, Resend) | Lead | Before 1b | Open |
| S-10 | SMS: confirm MSG91, DLT templates; consider a secondary route | MSG91 | Lead | Week 0 | Open |
| S-11 | Alert delivery to a phone for SEV-1/2 ([08 §7.2](./08-engineering-operations.md)) | SMS/push to founder + lead | Lead | Before 1a | Open |
| S-12 | External penetration test vendor and date | Before opening paid bookings | Owner | Before 1b launch | Open |

### 2.5 Brand, design, content

| ID | Item | Default | Owner | Needed by | Status |
|---|---|---|---|---|---|
| B-01 | Logo, icon, and final brand colours | Token palette in 06 §3.1 | Founder + designer | Sprint 1 | Proposed |
| B-02 | Marketing copy: primary headline, hero description, problem statement, venue-owner headline, organiser headline, badminton headline, mission, vision | Draft from product plan | Founder | Before 1a | Open |
| B-03 | Photography/illustrations (courts, players) | Licensed or commissioned; no fabricated imagery | Designer | Before 1a | Open |
| B-04 | Hindi translations reviewed by a native speaker | Machine draft + review | Designer/native reviewer | Before enabling Hindi | Open |
| B-05 | Trademark search and domain security (`playlo.in`) | Do now | Founder | Week 0 | Open |

### 2.6 Operations and go-to-market

| ID | Item | Default | Owner | Needed by | Status |
|---|---|---|---|---|---|
| **O-01 ◆** | First venues (names, contacts, agreement) | 2–5 in one cluster | Founder | Before 1a soft launch | Open |
| **O-02 ◆** | First organisers (≈ 5) committed | – | Founder | Before 1a soft launch | Open |
| O-03 | Support channels, hours, macros | Email + WhatsApp Business, 08–23 IST | Founder | Before 1a | Open |
| O-04 | Public company, team and contact details (`[COMPANY_DETAILS]`, `[TEAM_MEMBERS]`, `[CONTACT_DETAILS]`); no unsupported scale or leadership claims | – | Founder | Before 1a | Open |
| O-05 | Pilot cohort size and what "good" looks like | 20–30 players; thresholds in 09 §6 | Founder | Before soft launch | Open |
| O-06 | DLT principal-entity registration owner and templates list | Founder registers; dev supplies templates ([05 §9](./05-business-logic.md)) | Founder | Week 0 | Open |

## 3. Placeholder register (v1 Appendix G, reconciled)

| Group | v1 placeholder | Status | Where it is now |
|---|---|---|---|
| Identity | `[APP_NAME]`, `[APP_TAGLINE]` | **Decided:** Playlo, Chalo Khelein | §1 |
| Identity | `[APP_LOGO]`, `[LOGO_ASSET]` | Open | B-01 |
| Market | `[LAUNCH_CITY]`, `[CITY_NAME]`, `[CITY_SLUG]`, `[TARGET_COUNTRY/REGION]` | **Decided:** Sirsa / `sirsa` / India–Haryana | §1 |
| Copy | `[PRIMARY_HEADLINE]`, `[HERO_DESCRIPTION]`, `[PROBLEM_STATEMENT]`, `[VENUE_OWNER_HEADLINE]`, `[ORGANIZER_HEADLINE]`, `[BADMINTON_HEADLINE]`, `[MISSION_STATEMENT]`, `[VISION_STATEMENT]` | Open | B-02 |
| Social proof | `[NUMBER_OF_PLAYERS]`, `[NUMBER_OF_PARTNER_VENUES]`, `[NUMBER_OF_GAMES_PLAYED]`, testimonials | **Not placeholders — data.** Render from the database or omit; never invent | [06 §11](./06-frontend-design-system.md) |
| Pricing | `[PLAYER_FREE_PRICE]` | Free (Phase 1) | – |
| Pricing | `[PLAYER_PREMIUM_PRICE]`, `[VENUE_STARTER/GROWTH/ENTERPRISE_PRICE]`, `[TOURNAMENT_FEE_MODEL]`, `[SPONSORSHIP_PACKAGES]`, `[AD_REVENUE_MODEL]` | Deferred | P-12 |
| Pricing | `[BOOKING_COMMISSION_RATE]` | Proposed 10 % | P-03 |
| Providers | `[UPI_PROVIDER]`, `[CARD_PROVIDER]` | **Decided:** Razorpay | §1 |
| Providers | `[EMAIL_PROVIDER]` | Open | S-09 |
| Providers | `[SMS_OR_OTP_PROVIDER]`, `[OTP_PROVIDER]`, `[PHONE_LOGIN]` | **Decided:** MSG91 phone OTP (DLT) | S-10 |
| Providers | `[EMAIL_LOGIN]`, `[SOCIAL_LOGIN_OPTIONS]` | Google as fallback; no email login | §1 |
| Providers | `[PUSH_NOTIFICATION_PROVIDER]` | **Decided:** FCM | §1 |
| Brand | `[PRIMARY_COLOR]`, `[SECONDARY_COLOR]`, `[ACCENT_COLOR]` | Proposed tokens | B-01 |
| Brand | `[HEADING_FONT]`, `[BODY_FONT]`, `[ICON_LIBRARY]` | **Decided:** Plus Jakarta Sans, Inter (+ Noto Sans Devanagari), Lucide | §1 |
| Brand | `[DESIGN_REFERENCE]` | Open | B-01 |
| Company | `[TEAM_MEMBERS]`, `[COMPANY_DETAILS]`, `[CONTACT_DETAILS]` | Open | O-04 |
| Roadmap | Match-score weights `[SKILL_WEIGHT]…[COMMUNITY_WEIGHT]` | **Parameters, not decisions:** start equal, tune from data | [05 §7](./05-business-logic.md) |
| Roadmap | `[LIST_YOUR_VENUE]` CTA, `[VENUE_SUBSCRIPTION_OPTIONS]`, `[TRANSACTION_FEES]` | CTA copy open (B-02); others Phase 3 | P-12 |

## 4. Closed items

*(none yet — move items here with the decision, date and who decided)*
