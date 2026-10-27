# Playlo — API & tRPC Architecture Specification

> **Framework:** tRPC v11 + Next.js 15 Server Route Handlers  
> **Type Safety:** End-to-End Type Inference (Zero Code Generation)  
> **Schema Validation:** Zod as the Single Source of Truth (`packages/validators`)  
> **Webhooks:** Next.js Dedicated API Route Handlers (HMAC-SHA256 Signed)  
> **Asynchronous Events:** Upstash QStash Webhook Trigger Callbacks

---

## 1. tRPC Router Tree & Procedure Hierarchy

The API layer is centralized in `packages/api` and mounted at `/api/trpc` inside each application. Frontends infer types directly without API SDK generation or OpenAPI drift.

```
appRouter
├── auth
│   ├── sendOtp                 # Public: Dispatches 6-digit OTP via MSG91
│   ├── verifyOtp               # Public: Validates OTP and returns session token
│   ├── getSession              # Public: Returns current authenticated session
│   └── logout                  # Protected: Invalidates current session
├── user
│   ├── me                      # Protected: Returns active user with player profile
│   ├── updateProfile           # Protected: Updates sports prefs, bio, skill level
│   ├── updateAvatar            # Protected: Stores pre-signed R2 image upload URL
│   └── getPublicProfile        # Public: Returns sanitized profile (no phone/email)
├── game
│   ├── create                  # Protected: Creates a game session (draft or open)
│   ├── list                    # Public: Filtered game discovery (sport, city, date, format)
│   ├── getById                 # Public: Game details, participant list, host stats
│   ├── join                    # Protected: Reserves spot in game (handles capacity)
│   ├── leave                   # Protected: Leaves game, releases spot, refunds if needed
│   ├── cancel                  # Host/Admin: Cancels game and triggers player notifications
│   └── markComplete            # Host: Closes game and opens attendance rating prompt
├── venue
│   ├── searchNearby            # Public: PostGIS geo-discovery with radius & sport filters
│   ├── getBySlug               # Public: Full venue detail, courts, images, policies
│   ├── getAvailability         # Public: Authoritative real-time court availability matrix
│   └── submitReview            # Protected: Post-play review and rating
├── booking
│   ├── initiateHold            # Protected: Ephemeral Redis lock + pending booking entry
│   ├── getById                 # Protected: Booking receipt & QR confirmation code
│   ├── listMyBookings          # Protected: Paginated player booking history
│   └── cancelBooking           # Protected: Policy-enforced cancellation & refund initiation
├── payment
│   ├── createRazorpayOrder     # Protected: Creates signed Razorpay order with Route split
│   ├── verifyPayment           # Protected: Client-side signature verification backup
│   └── getReceipt              # Protected: Tax invoice details
├── community (Phase 2)
│   ├── list                    # Public: Directory of local sports clubs
│   ├── getBySlug               # Public: Community details, regular games, members
│   ├── join                    # Protected: Member addition (public or request-based)
│   └── postAnnouncement        # CommunityAdmin: Broadcast to members
├── venuePortal
│   ├── getDashboardStats       # VenueStaff: Today's bookings, utilization, revenue
│   ├── listCourts              # VenueStaff: Court configurations and rate rules
│   ├── updateCourtPricing      # VenueOwner: Set base and peak slot prices
│   ├── blockSlot               # VenueStaff: Manual maintenance hold
│   └── listSettlements         # VenueOwner: Payout logs and commission deductions
└── admin
    ├── listPendingVenues       # Admin: Verification queue of venue applications
    ├── reviewVenueApplication  # Admin: Approve or reject venue listing
    ├── listFlaggedContent      # Moderator: Reported games, abusive profiles
    ├── suspendUser             # Admin: Revoke access with justification
    └── getPlatformAnalytics    # Admin: Platform-wide GMV, take rate, active games
```

---

## 2. tRPC Context & Middleware Stack

```typescript
// packages/api/src/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './lib/redis';

// Initialize tRPC instance
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ---------------------------------------------------------
// Rate Limiter Middleware
// ---------------------------------------------------------
const globalRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requests per minute
  analytics: true,
  prefix: 'ratelimit:global',
});

const withRateLimit = t.middleware(async ({ ctx, next }) => {
  const ip = ctx.clientIp ?? '127.0.0.1';
  const { success, limit, remaining, reset } = await globalRateLimiter.limit(ip);
  if (!success) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded. Try again in ${Math.ceil((reset - Date.now()) / 1000)}s.`,
    });
  }
  return next();
});

// ---------------------------------------------------------
// Authenticated Procedure
// ---------------------------------------------------------
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user || !ctx.session.user.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to execute this operation.',
    });
  }
  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: ctx.session.user,
      },
    },
  });
});

export const protectedProcedure = t.procedure.use(withRateLimit).use(isAuthenticated);

// ---------------------------------------------------------
// Role-Based Access Control (RBAC) Middleware
// ---------------------------------------------------------
export const requireRole = (allowedRoles: string[]) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    const hasRole = ctx.session.user.roles.some((role: string) =>
      allowedRoles.includes(role)
    );
    if (!hasRole) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Insufficient administrative privileges.',
      });
    }
    return next();
  });

