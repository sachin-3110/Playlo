# 04 · API Specification

| | |
|---|---|
| **Status** | v2.0 — Zod validators (§6) are **executable and tested** (7 tests on Zod 4, source in [`_verification/validators/`](./_verification/README.md)); middleware (§2) is reference code |
| **Audience** | Backend and frontend engineers, QA, security reviewers |
| **Related** | [03-data-model](./03-data-model.md) · [05-business-logic](./05-business-logic.md) · [07-security-privacy-compliance](./07-security-privacy-compliance.md) |

---

## 1. API surface

| Surface | Transport | Consumers | Notes |
|---|---|---|---|
| **tRPC v11** | `POST/GET /api/trpc/*` (batched, SuperJSON) | The web app (client + server components) | Internal contract; client and server deploy together. Enable Vercel **skew protection** so a stale tab never calls a removed procedure. |
| **Auth endpoints** | `/api/auth/*` — owned by the auth library (ADR-004) | Browser | OTP send/verify, session, sign-out. Contract in §7. |
| **Webhooks** | `POST /api/webhooks/razorpay` | Razorpay | HMAC over the raw body; inbox table; see 05 §2.4 |
| **Job callbacks** | `POST /api/jobs/{name}` | QStash | Signature-verified; idempotent; see 02 §8 |
| **Health** | `GET /api/health` | Uptime monitor | DB ping + Redis ping; no secrets |

There is **no public REST API** in the MVP. If a native app or partner integrations arrive, add a versioned REST façade (`/api/v1`) over the same services rather than exposing tRPC procedures directly.

## 2. Procedure types and middleware chain

Every procedure runs a chain in this order. Rate limiting precedes authentication so unauthenticated floods are cheap to reject; authorisation checks **permission and resource ownership**.

```text
requestId → logging → rateLimit(policy) → authenticate? → authorise(permission) → resourceGuard? → input validation (Zod) → handler
```

| Builder | Chain |
|---|---|
| `publicProcedure(policy)` | requestId, logging, **rate limit (per IP)** |
| `authedProcedure(policy)` | + authenticate (active, not suspended, not deleted) + rate limit **per user** |
| `permissionProcedure(permission, policy)` | + `can(ctx.user, permission)` for **platform** permissions |
| `venueProcedure(permission, policy)` | + resolves `venueId` from input and checks the caller's `VenueStaff` row grants `permission` **for that venue** |
| `adminProcedure(permission, policy)` | platform roles only; every mutation writes `AuditLog` with a mandatory `reason` where flagged |

```ts
// packages/api/src/trpc.ts — reference implementation
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const domain = error.cause instanceof DomainError ? error.cause : null;
    return {
      ...shape,
      message: domain ? domain.publicMessage : shape.message,   // never leak SQL / provider text
      data: {
        ...shape.data,
        stack: undefined,
        domainCode: domain?.code ?? null,
        fieldErrors: error.cause instanceof ZodError ? error.cause.flatten().fieldErrors : null,
      },
    };
  },
});

const withRateLimit = (policy: keyof typeof POLICIES, by: 'ip' | 'user') =>
  t.middleware(async ({ ctx, next }) => {
    const key = by === 'user' ? ctx.session?.user.id : ctx.clientIp;
    if (!key) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unable to identify client' }); // v1 defaulted to 127.0.0.1
    const p = POLICIES[policy];
    let res;
    try { res = await p.limiter.limit(`${policy}:${key}`); }
    catch (e) {
      if (p.failClosed) throw new TRPCError({ code: 'SERVICE_UNAVAILABLE' });   // OTP, payments
      return next();                                                            // reads fail open
    }
    if (!res.success) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: `Try again in ${Math.ceil((res.reset - Date.now()) / 1000)}s` });
    return next();
  });

const authenticate = t.middleware(({ ctx, next }) => {
  const u = ctx.session?.user;
  if (!u) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (u.status !== 'ACTIVE') throw new TRPCError({ code: 'FORBIDDEN', message: 'Account restricted' });
  return next({ ctx: { ...ctx, user: u } });
});

export const publicProcedure = (policy: PolicyName) => t.procedure.use(withRequestId).use(withRateLimit(policy, 'ip'));
export const authedProcedure = (policy: PolicyName) => publicProcedure('public-read').use(authenticate).use(withRateLimit(policy, 'user'));

export const adminProcedure = (permission: PlatformPermission, policy: PolicyName = 'admin') =>
  authedProcedure(policy).use(async ({ ctx, next }) => {
    if (!can(ctx.user.platformRoles, permission)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });

export const venueProcedure = (permission: VenuePermission, policy: PolicyName = 'venue') =>
  authedProcedure(policy).input(z.object({ venueId: z.cuid2() }).passthrough()).use(async ({ ctx, input, next }) => {
    const staff = await ctx.db.venueStaff.findUnique({ where: { venueId_userId: { venueId: input.venueId, userId: ctx.user.id } } });
    if (!staff || !VENUE_PERMISSIONS[staff.role].includes(permission)) throw new TRPCError({ code: 'FORBIDDEN' }); // same code for "not found" to avoid enumeration
    return next({ ctx: { ...ctx, venueId: input.venueId, venueRole: staff.role } });
  });
```

