# 01 · Product Requirements

| | |
|---|---|
| **Status** | v2.0 — consolidates and sharpens the original phased product plan (archived in `_archive/product-plan-phased.md`) |
| **Audience** | Founder, product, design, engineering, QA, anyone writing marketing or legal copy |
| **Related** | [00-start-here](./00-start-here.md) · [05-business-logic](./05-business-logic.md) · [09-delivery-plan](./09-delivery-plan.md) · [12-open-items](./12-open-items.md) |

**Release labels used throughout:** **1a** = Phase 1, games-first release · **1b** = Phase 1, booking and payments release · **2** = retention and differentiation · **3** = monetisation and scale. Priorities: **Must** (blocks the release), **Should** (included unless time forces a cut), **Could** (nice to have). See [09 §3](./09-delivery-plan.md) for why Phase 1 is split.

---

## 1. Product overview

| | |
|---|---|
| **Name / tagline** | Playlo — *Chalo Khelein* |
| **Launch** | Sirsa, Haryana, India · **Badminton** only (futsal and other sports follow validated demand) |
| **Value proposition** | *Find your people. Organise your game. Get playing.* |
| **Primary audiences** | Recreational players and regular groups; organisers/coaches; venue owners and staff; the Playlo operations team |
| **Core hypothesis** | We can consistently help badminton players in one city find reliable people to play with, while giving venues a measurable reason to participate. |

**Objectives:** make it easy to find compatible teammates and opponents; cut the effort to organise a session; help venues fill vacant court hours; build trust through profiles, attendance history and clear policies; encourage repeat play; create sustainable revenue (bookings, venue subscriptions, premium, events).

**Architecture principle:** one platform with role-based access — a user can be a player, a game host, a community admin and a venue owner at once. Not four disconnected products.

**Hard rules from the product plan (carried into engineering):**
1. A booking is not confirmed because a user clicked *Pay* or was redirected back; only a verified provider payment confirms it.
2. Game lifecycle and booking lifecycle are separate. A game can exist without a platform booking; a booking can exist without a game.
3. Double-booking is prevented server-side, concurrency-safely.
4. Planned features are never presented as live.

## 2. Personas and jobs to be done

| Persona | Context | Jobs to be done | Pain today |
|---|---|---|---|
| **Riya, recreational player** (22–35, works or studies, plays 1–2×/week) | Android phone, WhatsApp-heavy, UPI | "Find a game at my level near me this evening, without chasing group chats." | Last-minute dropouts, unknown skill levels, no courts free |
| **Amit, host/organiser** (runs a weekly session or coaches) | Manages 2–3 WhatsApp groups | "Fill my 4 spots reliably, collect who's coming, handle cancellations." | Manual coordination, flaky players, no attendance memory |
| **Mrs. Kaur, venue owner/manager** (indoor courts) | Takes bookings by phone/WhatsApp and a notebook | "Fill empty hours, reduce no-shows, know my revenue." | Unused slots, cash handling, no customer data |
| **Support & moderation team** | Playlo staff | "Resolve a payment, report or dispute quickly and safely." | Needs context, audit trail, safe tools |

## 3. Scope and requirements

### 3.1 Accounts and identity

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| AUTH-01 | Sign up and log in with an Indian mobile number and one-time code | 1a | Must |
| AUTH-02 | Google sign-in as an alternative / OTP-outage fallback (behind a flag) | 1a | Should |
| AUTH-03 | Persistent sessions on a device with revocation ("sign out everywhere") | 1a | Must |
| AUTH-04 | Login is requested only at the moment of commitment (join, create, book) and returns the user to the same place with form state preserved | 1a | Must |
| AUTH-05 | 18+ self-declaration and acceptance of Terms/Privacy recorded with document versions | 1a | Must |
| AUTH-06 | Second factor mandatory for admin and support accounts | 1a | Must |
| ACC-01 | Self-service account deletion (anonymisation per [03 §8](./03-data-model.md)) | 1a | Must |
| ACC-02 | Data export (access request) | 1a | Should |
| ACC-03 | Block and report users, games, venues | 1a | Must |