export const adminProcedure = protectedProcedure.use(
  requireRole(['ADMINISTRATOR', 'SUPPORT_AGENT'])
);

export const venueOwnerProcedure = protectedProcedure.use(
  requireRole(['VENUE_OWNER', 'ADMINISTRATOR'])
);
```

---

## 3. Zod Input & Output Validation Schemas

All schemas reside in `packages/validators` to share type definitions with React Hook Form and frontend components.

```typescript
// packages/validators/src/game.ts
import { z } from 'zod';

export const CreateGameSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  sportSlug: z.string().default('badminton'),
  startTime: z.date().refine((d) => d > new Date(), {
    message: 'Start time must be in the future',
  }),
  endTime: z.date(),
  format: z.enum(['SINGLES', 'DOUBLES', 'ANY']).default('DOUBLES'),
  minSkillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE']).default('BEGINNER'),
  maxSkillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE']).default('COMPETITIVE'),
  maxParticipants: z.number().int().min(2).max(12).default(4),
  costPerPlayerPaise: z.number().int().min(0).default(0),
  visibility: z.enum(['PUBLIC', 'PRIVATE_INVITE', 'COMMUNITY_ONLY']).default('PUBLIC'),
  venueId: z.string().cuid().optional(),
  bookingId: z.string().cuid().optional(),
  customLocationName: z.string().max(100).optional(),
  rulesDescription: z.string().max(1000).optional(),
}).refine((data) => data.endTime > data.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const FilterGameSchema = z.object({
  city: z.string().default('Sirsa'),
  sportSlug: z.string().default('badminton'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required').optional(),
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE']).optional(),
  format: z.enum(['SINGLES', 'DOUBLES', 'ANY']).optional(),
  onlyAvailable: z.boolean().default(true),
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

// packages/validators/src/booking.ts
export const InitiateBookingSchema = z.object({
  courtId: z.string().cuid(),
  startTime: z.string().datetime({ message: 'Must be ISO 8601 UTC timestamp' }),
  endTime: z.string().datetime({ message: 'Must be ISO 8601 UTC timestamp' }),
  gameId: z.string().cuid().optional(), // Optional association
});
```

---

## 4. Webhook Handlers: Razorpay Signature & Idempotency

External callbacks bypass tRPC and terminate at Next.js Edge/Serverless Route Handlers:

```typescript
// apps/player/app/api/webhooks/razorpay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@playlo/db';
import { serverEnvSchema } from '@playlo/config/env';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;

    // STEP 1: Verify HMAC-SHA256 Signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    // STEP 2: Idempotent Event Processing
    if (event === 'order.paid' || event === 'payment.captured') {
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      await prisma.$transaction(async (tx) => {
        // Look up corresponding payment record
        const payment = await tx.payment.findUnique({
          where: { razorpayOrderId: orderId },
          include: { booking: true },
        });

        if (!payment) {
          console.warn(`Payment record for order ${orderId} not found`);
          return;
        }

        // Check if already processed (Idempotency)
        if (payment.status === 'SUCCEEDED') {
          return;
        }

        // Update payment state
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            razorpayPaymentId: paymentId,
            paymentMethod: paymentEntity.method?.toUpperCase() || 'UPI',
          },
        });

        // Transition Booking state to CONFIRMED
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'CONFIRMED' },
        });

        // Trigger transactional notification
        await tx.notification.create({
          data: {
            userId: payment.userId,
            type: 'BOOKING_CONFIRMED',
            title: 'Court Booking Confirmed!',
            body: `Your court booking ${payment.booking.bookingNumber} is confirmed.`,
            linkUrl: `/app/bookings/${payment.bookingId}`,
          },
        });
      });
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err: any) {
    console.error('Razorpay Webhook Error:', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
```

---

## 5. Asynchronous Job Dispatch via Upstash QStash

```typescript
// packages/api/src/services/jobs.ts
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export async function scheduleGameReminder(params: {
  gameId: string;
  gameStartTime: Date;
}) {
  const { gameId, gameStartTime } = params;

  // Schedule notification 2 hours before start
  const reminderTimeMs = gameStartTime.getTime() - 2 * 60 * 60 * 1000;
  const nowMs = Date.now();

  if (reminderTimeMs <= nowMs) {
    // If game starts in under 2 hours, fire immediately
    return;
  }

  const delaySeconds = Math.floor((reminderTimeMs - nowMs) / 1000);

  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/qstash/game-reminder`,
    body: { gameId },
    delay: delaySeconds,
  });
}
```

---

## 6. Standardized Error Formats & HTTP Mapping

| tRPC Error Code | HTTP Equivalent | Scenario |
| :--- | :--- | :--- |
| `BAD_REQUEST` | 400 | Zod input schema validation failure |
| `UNAUTHORIZED` | 401 | Missing or expired auth cookie/token |
| `FORBIDDEN` | 403 | Attempting to access admin panel or foreign venue dashboard |
| `NOT_FOUND` | 404 | Game, court, or user not found in database |
| `CONFLICT` | 409 | Slot already booked or held by concurrent user |
| `TOO_MANY_REQUESTS`| 429 | Exceeded sliding-window rate limit |
| `INTERNAL_SERVER_ERROR`| 500 | Unhandled database or gateway failure |