What changed from v1:

- v1 declared `publicProcedure = t.procedure` with **no rate limit**, yet `auth.sendOtp` was public — the one endpoint that costs real money per call (SMS) was the one unprotected endpoint.
- v1's limiter keyed on IP with a fallback of `127.0.0.1`, so any request without a resolvable IP shared one bucket (and an attacker could exhaust it for everyone). v2 refuses requests it cannot identify. On Vercel, take the client IP from the platform-set forwarding header; never from a client-supplied header on other hosts.
- v1's `venueOwnerProcedure` checked only that the user had the global `VENUE_OWNER` role — **any** venue owner could read or edit **any** venue (IDOR). v2 resolves the venue from input and checks staff membership for *that* venue.
- v1's `adminProcedure` let `SUPPORT_AGENT` through for all admin routes. v2 checks a named permission per procedure.

## 3. Permission model

Authorisation is by **permission**, with roles as named bundles (product plan §4.2: "use permissions, not just role names"). The server is the only authority; the UI hides controls for convenience only. Role changes take effect on the next request (permissions are read from the database/JWT with a ≤ 5-minute TTL; revoke by bumping a `sessionVersion`).

### 3.1 Platform permissions

| Permission | SUPPORT_AGENT | MODERATOR | ADMINISTRATOR |
|---|:-:|:-:|:-:|
| `admin:user:read` (masked PII) | ✓ | ✓ | ✓ |
| `admin:user:read-full` (unmasked, audited) | | | ✓ |
| `admin:user:suspend` (reason required) | | ✓ | ✓ |
| `admin:booking:read` | ✓ | | ✓ |
| `admin:booking:cancel` (reason required) | ✓ | | ✓ |
| `admin:payment:read` | | | ✓ |
| `admin:refund:issue` (reason, dual-control above ₹X) | | | ✓ |
| `admin:venue:review` | | | ✓ |
| `admin:report:read` / `admin:report:resolve` | | ✓ | ✓ |
| `admin:game:moderate` | | ✓ | ✓ |
| `admin:config:edit` (pricing, flags) | | | ✓ |
| `admin:audit:read` | | | ✓ |
| `admin:webhook:replay` | | | ✓ |

Players have implicit self-service permissions (own profile, own bookings, joining/hosting games) enforced as **ownership checks**, not roles.

### 3.2 Venue permissions (scoped to one venue via `VenueStaff.role`)

| Permission | OWNER | MANAGER | STAFF |
|---|:-:|:-:|:-:|
| `venue:read` (dashboard, calendar) | ✓ | ✓ | ✓ |
| `venue:booking:read` | ✓ | ✓ | ✓ |
| `venue:calendar:block` | ✓ | ✓ | ✓ |
| `venue:booking:cancel` (venue-initiated → full player refund) | ✓ | ✓ | |
| `venue:profile:edit`, `venue:court:manage`, `venue:pricing:edit` | ✓ | ✓ | |
| `venue:finance:read` (revenue, settlements) | ✓ | | |
| `venue:staff:manage`, `venue:kyc:manage`, `venue:billing:manage` | ✓ | | |

A user may be OWNER at one venue and a player everywhere; permissions never leak across venues.

## 4. Router reference (Phase 1)

Legend — **Auth**: P public, U signed-in player, V venue permission, A platform permission. **Policy** names are defined in §5. `q` = query, `m` = mutation.

### 4.1 Player-facing