### 3.2 Onboarding and profile

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| ONB-01 | Progressive onboarding: (1) display name, photo, language; (2) sport, skill level, format, casual/competitive; (3) availability windows; (4) city, radius, optional neighbourhood — *approximate location only*; (5) match preferences; (6) first action — Find a game / Explore venues. Steps other than sport and city are skippable | 1a | Must |
| PRF-01 | Profile shows name, photo, sports, skill, format, general area and **basic attendance facts** (games played, attended rate) | 1a | Must |
| PRF-02 | Privacy controls: discoverable, show attendance, notification preferences, language | 1a | Must |
| PRF-03 | Never expose phone, email, exact home location, private messages or payment details to other users | 1a | Must |
| PRF-04 | Achievements, community memberships, reliability on profile | 2 | Should |

### 3.3 Games (core of the product)

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| GAM-01 | **Find a game:** filters (sport, city/neighbourhood, date, time, distance, skill, singles/doubles, casual/competitive, seats available, max fee); sort; pagination; actions: view, join, share. Designed states: loading, no results, none nearby (suggest *create a game*, *invite friends*, *widen radius*), full, cancelled, login required | 1a | Must |
| GAM-02 | **Game details:** sport, time (IST), host, location (clearly **proposed** vs **confirmed court**), participants (privacy-filtered), skill range, rules (attendance, equipment, cancellation), fee note, status | 1a | Must |
| GAM-03 | **Create a game** in a guided flow: sport → format → date/time/duration → location (listed venue, or custom place) → player requirements (skill range, min/max players) → fee note (free / shared cost / organiser-defined) → visibility (public / private invite / community-only) and join policy (open / approval) → review and publish; share, approve players, remind, cancel, complete | 1a | Must |
| GAM-04 | **Join / leave** with hard capacity enforcement under concurrency; automatic **waitlist** and promotion | 1a | Must |
| GAM-05 | **Approval-based joining:** request, host approves or declines, requester notified | 1a | Must |
| GAM-06 | **Host tools:** edit (changes notify everyone), remove a participant (reason), confirm the game, cancel (reason), complete, mark attendance | 1a | Must |
| GAM-07 | **My Games** tabs: Upcoming, Hosting, Joined, Invitations, Completed, Cancelled | 1a | Must |
| GAM-08 | **Attendance:** host marks attended / no-show / excused; participants can dispute a no-show | 1a (mark) / 2 (dispute) | Must / Should |
| GAM-09 | **Fees in 1a are informational and settled off-platform** (host collects); the UI labels them as such. On-platform split payments are a later phase | 1a | Must |
| GAM-10 | Save a game; calendar export | 1a | Could |
| GAM-11 | **Recurring games** as a first-class feature | 2 | Should |
| GAM-12 | Status model shown to users: Draft, Open, Full, Confirmed, In progress (derived), Completed, Cancelled | 1a | Must |

### 3.4 Sharing and growth

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| SHR-01 | **Public share page** `/g/{code}` with rich link preview, no login wall, no personal data, `noindex` ([05 §8](./05-business-logic.md)) | 1a | Must |
| SHR-02 | One-tap WhatsApp share from game creation, game page and booking confirmation | 1a | Must |
| SHR-03 | Attribution parameters on shared links; referral rewards later | 1a / 2 | Should |

### 3.5 Venues: discovery (players)

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| VEN-01 | Venue directory and search: city, neighbourhood, distance, sport, price range, facilities, indoor/outdoor, rating (when available); detail page with photos, address, directions, hours, facilities, policies | 1a | Must |
| VEN-02 | Only **verified** venues are listed; only slots that are truly bookable are shown (1b) | 1a / 1b | Must |
| VEN-03 | Until booking is live: "Call / WhatsApp the venue" actions, tracked as leads (`venue_lead_clicked`) so venues see measurable value | 1a | Should |
| VEN-04 | Venue reviews and ratings with abuse safeguards | 2 | Should |

### 3.6 Booking and payments

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| BKG-01 | **Availability grid** per court per day (IST), with price bands; shows only genuinely bookable slots | 1b | Must |
| BKG-02 | **5-minute slot hold** with visible countdown; the hold never leaks to other users as ambiguity — they see "held by another player" | 1b | Must |
| BKG-03 | **Itemised checkout**: venue, court, date, times, court price, convenience fee, GST on fee, discount, **total**, cancellation terms, terms acknowledgement | 1b | Must |
| BKG-04 | Pay by UPI or card; booking becomes **Confirmed** only after verified provider payment | 1b | Must |
| BKG-05 | **Confirmation**: reference, venue/court/time, amount, status, cancellation terms, directions, add-to-calendar, share with players | 1b | Must |
| BKG-06 | **Cancellation** with a refund preview that states exactly what will be returned ([05 §2.5](./05-business-logic.md)); venue-initiated cancellation = full refund | 1b | Must |
| BKG-07 | Create a game from a booking, or attach a booking to a game | 1b | Should |
| BKG-08 | Payment history and receipts | 1b | Must |
| BKG-09 | Automatic full refund if a payment arrives for a slot that can no longer be given | 1b | Must |
| BKG-10 | Booking states visible: Pending, Payment pending, Confirmed, Completed, Cancelled, Expired, Refund pending, Refunded; payment failure explained with retry | 1b | Must |

