# [Playlo] — Phased Product & Build Plan

A sports networking platform where people discover players, join games, book venues, build communities, and enter local tournaments.

This document reorganises the full product specification into build phases. Placeholders in `[BRACKETS]` are decisions still to be made.

---

## Contents

1. [Product overview](#1-product-overview)
2. [Platform map](#2-platform-map)
3. [Roadmap at a glance](#3-roadmap-at-a-glance)
4. [Phase 0: Foundations](#4-phase-0-foundations)
5. [Phase 1: MVP](#5-phase-1-mvp)
6. [Phase 2: Retention and differentiation](#6-phase-2-retention-and-differentiation)
7. [Phase 3: Monetization and scale](#7-phase-3-monetization-and-scale)
8. [What not to build early](#8-what-not-to-build-early)
- [Appendix A: Navigation](#appendix-a-navigation)
- [Appendix B: Key user journeys](#appendix-b-key-user-journeys)
- [Appendix C: Data model](#appendix-c-data-model)
- [Appendix D: Technical integrity requirements](#appendix-d-technical-integrity-requirements)
- [Appendix E: Design system](#appendix-e-design-system)
- [Appendix F: URL and SEO structure](#appendix-f-url-and-seo-structure)
- [Appendix G: Placeholder checklist](#appendix-g-placeholder-checklist)

---

## 1. Product overview

| Item | Value |
|---|---|
| Working name | `[Playlo]` |
| Tagline | `[Chalo Khelein]` |
| Initial sport | Badminton | Futsal 
| Launch city | `[Sirsa]` |
| Target market | `[TARGET_COUNTRY / TARGET_REGION]` |
| Primary audience | Recreational players, regular sports groups, venue owners, tournament organizers |

**Value proposition:** "Find your people. Organize your game. Get playing."

### Objectives

- Make it easy to find compatible teammates and opponents.
- Cut the time needed to organize a session.
- Help venues attract customers and fill vacant court slots.
- Build trust through profiles, attendance history, and reliability indicators.
- Encourage repeat play through communities, leagues, achievements, and rewards.
- Create sustainable revenue from bookings, venue subscriptions, premium memberships, and events.

### Architecture principle

Build **one platform with role-based access**, not four disconnected products. A user can be a player and a game organizer; a venue owner can also play.

---

## 2. Platform map

| Experience | Who uses it | Base URL | Purpose |
|---|---|---|---|
| Public website | Visitors | `/` | Explain the product and convert visitors into players or venue partners |
| Player application | Players, organizers | `/app` | Find games and players, book courts, join communities |
| Venue portal | Venue owners and staff | `/venue` | Manage courts, bookings, pricing, and revenue |
| Admin panel | Platform team | `/admin` | Moderation, payments, venue approval, configuration |
| Shared services | All of the above | n/a | Search, location, notifications, payments, auth, reviews, trust, referrals, analytics |

---

## 3. Roadmap at a glance

| Phase | Name | Goal | Headline deliverables | Key success metric |
|---|---|---|---|---|
| 0 | Foundations | Remove blockers before building | Brand, providers, legal, roles, data model, design system | All launch decisions made |
| 1 | MVP | Prove a player can go from "I want to play" to "I played" | Find/create/join games, venue booking and payment, venue portal, admin basics | Eligible game viewers who join a game; paid, fulfilled bookings per active user |
| 2 | Retention and differentiation | Bring players back and make the product stand out | Matchmaking, communities, reliability, reviews, XP, promotions, referrals | Repeat attendance; organizers running recurring games |
| 3 | Monetization and scale | Turn engagement into revenue and expand | Premium plans, venue tiers, tournaments, new sports and cities | Positive contribution margin per booking; venue renewals |

**The MVP hypothesis:**

> Can we consistently help badminton players in one city find reliable people to play with, while giving venues a measurable reason to participate?

---

## 4. Phase 0: Foundations

Complete these before or alongside the first sprint.

### 4.1 Decisions to make

- App name, tagline, logo, and brand colors, fonts, and icon library
- Launch city and region
- Languages to support at launch
- Payment provider(s): `[UPI_PROVIDER]`, `[CARD_PROVIDER]`
- Login method: `[EMAIL_LOGIN]`, `[PHONE_LOGIN]`, `[OTP_PROVIDER]`, `[SOCIAL_LOGIN_OPTIONS]` (for an India-first launch, evaluate phone verification and UPI-compatible flows)
- Notification providers: `[EMAIL_PROVIDER]`, `[SMS_OR_OTP_PROVIDER]`, `[PUSH_NOTIFICATION_PROVIDER]`

### 4.2 Roles and permissions

| Role | Typical access |
|---|---|
| Player | Discover, join, and book games |
| Game organizer | Create and manage games |
| Community admin | Manage a community |
| Venue staff | Manage bookings (not necessarily financial reports) |
| Venue owner | Full venue access, including billing |
| Support agent | Handle user issues |
| Moderator | Review reports and content |
| Administrator | Platform configuration |

Use **permissions**, not just role names, and enforce them on the server.

### 4.3 Core data model

Set up the entities in [Appendix C](#appendix-c-data-model) and the integrity rules in [Appendix D](#appendix-d-technical-integrity-requirements).

### 4.4 Design system

Build the reusable components and screen states in [Appendix E](#appendix-e-design-system).

### 4.5 Legal documents

Have locally appropriate versions reviewed by qualified counsel:

- Terms of Service
- Privacy Policy
- Refund Policy
- Cancellation Policy
- Community Guidelines
- Cookie Policy

### 4.6 Analytics events

Track from day one: `signup_completed`, `onboarding_completed`, `game_search_performed`, `game_viewed`, `game_created`, `game_joined`, `booking_started`, `payment_succeeded`, `booking_cancelled`, `game_completed`, `community_joined`, `tournament_registered`.

Include timestamps, internal identifiers, and attribution. Keep sensitive personal data out of events.

### 4.7 Cold-start plan

Recruit a small number of trusted organizers who will consistently create games, and onboard a first set of venues in one tight area, before expecting organic joining.

### 4.8 Pricing validation

Do not finalize prices until you've tested willingness to pay and calculated contribution margin per booking.

---

## 5. Phase 1: MVP

**Goal:** a new user can reliably go from "I want to play badminton" to "I found players, joined a game, and actually played," in one launch city, with venues seeing real value.

### 5.1 Public website

| Page | URL | Purpose |
|---|---|---|
| Home | `/` | Convert visitors into players or venue partners |
| How It Works | `/how-it-works` | Explain the player and venue journeys |
| For Players | `/players` | Convert recreational players |
| For Venue Owners | `/venues/partners` | Generate venue-partner leads |
| Pricing or Fees | `/pricing` | Explain who pays what |
| FAQs / Help | `/help` | Answer common questions |
| Contact | `/contact` | Support and partnership inquiries |
| Legal | `/legal/*` | Terms, privacy, refunds, cancellation, guidelines, cookies |

**Homepage sections**
1. Navigation: logo, Find Games, Find Venues, How It Works, For Venues, Pricing, Log In, Join Now (optional location, sport, and language selectors)
2. Hero: headline, supporting text, primary CTA "Find a Game", secondary CTA "List Your Venue", with a sport/location/date selector
3. The problem: finding players at your level, coordinating across chat groups, finding courts, last-minute dropouts, finding regular communities
4. How it works: create profile, discover games, join or organize, play and build reputation
5. Find your next game: game cards (title, sport, venue, time, distance, skill level, players joined, spots, price, join button)
6. Discover venues: venue cards (image, name, location, sports, price range, rating, available slots)
7. Reliability and trust: verified profiles, attendance and cancellation history, feedback
8. For venue owners: online bookings, availability management, fewer unused slots, promotions, revenue tracking
9. Social proof: players, partner venues, games played, testimonials (publish only verified numbers)
10. Pricing preview
11. FAQs
12. Footer: About, Contact, Help, Blog, For Venue Owners, Pricing, legal links, social media

**For Venue Owners page**
- Hero and CTA `[LIST_YOUR_VENUE]`
- Problems: unused hours, manual coordination, cancellations, acquiring customers, fragmented records
- Benefits and dashboard preview (calendar, utilization, reservations, revenue, cancellations)
- Partnership steps: register, verify, add courts and hours, set prices and policies, publish availability, manage bookings
- Pricing: `[VENUE_SUBSCRIPTION_OPTIONS]`, `[BOOKING_COMMISSION]`, `[TRANSACTION_FEES]`, clearly stating who pays each
- FAQs: documents required, verification time, price control, multi-court management, cancellations, settlement timing, disputes

### 5.2 Player application

**Authentication:** `/login`, `/signup`, `/verify`, `/forgot-password`, `/reset-password`, `/auth/callback`. Collect only what's necessary; use progressive onboarding.

**Onboarding** (`/onboarding`)
1. Basic profile (display name, photo, preferred language)
2. Sport preferences (sport, skill level, format, casual or competitive)
3. Availability (days, time windows, session length)
4. Location (city, radius, optional neighborhood; keep precise location private)
5. Match preferences (skill range, singles or doubles, group size)
6. First action: Find a Game, Find Players, or Explore Venues

**Dashboard** (`/app`): greeting and city, primary actions (Find a Game, Create a Game, Find a Venue), recommended games, upcoming games, notifications. Avoid empty leaderboards or generic feeds for new users.

**Find a Game** (`/app/games`)
- Filters: sport, city and neighborhood, date, time, distance, skill level, singles or doubles, casual or competitive, available spots, max fee
- Actions: view details, join, save, share
- States: loading, no results, no games nearby, full, cancelled, payment required, login required. When empty, suggest creating a game, inviting friends, or widening the radius.

**Game Details** (`/app/games/[GAME_ID]`)
- Game info, host info, participants, rules (attendance, equipment, cancellation, payment)
- Actions: join, leave, invite friends, share on WhatsApp, contact host (if enabled)
- Status model: Draft, Open, Full, Confirmed, In Progress, Completed, Cancelled

**Create a Game** (`/app/games/create`)
1. Choose sport
2. Select format (singles, doubles, group session, friendly, competitive)
3. Set date, start time, duration
4. Select venue (listed venue, available slot, or existing booking); clearly distinguish a *proposed* location from a *confirmed* reservation
5. Set player requirements (skill range, min and max participants)
6. Set fee (free, shared court cost, organizer-defined); show how it's calculated and what happens on cancellation
7. Set visibility (public, private invite, community-only)
8. Review and publish, then share, approve players, send reminders, manage cancellations, mark complete

**Venues** (`/app/venues`, `/app/venues/[VENUE_ID]`)
- Filters: city, neighborhood, distance, sport, price, availability, facilities, rating, indoor or outdoor
- Details: images, address, sports, hours, facilities, pricing, availability calendar, reviews, cancellation policy, directions
- Only show slots that are actually available per the venue's authoritative schedule

**Booking and payment** (`/app/bookings/checkout`, `/app/bookings/[BOOKING_ID]`, `/app/bookings/[BOOKING_ID]/confirmation`)
- Flow: select venue, select court and slot, review, confirm details, review total, accept terms, pay, get confirmation
- Checkout shows: venue, court, date, times, base price, taxes, platform fee, processing fee (if charged to user), discounts, final total
- Statuses: Pending, Payment Pending, Confirmed, Cancelled, Completed, Refund Pending, Refunded, Payment Failed
- Confirmation: reference, venue and court, time, amount, payment status, cancellation terms, directions, add to calendar, share with players

**My Games** (`/app/my-games`): tabs for Upcoming, Hosting, Joined, Invitations, Completed, Cancelled. Players can accept or decline invitations, leave, view details, share, and rate. Hosts can manage participants, approve requests, announce changes, cancel, and record outcomes.

**Basic profile and settings**
- Profile: name, photo, sports, skill, format, general area, basic attendance history
- Settings: profile, sports, availability, location, notifications, privacy, security, blocked users, language, account deletion
- Never expose phone numbers, exact home location, private messages, or payment details publicly

**Payments** (`/app/payments`): payment history, booking payments, participation fees, refund status, receipts.

**Notifications:** game invitation, join accepted, game confirmed, booking confirmed, payment successful, reminders, cancellations, refund updates. Start with transactional notifications and shareable game links; defer full in-app messaging.

### 5.3 Venue portal

| Page | URL | Key functions |
|---|---|---|
| Registration | `/venue/register` | Business and venue details, sports, courts, hours, verification and payout info; save as draft |
| Verification | `/venue/verification` | Documents, status (Draft, Submitted, Under Review, Verified, Rejected, Suspended), resubmission |
| Dashboard | `/venue/dashboard` | Today's bookings, upcoming reservations, utilization, revenue, pending actions |
| Venue profile | `/venue/profile` | Name, description, images, address, facilities, hours, policies; draft, review, publish |
| Courts | `/venue/courts` | Add, edit, disable, mark unavailable, recurring hours |
| Calendar | `/venue/calendar` | Day/week/month views, block maintenance, prevent conflicts |
| Bookings | `/venue/bookings` | Upcoming, pending, confirmed, completed, cancelled, refund requests |
| Pricing | `/venue/pricing` | Base, peak, off-peak, day-based pricing, minimum duration, cancellation rules |

### 5.4 Admin panel

- **Users:** search, view status, review reports, suspend with justification
- **Venues:** review applications, verify, approve or suspend listings
- **Bookings:** search, status, conflicts, cancellations
- **Payments:** transaction history, provider references, refunds, failed payments
- **Moderation:** review reported games, handle abuse, record decisions
- **Basic analytics:** registered users, MAU, games created and completed, booking volume, active venues, cancellation and refund rates

### 5.5 Shared services

- **Authentication and permissions:** secure login, verification, sessions, role-based access, suspension
- **Search and discovery:** games, venues, filters, pagination, sorting, location-aware, meaningful empty states
- **Booking engine:** check availability, temporarily hold slots, prevent double booking, calculate price, initiate payment, confirm, cancel, refund, reconcile
- **Game management engine:** create, manage capacity, handle join requests, enforce rules, notify, record completion
- **Notifications:** event-triggered, with preferences
- **Attendance history:** descriptive records only (no scoring yet)
- **Event analytics**

### 5.6 Critical rules

- A booking is **not confirmed** just because the user clicked pay or was redirected back. Verify with the provider's authoritative response or webhook.
- Keep the **game lifecycle separate from the booking lifecycle**. A game can exist without a platform booking, and a booking can exist without an open game.
- Prevent double booking with server-side, concurrency-safe checks.
- Do not present planned features as live.

### 5.7 Phase 1 success metrics

| Journey | Metric |
|---|---|
| Join a game | Percentage of eligible game viewers who join |
| Book a court | Paid and fulfilled bookings per active user |
| Venue partner | Approved venues that publish availability and receive a first fulfilled booking |
| Onboarding | New users who complete onboarding and view or join a relevant game |

---

## 6. Phase 2: Retention and differentiation

**Goal:** make players come back and give the product a reason to be chosen over group chats and generic booking apps.

### 6.1 Player matching (`/app/players`)

- Filters: sport, location, skill, availability, singles or doubles, game type, mutual communities
- Player card: name, photo, sports, skill, format, general area, shared communities, activity summary
- Actions: invite to game, view profile, connect (if enabled)
- Start with understandable rules before any AI. A simple score can combine skill compatibility, distance, availability overlap, preferred format, and shared communities:

  `MATCH_SCORE = [SKILL_WEIGHT] + [DISTANCE_WEIGHT] + [AVAILABILITY_WEIGHT] + [FORMAT_WEIGHT] + [COMMUNITY_WEIGHT]`

  Apply eligibility constraints first, normalize the factors, and tune weights from observed behavior. Never present a match score as a guarantee of compatibility.

### 6.2 Communities (`/app/communities`, `/app/communities/[COMMUNITY_ID]`)

- Directory: name, sport, location, members, activity level, public or private
- Details: overview, rules, members, upcoming games, recurring sessions, events, announcements, leaderboard (if enabled)
- Member actions: join, request membership, invite, create a game, share
- Admin actions: approve members, manage roles, publish announcements, schedule games, remove abusive content, report safety issues
- **Recurring games** as a first-class feature

### 6.3 Reliability system

**Inputs:** confirmed attendance, timely cancellations, repeated no-shows, host reliability, verified post-game feedback.

**Design principles**
- Publish understandable criteria and apply consistent rules
- Allow users to dispute incorrect records
- Account for legitimate cancellations
- Prevent coordinated false reports
- Avoid exposing sensitive details

Begin with descriptive attendance history, then introduce a numeric score only when it's needed.

### 6.4 Reviews and feedback

Post-session ratings of players, hosts, and venues, with safeguards against abuse.

### 6.5 Achievements, XP, and levels (`/app/achievements`)

| Category | Examples |
|---|---|
| Participation | First Game, Five Games, Twenty Games |
| Reliability | Consistent Attendance, Dependable Host |
| Community | Contributor, Organizer |
| Competition | Tournament Participant, Tournament Winner |

Implementation rules: configurable XP, XP only for verified activity, no duplicate claims, clear criteria, anti-abuse controls, no rewards for excessive low-quality activity.

### 6.6 Venue growth tools

- Promotions and discounts
- Repeat-booking analytics
- Customer management (booking history, repeat-customer stats, notes). Collect only what's needed.

### 6.7 Referrals

Referral sharing and rewards for players and organizers.

### 6.8 Enhanced profiles and privacy

Achievements, community memberships, and relevant reliability information on the profile. Privacy controls for visibility, discoverability, who can contact them, and attendance history. Report and block actions.

### 6.9 Additional public pages

| Page | URL | Notes |
|---|---|---|
| Features | `/features` | Organized by game discovery, matchmaking, game creation, booking, reliability, communities, gamification, venue tools; label planned features as planned |
| For Organizers | `/organizers` | Supports the cold-start strategy: club organizers, coaches, college coordinators, corporate coordinators |
| Sports / Badminton | `/sports`, `/sports/badminton` | Badminton only until other sports have local supply and demand |
| Cities | `/cities/[CITY_SLUG]` | Publish only where there's enough verified information; avoid empty city pages |
| About | `/about` | Mission, vision, team; avoid unsupported scale or leadership claims |
| Blog | `/blog` | Badminton tips, finding partners, local guides, venue management, tournament organization |

### 6.10 Admin additions

Reported communities, repeated cancellation and booking abuse detection, reliability-score disputes, proportionate restrictions with audit trail. Do not penalize a user automatically for a single cancellation or a disputed report.

### 6.11 Phase 2 success metrics

- Repeat attendance and week-over-week return rate
- Organizers who create recurring games with repeat attendance
- Players who connect with a compatible player and progress to a real game
- Venue repeat-booking rate

---

## 7. Phase 3: Monetization and scale

**Goal:** turn engagement into sustainable revenue and expand to more sports and cities, only where validated.

### 7.1 Revenue model

| Stream | Customer | Trigger | Placeholder |
|---|---|---|---|
| Booking commission | Venue / booking transaction | Completed eligible booking | `[BOOKING_COMMISSION_RATE]` |
| Venue subscription | Venue owner | Monthly or annual plan | `[VENUE_PLAN_PRICES]` |
| Player premium | Player | Subscription renewal | `[PLAYER_PREMIUM_PRICE]` |
| Tournament fees | Organizer or participant | Registration or organizer tools | `[TOURNAMENT_FEE_MODEL]` |
| Sponsorships | Brand or local business | Sponsored placement or event | `[SPONSORSHIP_PACKAGES]` |
| Advertising | Advertiser | Eligible impression or action | `[AD_REVENUE_MODEL]` |

Don't assume every stream will work from day one.

### 7.2 Pricing page (`/pricing`)

**Players**
- *Free:* profile, discover games, join public games, find venues, basic activity tracking
- *Premium:* `[PREMIUM_BENEFIT_1..4]`, such as advanced matchmaking filters, enhanced statistics, extra community features
- Never put basic safety, essential booking information, or fair treatment behind a paywall

**Venues**
- *Starter:* listing, basic court management, booking visibility
- *Growth:* advanced booking management, promotions, analytics
- *Enterprise:* multi-location, advanced reporting, team access

**Organizers:** free community management, paid tournament management, optional transaction fees, premium tools

**Transaction charges:** booking commission, processing fees, refund treatment, cancellation charges, settlement timing. State who pays each.

**Pricing FAQs:** free usage, whether fees are included in the displayed price, subscription refunds, venue cancellation, what happens on a cancelled booking, additional payment charges.

### 7.3 Venue subscription and billing (`/venue/billing`)

Current plan, status, billing history, invoices, renewal date, plan comparison, upgrade or downgrade, cancellation. Clearly separate subscription charges from booking commissions and processing fees.

### 7.4 Advanced venue analytics (`/venue/analytics`)

Total bookings, gross booking value, venue revenue, average booking value, court utilization, peak and off-peak demand, cancellation rate, repeat booking rate, booking source.

`Court Utilization = Booked Available Court-Hours / Total Bookable Court-Hours × 100`

Exclude hours the venue intentionally marks unavailable from the denominator.

### 7.5 Tournaments and leagues

**Directory** (`/app/tournaments`): filters for sport, city, date, skill, format, registration status, entry fee.

**Details** (`/app/tournaments/[TOURNAMENT_ID]`): description, organizer, date and location, format and rules, eligibility, fees, deadline, participants, fixtures, standings, results, prizes.

**Registration flow:** review eligibility, choose individual or team, add details, accept rules, pay, confirm.

**Leagues (later):** season schedule, standings, results, points table, promotion or relegation, awards. Launch simple tournaments before a full league engine.

### 7.6 Expansion

- Additional sports using the same template (`/sports/football`, `/sports/tennis`, `/sports/pickleball`, `/sports/basketball`)
- Additional cities with city and sport landing pages
- Regional-language support
- Sponsored events

### 7.7 Platform operations

- Advanced fraud detection
- Admin business configuration (`/admin/settings`): commission, plans, supported sports and cities, payment config, cancellation rules, notification templates, feature flags, languages
- Admin tournament management and dispute resolution
- Content management (homepage, features, FAQs, blog, city and sport pages, promotions, legal versions)
- Reconciliation reporting: settlements, refunds, commission, failed payments
- Restrict financial and access-control changes to authorized roles

### 7.8 Wallets

If you introduce stored balances or transferable funds later, check the regulatory and payment-provider requirements before launch.

### 7.9 Unit-economics dashboard

Track gross booking value, platform commission revenue, payment processing costs, refund and chargeback costs, discounts, support costs per booking, contribution margin per booking, bookings per active user per month, repeat booking rate, retention at months 3, 6, and 12, and venue retention and renewal.

`Contribution per Booking = Platform Revenue − Variable Payment Costs − Refund/Chargeback Costs − Booking-Level Incentives − Other Variable Fulfillment Costs`

Don't confuse total booking value with platform revenue.

---

## 8. What not to build early

- A complex AI recommendation engine
- A full social-media feed
- Large in-app messaging
- Multiple sports across many cities
- Elaborate gamification
- Sophisticated league-management software
- A complicated wallet system

These consume time without proving that players will repeatedly join games.

---

## Appendix A: Navigation

**Public website:** Find Games, Find Venues, How It Works, For Venues, Pricing, Log In, Join Now. Dropdowns: Find Games (Browse Games, Find Players), Find Venues (Browse Venues, Explore Cities), For Venues (Benefits, Partner Registration).

**Player app (mobile-first):** `Home | Discover | Create | My Games | Profile`
- Home: recommended games, upcoming sessions, community activity
- Discover: games, players, venues, communities, tournaments
- Create: game, community, event (if permitted)
- My Games: upcoming, hosting, joined, completed
- Profile: profile, achievements, notifications, settings, payments

Use a sidebar with the same structure on desktop.

**Venue portal:** Dashboard, Calendar, Bookings, Courts, Venue Profile, Pricing & Promotions, Customers, Analytics, Billing, Settings

**Admin:** Dashboard, Users, Venues, Bookings, Payments, Games, Communities, Tournaments, Reports & Moderation, Content, Analytics, Settings

---

## Appendix B: Key user journeys

| Journey | Steps | Success metric |
|---|---|---|
| **A. Join a game** | Homepage, pick sport and city, browse, filter, open game, review host and venue, join, pay if required, confirmation, attend, feedback | Eligible viewers who join |
| **B. Find a partner** | Create profile, set skill and availability, Find Players, filter, invite to a game or create one, share, confirm | Connections that become real games |
| **C. Book a court** | Search venues, select venue, review courts, pick slot, review price and policy, pay, confirmation, share, attend | Paid and fulfilled bookings per active user |
| **D. Venue wants bookings** | Partner page, review pricing, register, verify, add courts, set prices, publish availability, receive bookings, track revenue | Approved venues with a first fulfilled booking |
| **E. Build a community** | Register, create community, invite members, create first game, share, track confirmations, host, schedule next | Organizers with recurring games and repeat attendance |

---

## Appendix C: Data model

| Entity | Purpose | Example fields |
|---|---|---|
| User | Account identity | `user_id`, `status`, `created_at` |
| PlayerProfile | Sports preferences | `user_id`, `skill_level`, `preferences` |
| Sport | Supported sport | `sport_id`, `name`, `status` |
| Venue | Sports facility | `venue_id`, `owner_id`, `location`, `status` |
| Court | Bookable area | `court_id`, `venue_id`, `sport_id` |
| AvailabilitySlot | Bookable time | `slot_id`, `court_id`, `start_at`, `end_at` |
| Booking | Venue reservation | `booking_id`, `user_id`, `court_id`, `status` |
| Payment | Transaction | `payment_id`, `booking_id`, `amount`, `status` |
| Refund | Refund record | `refund_id`, `payment_id`, `amount`, `status` |
| Game | Playing session | `game_id`, `host_id`, `venue_id`, `start_at` |
| GameParticipant | Game membership | `game_id`, `user_id`, `status` |
| Community | Sports group | `community_id`, `name`, `visibility` |
| CommunityMember | Membership | `community_id`, `user_id`, `role` |
| Tournament | Competition | `tournament_id`, `organizer_id`, `status` |
| TournamentEntry | Registration | `tournament_id`, `user_id`, `status` |
| Attendance | Participation record | `game_id`, `user_id`, `attendance_status` |
| Review | Feedback | `review_id`, `author_id`, `target_id` |
| Achievement | Reward definition | `achievement_id`, `criteria` |
| UserAchievement | Earned reward | `user_id`, `achievement_id`, `earned_at` |
| Notification | Message | `notification_id`, `user_id`, `type`, `status` |
| Subscription | Commercial plan | `subscription_id`, `account_id`, `plan_id`, `status` |
| AuditLog | Admin trace | `actor_id`, `action`, `created_at` |

**Key relationships**
- A venue has many courts; a court has many availability slots
- A booking reserves one court for one time interval
- A game has many participants and can optionally reference a venue and booking
- Bookings and games are separate records
- A user can play, join communities, and own a venue
- Payments trace to the commercial action they belong to
- Attendance is distinct from registration

---

## Appendix D: Technical integrity requirements

- Prevent overlapping confirmed bookings for the same court
- Store money as fixed-precision or integer minor units
- Use consistent timestamps and display local time zones
- Keep an auditable record of payment and booking state changes
- Enforce permissions on the server, not only in the UI
- Use idempotency and reliable event processing for payment callbacks
- Define retention and deletion rules for personal data
- Do not give admin tools unrestricted access to raw payment credentials
- Record the reason and authorization for sensitive administrative actions

---

## Appendix E: Design system

**Global components:** logo, header, footer, location selector, sport selector, search bar, notification indicator, user menu, language selector

**Discovery:** game, venue, player, community, and tournament cards; filter panel; sort menu; availability calendar; map/list toggle (optional)

**Transaction:** price breakdown, booking summary, payment status, confirmation screen, cancellation dialog, refund status, terms acknowledgment

**Trust:** verification badge, attendance summary, reliability explanation, report and block buttons, review form

**Screen states to design for every important screen:** loading, empty, error, success, permission denied, offline or connection failure, session expired, unavailable resource, restricted or suspended account

**Brand placeholders:** `[PRIMARY_COLOR]`, `[SECONDARY_COLOR]`, `[ACCENT_COLOR]`, `[HEADING_FONT]`, `[BODY_FONT]`, `[LOGO_ASSET]`, `[ICON_LIBRARY]`, `[DESIGN_REFERENCE]`

Prioritize mobile usability, fast load, readable pricing, and accessible controls.

---

## Appendix F: URL and SEO structure

**Public**
```text
/  /how-it-works  /features  /players  /venues/partners  /organizers
/sports  /sports/badminton  /cities  /cities/[CITY_SLUG]  /cities/[CITY_SLUG]/badminton
/pricing  /about  /contact  /blog  /help
/legal/terms  /legal/privacy  /legal/refunds  /legal/cancellation-policy
/legal/community-guidelines  /legal/cookies
```

**Player app**
```text
/app  /app/games  /app/games/[GAME_ID]  /app/games/create
/app/players  /app/players/[USER_ID]
/app/venues  /app/venues/[VENUE_ID]
/app/bookings/[BOOKING_ID]  /app/my-games
/app/communities  /app/communities/[COMMUNITY_ID]
/app/tournaments  /app/tournaments/[TOURNAMENT_ID]
/app/profile/[USER_ID]  /app/achievements  /app/notifications
/app/payments  /app/settings
```

**Venue portal**
```text
/venue/register  /venue/verification  /venue/dashboard  /venue/profile
/venue/courts  /venue/calendar  /venue/bookings  /venue/pricing
/venue/customers  /venue/analytics  /venue/billing
```

**Admin**
```text
/admin/dashboard  /admin/users  /admin/venues  /admin/bookings  /admin/payments
/admin/moderation  /admin/tournaments  /admin/trust-safety  /admin/content  /admin/settings
```

**SEO notes**
- Descriptive titles and meta descriptions on public pages; canonical URLs; sitemaps for indexable pages
- Keep private app pages out of search results
- Do not index private player profiles or unpublished games
- Prevent filter-heavy pages from creating unlimited duplicate URLs
- Use structured data only where the content qualifies
- Do not expose internal identifiers or sensitive information unnecessarily

---

## Appendix G: Placeholder checklist

| Group | Placeholders |
|---|---|
| Identity | `[APP_NAME]`, `[APP_TAGLINE]`, `[APP_LOGO]`, `[LOGO_ASSET]` |
| Market | `[LAUNCH_CITY]`, `[TARGET_COUNTRY / TARGET_REGION]`, `[CITY_NAME]`, `[CITY_SLUG]` |
| Copy | `[PRIMARY_HEADLINE]`, `[HERO_DESCRIPTION]`, `[PROBLEM_STATEMENT]`, `[VENUE_OWNER_HEADLINE]`, `[ORGANIZER_HEADLINE]`, `[BADMINTON_HEADLINE]`, `[MISSION_STATEMENT]`, `[VISION_STATEMENT]` |
| Social proof | `[NUMBER_OF_PLAYERS]`, `[NUMBER_OF_PARTNER_VENUES]`, `[NUMBER_OF_GAMES_PLAYED]`, `[PLAYER_TESTIMONIALS]`, `[VENUE_PARTNER_TESTIMONIALS]` (use verified data only) |
| Pricing | `[PLAYER_FREE_PRICE]`, `[PLAYER_PREMIUM_PRICE]`, `[VENUE_STARTER_PRICE]`, `[VENUE_GROWTH_PRICE]`, `[VENUE_ENTERPRISE_PRICE]`, `[BOOKING_COMMISSION_RATE]`, `[TOURNAMENT_FEE_MODEL]`, `[SPONSORSHIP_PACKAGES]`, `[AD_REVENUE_MODEL]` |
| Providers | `[UPI_PROVIDER]`, `[CARD_PROVIDER]`, `[EMAIL_PROVIDER]`, `[SMS_OR_OTP_PROVIDER]`, `[PUSH_NOTIFICATION_PROVIDER]`, `[EMAIL_LOGIN]`, `[PHONE_LOGIN]`, `[OTP_PROVIDER]`, `[SOCIAL_LOGIN_OPTIONS]` |
| Brand | `[PRIMARY_COLOR]`, `[SECONDARY_COLOR]`, `[ACCENT_COLOR]`, `[HEADING_FONT]`, `[BODY_FONT]`, `[ICON_LIBRARY]`, `[DESIGN_REFERENCE]` |
| Company | `[TEAM_MEMBERS]`, `[COMPANY_DETAILS]`, `[CONTACT_DETAILS]` |