| Procedure | Kind | Auth | Policy | Purpose / notes |
|---|---|---|---|---|
| `user.me` | q | U | user-read | Current user, profile, onboarding step, consent status |
| `user.completeOnboarding` | m | U | user-write | Sport prefs, availability, coarse location (rounded server-side), match prefs |
| `user.updateProfile` | m | U | user-write | Name, bio, sports, skill, language |
| `user.updatePrivacy` | m | U | user-write | Discoverable, show attendance, notification prefs |
| `user.getAvatarUploadUrl` | m | U | upload | Pre-signed R2 PUT: content-type allow-list, ≤ 2 MB, key under `avatars/{userId}/` |
| `user.getPublicProfile` | q | U | user-read | Sanitised: no phone/email/exact location; respects `discoverable` and blocks |
| `user.block` / `unblock` / `listBlocked` | m/m/q | U | user-write | |
| `user.report` | m | U | report | Creates `Report` for game/user/venue/review |
| `user.acceptConsent` | m | U | user-write | Writes `ConsentRecord` (document + version) |
| `user.requestDeletion` | m | U | user-write | Starts the algorithm in 03 §8 |
| `sport.list` | q | P | public-read | Cached |
| `game.list` | q | P | public-read | `ListGamesSchema`; cursor pagination; respects visibility; returns seats left, distance if `nearLat/Lng` |
| `game.getById` | q | U | user-read | Full detail, participants (privacy-filtered), host stats, my status |
| `game.getByShareCode` | q | P | share | Payload for `/g/{code}` (05 §8): no PII, generic for private games |
| `game.create` | m | U | game-write | `CreateGameSchema`; creates host participant row; generates `shareCode`; schedules reminder |
| `game.update` | m | U (host) | game-write | Time/venue/capacity changes notify participants; capacity cannot drop below `confirmedCount` |
| `game.publish` / `confirm` / `cancel` / `complete` | m | U (host) / A | game-write | State machine in 03 §6.2; `cancel` requires reason |
| `game.join` | m | U | join | Atomic seat claim, waitlist, or request (05 §3.2) |
| `game.leave` | m | U | join | Promotes waitlist |
| `game.respondToRequest` | m | U (host) | game-write | Approve / decline |
| `game.removeParticipant` | m | U (host) | game-write | Reason recorded |
| `game.markAttendance` | m | U (host) | game-write | Within 48 h of completion |
| `game.myGames` | q | U | user-read | Tabs: upcoming, hosting, joined, invitations, completed, cancelled |
| `venue.searchNearby` | q | P | search | PostGIS query (03 §7.2); filters: sport, price, facilities, indoor/outdoor, rating |
| `venue.getBySlug` | q | P | public-read | Detail, courts, hours, policies, photos |
| `venue.getAvailability` | q | P | availability | `{courtId or venueId, date}` → slots (05 §4); never cached beyond rules |
| `booking.quote` | q | U | booking | Price breakdown for an interval without reserving |
| `booking.initiateHold` | m | U | booking-write | `InitiateHoldSchema` (idempotent) |
| `booking.getById` / `listMine` | q | U | user-read | Own bookings only (ownership check) |
| `booking.previewCancellation` | q | U | user-read | Refund the player would get **now** |
| `booking.cancel` | m | U | booking-write | Applies refund matrix |
| `payment.createOrder` | m | U | payment | Moves booking to `PAYMENT_PENDING`, creates Razorpay order with Route transfer |
| `payment.verify` | m | U | payment | Fast path (05 §2.4) |
| `payment.listMine` / `getReceipt` | q | U | user-read | Receipt = tax-invoice fields (GSTIN, HSN/SAC to confirm with CA) |
| `notification.list` / `markRead` / `markAllRead` | q/m/m | U | user-read | |
| `notification.registerPushToken` / `unregister` | m | U | user-write | FCM token per device |

### 4.2 Venue portal (`venueProcedure`, every input carries `venueId`)