### 3.7 Venue portal

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| VPT-01 | **Ops-assisted onboarding** — staff enter venue, courts, hours and prices on the owner's behalf via admin | 1a | Must |
| VPT-02 | **Self-service registration** with draft saving: business and venue details, sports, courts, hours, payout setup | 1b | Must |
| VPT-03 | **Verification workflow**: documents, status (Draft, Submitted, Under review, Verified, Rejected, Suspended), resubmission with reasons | 1b | Must |
| VPT-04 | Courts: add, edit, disable, mark unavailable; recurring hours; price bands (base, peak, day-based); minimum duration; cancellation policy | 1b | Must |
| VPT-05 | **Calendar** (day/week/month): block maintenance, **add walk-in / phone bookings as blocks**, conflict prevention | 1b | Must |
| VPT-06 | Bookings: upcoming, pending, confirmed, completed, cancelled, refund requests; venue-initiated cancellation with reason | 1b | Must |
| VPT-07 | Dashboard: today's bookings, upcoming, utilisation, revenue (finance permission only), pending actions | 1b | Must |
| VPT-08 | Staff accounts with roles (owner, manager, staff); settlements view | 1b | Should |
| VPT-09 | Promotions, repeat-booking analytics, customer notes | 2 | Should |
| VPT-10 | Subscription plans, billing, advanced analytics | 3 | Should |

### 3.8 Admin and operations

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| ADM-01 | Venue review queue: documents, approve / reject (reason) / suspend | 1a | Must |
| ADM-02 | Users: search, view, suspend/reinstate with justification and user notification | 1a | Must |
| ADM-03 | Moderation: review reports, hide or cancel games, record decisions | 1a | Must |
| ADM-04 | Bookings, payments, refunds, reconciliation, webhook replay | 1b | Must |
| ADM-05 | Business configuration (pricing, refund tiers, kill switches) — versioned and audited | 1a | Must |
| ADM-06 | Audit log viewer; reasons mandatory for sensitive actions | 1a | Must |
| ADM-07 | Basic analytics: registered users, MAU, games created and completed, booking volume (1b), active venues, cancellation and refund rates | 1a / 1b | Must |
| ADM-08 | Abuse detection (booking abuse, report clusters), reliability disputes, proportionate restrictions with audit trail | 2 | Should |
| ADM-09 | Tournament management, content management, reconciliation reporting, advanced fraud tooling | 3 | Should |

### 3.9 Notifications and platform

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| NTF-01 | Transactional notifications per the matrix in [05 §9](./05-business-logic.md): invitations, join accepted, game confirmed/updated/cancelled, booking confirmed, payment success, reminders, cancellations, refund updates | 1a / 1b | Must |
| NTF-02 | Preferences, with non-optional safety/payment messages | 1a | Must |
| NTF-03 | Reminder 2 hours before a game | 1a | Must |
| PLT-01 | English UI at launch; Hindi catalogs maintained at parity | 1a | Must / Should |
| PLT-02 | Installable PWA with push (Android first) | 1a | Should |
| PLT-03 | Marketing site: Home, How it works, For players, For venue partners, Help, Contact, Legal; **Pricing/fees** page once fees exist | 1a / 1b | Must |
| PLT-04 | Analytics events per §7, with no PII | 1a | Must |

## 4. Key user journeys

| Journey | Steps | Success metric |
|---|---|---|
| **A. Join a game** | Landing / share link → game list or page → review host, time, location, skill → join (login if needed) → confirmation → reminder → attend → feedback | Eligible viewers who join (§6) |
| **B. Find a partner** *(2)* | Profile and availability → *Find players* → filter → invite to a game or create one → share → confirm | Connections that become real games |
| **C. Book a court** *(1b)* | Venue search → court and slot → review price and policy → pay → confirmation → share → attend | Paid, fulfilled bookings per active user |
| **D. Venue wants bookings** | Partner page → review pricing → register/assisted onboarding → verify → courts, prices → publish → receive bookings → track revenue | Approved venues with a first fulfilled booking |
| **E. Build a community** *(2)* | Register → create community → invite members → first game → share → host → schedule next | Organisers with recurring games and repeat attendance |