| Procedure | Permission | Notes |
|---|---|---|
| `venuePortal.register` (no `venueId`; any signed-in user) | – | Creates `DRAFT` venue + OWNER staff row |
| `venuePortal.updateProfile`, `submitForReview` | `venue:profile:edit` | `submitForReview` enforces the publish gate (05 §5) |
| `venuePortal.getDocumentUploadUrl`, `listDocuments` | `venue:kyc:manage` | **Private** bucket; short-lived signed URLs |
| `venuePortal.startKyc`, `getKycStatus` | `venue:kyc:manage` | Creates Route linked account; status mirrored from webhooks |
| `venuePortal.createCourt` / `updateCourt` / `deactivateCourt` | `venue:court:manage` | |
| `venuePortal.setSchedule` / `setPricingRules` | `venue:pricing:edit` | Takes court lock; validates no overlap of windows |
| `venuePortal.blockSlot` / `unblockSlot` / `listBlocks` | `venue:calendar:block` | Rejects if live bookings overlap; returns them |
| `venuePortal.calendar` | `venue:read` | Day/week/month with bookings and blocks |
| `venuePortal.listBookings` / `getBooking` | `venue:booking:read` | Filters: status, date, court |
| `venuePortal.cancelBooking` | `venue:booking:cancel` | Reason required; triggers 100 % refund |
| `venuePortal.dashboard` | `venue:read` | Today's bookings, utilisation, pending actions; revenue only with `venue:finance:read` |
| `venuePortal.listSettlements` | `venue:finance:read` | From `Transfer` |
| `venuePortal.inviteStaff` / `removeStaff` / `setStaffRole` | `venue:staff:manage` | |

### 4.3 Admin (`adminProcedure`)

| Procedure | Permission | Notes |
|---|---|---|
| `admin.venues.queue` / `get` | `admin:venue:review` | Documents via signed URL |
| `admin.venues.review` | `admin:venue:review` | approve / reject(reason) / suspend(reason) → `AuditLog` |
| `admin.users.search` / `get` | `admin:user:read` | PII masked by default |
| `admin.users.suspend` / `reinstate` | `admin:user:suspend` | Reason + notification to user + appeal info |
| `admin.bookings.search` / `get` / `cancel` | `admin:booking:*` | |
| `admin.payments.list` / `get` / `reconcile` | `admin:payment:read` | Shows provider IDs, never card/UPI data |
| `admin.refunds.issue` | `admin:refund:issue` | Dual control above a configured amount |
| `admin.reports.list` / `resolve` | `admin:report:*` | |
| `admin.games.list` / `hide` / `cancel` | `admin:game:moderate` | |
| `admin.config.get` / `update` | `admin:config:edit` | Versioned; validated by Zod; audited with before/after |
| `admin.webhooks.list` / `replay` | `admin:webhook:replay` | Replays go through the same idempotent handler |
| `admin.audit.list` | `admin:audit:read` | |
| `admin.analytics.overview` | `admin:payment:read` | Registered users, MAU, games created/completed, bookings, active venues, cancellation and refund rates |

### 4.4 Later phases (behind server-side flags)

Phase 2: `community.*`, `player.search`, `review.*`, `achievement.*`, `referral.*`, `venuePortal.promotions.*`, `venuePortal.customers.*`. Phase 3: `tournament.*`, `venuePortal.billing.*`, `admin.tournaments.*`. Procedures for disabled features **must exist but throw `FEATURE_DISABLED`** (not merely be hidden in the UI), so a client cannot call Phase 2 logic early (see 08 §Feature flags).

### 4.5 Coverage check — Phase 1 pages to procedures

v1's router tree covered roughly 60 % of the pages the product plan required. Gaps found and closed in this version: join-request approval, participant removal, attendance marking, **venue registration/KYC/documents**, **court and pricing management** (v1 only had `listCourts`/`updateCourtPricing`), calendar, booking quote and cancellation preview, payment history, notification list and push tokens, privacy settings, block/report, account deletion, admin booking/payment search, refunds, config, audit, and webhook replay.

| Page (product plan) | Procedures |
|---|---|
| `/login`, `/verify` | Auth endpoints (§7) |
| `/onboarding` | `user.completeOnboarding`, `sport.list` |
| `/app` dashboard | `user.me`, `game.list`, `game.myGames`, `notification.list` |
| `/app/games` | `game.list` |
| `/app/games/[id]` | `game.getById`, `game.join/leave`, `user.report` |
| `/app/games/create` | `game.create`, `venue.searchNearby`, `venue.getAvailability`, `booking.quote` |
| `/app/venues`, `/app/venues/[id]` | `venue.searchNearby`, `venue.getBySlug`, `venue.getAvailability` |
| `/app/bookings/checkout`, `/[id]`, `/[id]/confirmation` | `booking.initiateHold`, `payment.createOrder`, `payment.verify`, `booking.getById` |
| `/app/my-games` | `game.myGames`, `game.respondToRequest`, `game.markAttendance` |
| `/app/payments` | `payment.listMine`, `payment.getReceipt` |
| `/app/settings`, `/app/profile/[id]` | `user.*` |
| `/venue/*` | `venuePortal.*` |
| `/admin/*` | `admin.*` |
| `/g/[code]` (new) | `game.getByShareCode` |