## 5. Acceptance criteria — launch-critical behaviour

These are the contract between product, engineering and QA. Each maps to automated tests where marked (T-ids in [08 §5.1](./08-engineering-operations.md)).

| ID | Given | When | Then | Rel / Test |
|---|---|---|---|---|
| AC-01 | A visitor with a valid Indian mobile number | They request and enter the correct OTP within 5 minutes | A session is created; `isNewUser` routes to onboarding; wrong code ×5 invalidates the challenge; response shape is identical for existing and unknown numbers | 1a · T-10 |
| AC-02 | A signed-out user viewing an open game | They tap *Join* and log in | They return to the same game with the join completed once, and form state preserved | 1a |
| AC-03 | A signed-in user creating a game | Start time is < 15 min ahead, end ≤ start, skill range inverted, or no location | Field-level errors; nothing is created. A valid game gets a `shareCode`, the host as a confirmed participant (`confirmedCount = 1`) and a reminder job | 1a |
| AC-04 | An open game with a free seat | A user joins | They become `CONFIRMED`, `confirmedCount` +1, host is notified; at max capacity status becomes `FULL` | 1a · T-05 |
| AC-05 | A game with one seat left and 20 users tapping *Join* simultaneously | All requests land | Exactly one becomes confirmed; others are offered the waitlist; counter equals confirmed rows; no user is charged or double-counted | 1a · T-05 |
| AC-06 | A full game with a waitlist | A confirmed player leaves | The oldest waitlisted player is promoted and notified; status returns to `FULL` if the seat is filled | 1a |
| AC-07 | A public game link opened in WhatsApp | The link preview is generated and the page opened logged-out | Title, time, spots left, place name appear; no phone numbers, participant names or private details; page is `noindex`; *Join in the app* resumes after login | 1a |
| AC-08 | A private/invite-only game | A non-invited user opens its link | A generic invite-only card; details only after eligibility | 1a |
| AC-09 | A free slot | A player starts checkout | A hold exists for 5 minutes, visible to the player; others see the slot unavailable; after expiry it is bookable again without waiting for a job | 1b · T-01 |
| AC-10 | A held slot and a successful payment | The browser verify call and the webhook arrive in either order, or twice | The booking is `CONFIRMED` exactly once; one payment success; one venue transfer; one confirmation | 1b · T-04 |
| AC-11 | An expired hold whose slot was then booked by someone else | The first player's payment arrives late | The second booking is untouched; the first player is refunded in full automatically and told why | 1b · T-02 |
| AC-12 | A confirmed booking | The player cancels at 30 h / 18 h / 6 h before start | Refund of 100 % / 50 % / 0 % of the court price (fee and its GST non-refundable); the dialog showed the exact amount first | 1b · T-07 |
| AC-13 | A confirmed booking | The venue cancels | Player receives 100 % of everything paid, including the fee; the venue transfer is reversed | 1b |
| AC-14 | A venue owner | They submit for review without documents, an active court with hours and price, or payout setup | Submission is refused with a checklist of what is missing | 1b |
| AC-15 | A moderator | They suspend a user | A reason is required; the user sees a restriction card with the category and an appeal route; an audit row exists; no automatic penalty occurred from a single report | 1a |
| AC-16 | A user with no open bookings | They delete their account | Personal fields are anonymised; financial rows retained per policy; future hosted games are cancelled with notice | 1a |
| AC-17 | A user offline | They try to join, book or pay | Actions are disabled with an explanation; cached lists remain readable | 1a |
| AC-18 | Core flows (login, game list, create game, booking) | Axe and keyboard walkthrough run | No critical violations; focus order logical; targets ≥ 44 px; text contrast ≥ 4.5 : 1 | 1a |

## 6. Success metrics

Definitions are deliberately precise so the numbers can be computed and trusted.

| Metric | Definition | Release |
|---|---|---|
| **Eligible game viewer** | A signed-in user who opens the detail page of a game that is `OPEN`/`CONFIRMED`, has a free seat, matches their sport, is within their radius, and where they are not the host or already a participant | 1a |
| **Join rate** *(headline)* | Eligible viewers who join (confirmed, waitlisted or requested) within 24 hours of first viewing ÷ all eligible viewers in the period | 1a |
| **Attendance rate** | Participants marked `ATTENDED` ÷ participants of completed games (excluding `EXCUSED`) | 1a |
| **Fill rate** | Games reaching `minParticipants` before start ÷ games started or due | 1a |
| **Return rate** | Players who join a second game within 14 days of their first | 1a |
| **Onboarding conversion** | New users who complete onboarding **and** view or join a relevant game within 7 days | 1a |
| **Fulfilled bookings per active user** | Bookings in `COMPLETED` (paid) ÷ monthly active users who opened availability | 1b |
| **Venue activation** | Approved venues that publish availability and receive a first fulfilled booking | 1b |
| **Contribution per booking** | Platform revenue − variable payment costs − refund/chargeback costs − booking-level incentives − other variable fulfilment costs ([05 §2.3](./05-business-logic.md)) | 1b |
| **Phase 2 metrics** | Week-over-week return; organisers with recurring games and repeat attendance; matches that become real games; venue repeat-booking rate | 2 |
| **Phase 3 metrics** | Positive contribution margin per booking; venue renewals; retention at months 3, 6, 12 | 3 |

Never confuse gross booking value with platform revenue. Only publish verified numbers publicly.

## 7. Analytics event dictionary

Every event carries: `event_id` (UUID), `occurred_at` (UTC), `user_id` (internal ID), `anonymous_id`, `session_id`, `locale`, `app_version`, `platform` (`browser` | `pwa`), `source` / `ref` (e.g. `wa_share`), and **never** phone, email, name, exact location or payment details.

| Event | When | Key properties | Release |
|---|---|---|---|
| `signup_completed` | Account created | `method` (otp/google) | 1a |
| `onboarding_completed` | Last required step done | `steps_skipped[]` | 1a |
| `game_search_performed` | List/search executed | filters, `result_count`, `radius_km` | 1a |
| `game_viewed` | Game page/share page opened | `game_id`, `source` (list/share/notification), `seats_left`, `eligible` | 1a |
| `game_created` | Game published | `game_id`, `has_venue`, `visibility`, `join_policy`, `max_participants` | 1a |
| `game_shared` | Share tapped | `game_id`, `channel` | 1a |
| `game_joined` | Join result | `game_id`, `result` (confirmed/waitlisted/requested), `source` | 1a |
| `game_left` | Leave | `game_id`, `hours_before_start` | 1a |
| `game_completed` | Completion | `game_id`, `attended_count`, `no_show_count` | 1a |
| `venue_viewed` / `venue_lead_clicked` | Directory interaction | `venue_id`, `channel` | 1a |
| `booking_started` | Hold created | `booking_id`, `court_id`, `amount_paise` | 1b |
| `hold_expired` | Hold lapsed | `booking_id` | 1b |
| `payment_succeeded` / `payment_failed` | Provider outcome | `booking_id`, `amount_paise`, `method`, `failure_code` | 1b |
| `booking_cancelled` | Cancellation | `booking_id`, `cancelled_by`, `refund_tier`, `refund_paise` | 1b |
| `community_joined` | Join | `community_id` | 2 |
| `tournament_registered` | Registration | `tournament_id` | 3 |

Consent gates optional analytics ([07 §6.2](./07-security-privacy-compliance.md)); server-side operational events needed to run the service (e.g., payments) are not optional.

## 8. What not to build early

Complex AI recommendations · a full social feed · large in-app messaging · multiple sports across many cities · elaborate gamification · league-management software · wallets or stored value · player-to-player cost splitting on-platform. They consume time without proving that players will repeatedly join games (and wallets raise regulatory questions — [07 §5 C9](./07-security-privacy-compliance.md)).

## 9. Pages and URL map

Public pages are indexable only where marked. Private areas are `noindex`.