## 5. Rate-limit policies

Sliding window via Upstash Ratelimit. `failClosed` policies reject when Redis is unreachable (they protect money or SMS cost); others fail open.

| Policy | Key | Limit | failClosed |
|---|---|---|:-:|
| `public-read` | IP | 120 / min | |
| `search`, `availability` | IP | 60 / min | |
| `share` | IP | 120 / min | |
| `user-read` | user | 240 / min | |
| `user-write`, `game-write` | user | 60 / min | |
| `join` | user | 30 / min | |
| `booking`, `booking-write` | user | 10 / min | ✓ |
| `payment` | user | 10 / min | ✓ |
| `upload` | user | 10 / hour | |
| `report` | user | 10 / hour | |
| `venue`, `admin` | user | 120 / min | |
| **`otp-send`** | phone **and** IP | 1 / 30 s, 3 / 10 min per phone; 10 / hour per IP; global daily budget alarm | ✓ |
| **`otp-verify`** | challenge **and** IP | 5 attempts per challenge; 10 / 10 min per IP | ✓ |

Responses carry a `Retry-After` equivalent in the error message. Dashboards alert on sustained 429 rates (possible abuse) and on SMS spend anomalies (SMS-pumping — see 07 §3.1).

## 6. Input validation (Zod 4)

Schemas live in `packages/validators` and are shared by procedures and forms (React Hook Form resolver). The file below is executable; the tests in `validators.test.ts` cover cross-field rules, Indian-mobile validation, timestamp strictness and Razorpay identifier shapes.

Changes from v1's validators: instants must carry an explicit offset (naive `2026-11-01T18:00:00` is rejected — a classic source of off-by-5.5-hours bugs); `endTime > startTime`, minimum lead time, maximum duration, skill-range and participant-range cross-checks; a title limit consistent with the DB (`VarChar(120)`, v1 allowed 100 in Zod but 120 in the DB); `minParticipants`; `joinPolicy`; the booking schema now requires an idempotency key; `z.date()` replaced by ISO strings parsed to `Date` (safe over JSON and SuperJSON alike).