| Area | URL | Rel | Index |
|---|---|---|:-:|
| Home, How it works, For players | `/`, `/how-it-works`, `/players` | 1a | ✓ |
| For venue partners | `/venues/partners` | 1a | ✓ |
| Pricing / fees | `/pricing` | 1b (needed once fees exist) | ✓ |
| Help, Contact | `/help`, `/contact` | 1a | ✓ |
| Legal | `/legal/terms`, `/privacy`, `/refunds`, `/cancellation-policy`, `/community-guidelines`, `/cookies` | 1a (refunds and cancellation by 1b) | ✓ |
| Share page | `/g/[code]` | 1a | ✗ (previews only) |
| Features, For organisers, About, Blog, Sports/Badminton, Cities | `/features`, `/organizers`, `/about`, `/blog`, `/sports/badminton`, `/cities/[slug]` | 2 | ✓ (only with real content) |
| Auth | `/login`, `/signup`, `/verify` | 1a | ✗ |
| Onboarding | `/onboarding` | 1a | ✗ |
| Player app | `/app`, `/app/games`, `/app/games/[id]`, `/app/games/create`, `/app/my-games`, `/app/venues`, `/app/venues/[slug]`, `/app/profile/[id]`, `/app/notifications`, `/app/settings` | 1a | ✗ |
| Player app — booking | `/app/bookings/checkout`, `/app/bookings/[id]`, `/app/bookings/[id]/confirmation`, `/app/payments` | 1b | ✗ |
| Player app — later | `/app/players`, `/app/communities`, `/app/achievements` (2); `/app/tournaments` (3) | 2 / 3 | ✗ |
| Venue portal | `/venue/register`, `/verification`, `/dashboard`, `/profile`, `/courts`, `/calendar`, `/bookings`, `/pricing` (1b); `/customers` (2); `/analytics`, `/billing` (3) | 1b / 2 / 3 | ✗ |
| Admin | `/admin/dashboard`, `/users`, `/venues`, `/moderation`, `/settings`, `/audit` (1a); `/bookings`, `/payments` (1b); `/tournaments`, `/content`, `/trust-safety` (3) | 1a–3 | ✗ |

SEO rules (from the product plan, kept): descriptive titles and meta descriptions; canonical URLs; sitemaps for indexable pages; private pages and unpublished games out of search; no unbounded filter-URL duplicates; structured data only where content qualifies; do not expose internal identifiers unnecessarily.

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Targets and budgets in [02 §10](./02-architecture.md) and [06 §10](./06-frontend-design-system.md) |
| Availability | 99.5 % monthly for the booking path (1b); read paths degrade gracefully |
| Browsers/devices | Chrome/Android (latest two versions), Safari/iOS ≥ 16.4 for PWA features, current evergreen desktop browsers; 320 px minimum width |
| Accessibility | WCAG 2.2 AA |
| Security and privacy | [07](./07-security-privacy-compliance.md); DPDP-aligned notices, consent, retention, erasure |
| Localisation | English at launch, Hindi catalogs at parity; INR; IST |
| Data integrity | Zero double bookings; zero unreconciled payments older than 24 h ([02 §10](./02-architecture.md)) |
| Auditability | Every sensitive admin action carries a reason and an immutable audit row |

## 11. Later phases (summary)

**Phase 2 — Retention and differentiation:** rule-based player matching (`/app/players`) with eligibility filters first and a transparent score ([05 §7](./05-business-logic.md)); communities with directories, announcements and recurring games; reliability score with disputes and published criteria ([05 §6.2](./05-business-logic.md)); post-session reviews with anti-abuse safeguards; achievements, XP and levels with verified-activity rules; venue promotions, repeat-booking analytics and customer notes; referrals; richer profiles and privacy controls; public pages (Features, Organisers, Badminton, Cities, About, Blog); admin abuse-detection and dispute tooling.

**Phase 3 — Monetisation and scale:** revenue streams (booking commission, venue subscriptions, player premium, tournament fees, sponsorship, advertising — each with a placeholder to validate, never assumed); pricing page and billing; advanced venue analytics (court utilisation = booked available court-hours ÷ total bookable court-hours, excluding hours the venue marks unavailable); tournaments (directory, registration with payment, fixtures, results) before leagues; additional sports and cities with their own landing pages; regional languages; sponsored events; fraud tooling, content management and reconciliation reporting; unit-economics dashboard. Any wallet or stored-value feature requires a regulatory review first.

## 12. Assumptions and dependencies

- Pricing, fees and commission are **hypotheses** to be validated before finalising (product plan §4.8); defaults live in configuration ([05 §2.2](./05-business-logic.md)).
- Launch depends on non-code workstreams listed in [09 §4](./09-delivery-plan.md) (DLT, legal, Razorpay/Route for 1b, venue and organiser recruitment).
- Brand placeholders, provider choices and policy decisions are tracked in [12-open-items](./12-open-items.md).
- Roles are enforced as permissions on the server ([04 §3](./04-api-specification.md)).