```ts
// packages/validators/src/index.ts  (Zod 4)
import { z } from 'zod';

export const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE'] as const;
export const SportFormatSchema = z.enum(['SINGLES', 'DOUBLES', 'ANY']);
export const SkillLevelSchema = z.enum(SKILL_LEVELS);
export const VisibilitySchema = z.enum(['PUBLIC', 'PRIVATE_INVITE', 'COMMUNITY_ONLY']);
export const JoinPolicySchema = z.enum(['OPEN', 'APPROVAL']);

const skillRank = (s: (typeof SKILL_LEVELS)[number]) => SKILL_LEVELS.indexOf(s);

/** ISO-8601 instant from the client → Date. Reject anything without an explicit zone. */
export const InstantSchema = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

export const IdempotencyKeySchema = z.uuid();
export const PhoneSchema = z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number'); // launch market only
export const OtpSchema = z.string().regex(/^\d{6}$/);

export const CreateGameSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    sportSlug: z.string().min(1).max(40),                 // existence/active checked in the service against Sport
    startTime: InstantSchema,
    endTime: InstantSchema,
    format: SportFormatSchema.default('DOUBLES'),
    minSkillLevel: SkillLevelSchema.default('BEGINNER'),
    maxSkillLevel: SkillLevelSchema.default('COMPETITIVE'),
    minParticipants: z.number().int().min(2).max(12).default(2),
    maxParticipants: z.number().int().min(2).max(12).default(4),
    costPerPlayerPaise: z.number().int().min(0).max(500_000).default(0), // ≤ ₹5 000; informational in Phase 1
    joinPolicy: JoinPolicySchema.default('OPEN'),
    visibility: VisibilitySchema.default('PUBLIC'),
    venueId: z.cuid2().optional(),
    bookingId: z.cuid2().optional(),
    communityId: z.cuid2().optional(),
    customLocationName: z.string().trim().max(100).optional(),
    rulesDescription: z.string().trim().max(1000).optional(),
    publish: z.boolean().default(true),                    // false → DRAFT
  })
  .superRefine((g, ctx) => {
    if (g.endTime <= g.startTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' });
    if (g.startTime.getTime() < Date.now() + 15 * 60_000) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Start time must be at least 15 minutes from now' });
    if (g.endTime.getTime() - g.startTime.getTime() > 8 * 3_600_000) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Games cannot exceed 8 hours' });
    if (skillRank(g.minSkillLevel) > skillRank(g.maxSkillLevel)) ctx.addIssue({ code: 'custom', path: ['minSkillLevel'], message: 'Minimum skill cannot exceed maximum' });
    if (g.minParticipants > g.maxParticipants) ctx.addIssue({ code: 'custom', path: ['minParticipants'], message: 'Minimum cannot exceed maximum players' });
    if (!g.venueId && !g.customLocationName) ctx.addIssue({ code: 'custom', path: ['customLocationName'], message: 'Choose a venue or enter a location' });
    if (g.bookingId && !g.venueId) ctx.addIssue({ code: 'custom', path: ['venueId'], message: 'A booking requires its venue' });
  });

export const ListGamesSchema = z.object({
  city: z.string().default('Sirsa'),
  sportSlug: z.string().default('badminton'),
  date: z.iso.date().optional(),                          // local (IST) calendar day
  skillLevel: SkillLevelSchema.optional(),
  format: SportFormatSchema.optional(),
  maxFeePaise: z.number().int().min(0).optional(),
  nearLat: z.number().min(-90).max(90).optional(),
  nearLng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().min(1).max(50).default(10),
  onlyWithSeats: z.boolean().default(true),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const InitiateHoldSchema = z.object({
  courtId: z.cuid2(),
  startTime: InstantSchema,
  endTime: InstantSchema,
  idempotencyKey: IdempotencyKeySchema,
  gameId: z.cuid2().optional(),
}).refine((v) => v.endTime > v.startTime, { path: ['endTime'], message: 'End time must be after start time' });

export const CreateOrderSchema = z.object({ bookingId: z.cuid2(), idempotencyKey: IdempotencyKeySchema });

export const VerifyPaymentSchema = z.object({
  razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/),
});

export const SendOtpSchema = z.object({ phone: PhoneSchema });
export const VerifyOtpSchema = z.object({ phone: PhoneSchema, code: OtpSchema });
```

## 7. Authentication contract

Transport is owned by the auth library selected in ADR-004; the **contract** below is fixed regardless of library. v1 exposed `auth.sendOtp`/`verifyOtp` as tRPC procedures *and* planned NextAuth, which both want to own session issuance; one of them has to give way.

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `POST /api/auth/otp/send` | `{ phone: "+91…" }` | `{ resendAfterSeconds: 30, expiresInSeconds: 300 }` (always the same shape, whether or not the phone exists — no enumeration) | `400` invalid number, `429` rate-limited, `503` provider down |
| `POST /api/auth/otp/verify` | `{ phone, code }` | Session cookie set (HttpOnly, Secure, SameSite=Lax) + `{ isNewUser }` | `400` wrong/expired code (generic message), `429` too many attempts |
| `POST /api/auth/signout` | – | Cookie cleared | – |
| `GET /api/auth/session` | – | `{ user: { id, status, platformRoles } } \| null` | – |

OTP rules: 6 digits from a CSPRNG; stored **hashed** (HMAC with a server secret) in Redis with 5-minute TTL; ≤ 5 attempts then the challenge is destroyed; a new send invalidates the previous code; constant-time comparison; India numbers only at launch (`+91`, validated by `PhoneSchema`); SMS goes through a DLT-registered template (07 §5). Dev/test environments use a fixed OTP gated on `APP_ENV !== 'production'` — never a production code path.

## 8. Errors

Domain errors carry a stable `code`, a safe public message (translatable) and an HTTP/tRPC mapping. The UI switches on `domainCode`, not on message text.

| `domainCode` | tRPC code | HTTP | Meaning / UI behaviour |
|---|---|---|---|
| `VALIDATION` | `BAD_REQUEST` | 400 | Field errors returned in `fieldErrors` |
| `UNAUTHENTICATED` | `UNAUTHORIZED` | 401 | Open OTP dialog; preserve form state |
| `FORBIDDEN` / `NOT_ELIGIBLE` | `FORBIDDEN` | 403 | Explain; never reveal whether a resource exists |
| `NOT_FOUND` | `NOT_FOUND` | 404 | |
| `SLOT_HELD` | `CONFLICT` | 409 | "Someone is checking out this slot; try again in a few minutes" |
| `SLOT_UNAVAILABLE` | `CONFLICT` | 409 | Refresh availability |
| `GAME_FULL` | `CONFLICT` | 409 | Offer waitlist |
| `ALREADY_JOINED` | `CONFLICT` | 409 | Navigate to game |
| `GAME_NOT_JOINABLE` | `PRECONDITION_FAILED` | 412 | Cancelled / started / closed |
| `SKILL_MISMATCH` / `NEEDS_HOST_APPROVAL` | `PRECONDITION_FAILED` | 412 | Offer "request to join" |
| `IDEMPOTENCY_KEY_REUSED` | `CONFLICT` | 409 | Same key, different payload: client bug |
| `PAYMENT_FAILED` | `BAD_REQUEST` | 400 | Allow retry on the same order while hold valid |
| `FEATURE_DISABLED` | `NOT_IMPLEMENTED` | 501 | Phase-gated feature called early |
| `RATE_LIMITED` | `TOO_MANY_REQUESTS` | 429 | Show wait time |
| `PROVIDER_UNAVAILABLE` | `SERVICE_UNAVAILABLE` | 503 | Razorpay/MSG91 outage; retry guidance |
| `INTERNAL` | `INTERNAL_SERVER_ERROR` | 500 | Generic message + request ID for support |

Every error response and log line contains the **request ID** so support can trace a complaint end to end.

## 9. Idempotency, pagination and conventions

- **Idempotency:** any mutation that creates money-bearing or capacity-consuming state takes a client-generated UUID `idempotencyKey` (one per *user intent*, regenerated only when the user changes the intent). The key has a unique index; a replay returns the original result; the same key with a different payload returns `IDEMPOTENCY_KEY_REUSED`.
- **Pagination:** cursor-based (`cursor`, `limit ≤ 50`), ordered by a stable `(sortKey, id)`; responses return `nextCursor`.
- **Dates:** inputs ISO-8601 with offset; outputs UTC instants (SuperJSON `Date`); calendar-day inputs (`date`) are IST local days.
- **Money:** always paise integers with a `…Paise` suffix; formatting is a UI concern.
- **Partial updates:** `update*` procedures take only changed fields; server re-validates the merged object.
- **Observability:** each procedure logs `procedure`, `durationMs`, `outcome`, `userId` (not PII), `requestId`.

## 10. Webhook and job endpoints

| Endpoint | Verification | Idempotency | Retry semantics |
|---|---|---|---|
| `POST /api/webhooks/razorpay` | HMAC-SHA256 of the **raw** body with the webhook secret, compared in constant time; reject without `x-razorpay-event-id` | Inbox unique `(provider, eventId)` + idempotent handlers | 2xx = done (also duplicates and unknown events); 5xx = Razorpay retries with backoff |
| `POST /api/jobs/booking-expire` | `Receiver.verify` (QStash current + next signing keys) | Re-evaluates current state; safe to run N times | Non-2xx → QStash retries; mark permanently-failed work with QStash's non-retryable signalling (confirm header in current docs) |
| `POST /api/jobs/payment-reconcile` | same | `confirmPayment()` is idempotent | same |
| `POST /api/jobs/game-reminder` | same | `dedupeKey` on notifications | same |
| `POST /api/jobs/notification-deliver` | same | Provider idempotency where available; `dedupeKey` | Exponential backoff; give up → `FAILED` + alert |
| `POST /api/jobs/ops-sweep` | same | Pure re-dispatch | – |

v1's webhook compared signatures with `!==` (not constant-time), dispatched on `payload.event` without deduplicating deliveries, never validated the amount, ignored `payment.failed` and refunds, logged with `console.error`, and sat inside `apps/player` although four apps were planned (each would have needed its own endpoint). All corrected in 05 §2.4.
