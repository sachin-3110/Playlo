# Playlo — Core Engines & Business Workflows

> **Core Domains:** Court Booking Engine, Game Lifecycle Engine, Venue Scheduling Engine, Reliability & Reputation Algorithm  
> **Currency Units:** Indian Paise (Integer precision)  
> **Key SLA:** Zero Double-Bookings, Sub-50ms Availability Checks, Zero Unreconciled Payments

---

## 1. Court Booking & Checkout Engine

The booking engine coordinates slot reservation, payment escrow/split, and transactional confirmation.

```
+-----------------------------------------------------------------------------------+
|                           BOOKING & CHECKOUT FLOW                                 |
+-----------------------------------------------------------------------------------+
  Player               Player App            API / Redis          Database / Neon       Razorpay
    |                      |                      |                      |                 |
    |-- 1. Select Slot --->|                      |                      |                 |
    |                      |-- 2. Initiate Hold ->|                      |                 |
    |                      |                      |-- 3. Set Redis Hold->|                 |
    |                      |                      |   (TTL = 300s)       |                 |
    |                      |                      |-- 4. DB Advisory Lock                  |
    |                      |                      |      Insert PENDING  |                 |
    |                      |<-- 5. Lock Success --|                      |                 |
    |                      |                                                               |
    |-- 6. Click Pay ----->|                                                               |
    |                      |-- 7. Create Razorpay Order ---------------------------------->|
    |                      |      (Amount + Platform Fee + Route Transfer Details)         |
    |                      |<-- 8. Return Order ID & Key ----------------------------------|
    |                      |                                                               |
    |-- 9. Complete UPI -->|                                                               |
    |                      |                                                               |-- Webhook --+
    |                      |                                                               |             |
    |                      |<---------------- 10. Webhook Triggered -------------------------------------+
    |                      |                  - Verify Signature                           |
    |                      |                  - Confirm DB Booking                         |
    |                      |                  - Release Redis Lock                         |
    |                      |                  - Dispatch Notification                      |
    |<-- 11. View Receipt -|                                                               |
```

### 1.1 Fee Breakdown & Revenue Calculation

For any booking in India, fee calculations must follow strict taxation and commission schedules:

```typescript
// packages/validators/src/pricing.ts
export interface BookingFeeBreakdown {
  baseCourtFeePaise: number;     // Set by venue (e.g. ₹400 = 40000 paise)
  platformFeePaise: number;      // Fixed convenience charge (e.g. ₹20 = 2000 paise)
  gstOnPlatformFeePaise: number; // 18% GST on platform fee only (e.g. 18% of ₹20 = ₹3.60 = 360 paise)
  totalPayablePaise: number;     // What the user pays
  platformCommissionPaise: number; // Commission deducted from venue payout (e.g. 10% = 4000 paise)
  venueNetPayoutPaise: number;   // What the venue receives
}

export function calculateBookingFees(courtHourlyRatePaise: number, durationHours: number = 1): BookingFeeBreakdown {
  const baseCourtFeePaise = courtHourlyRatePaise * durationHours;
  const platformFeePaise = 2000; // Flat ₹20 convenience fee
  const gstOnPlatformFeePaise = Math.round(platformFeePaise * 0.18);
  const totalPayablePaise = baseCourtFeePaise + platformFeePaise + gstOnPlatformFeePaise;

  // Platform takes 10% commission from venue rate
  const platformCommissionPaise = Math.round(baseCourtFeePaise * 0.10);
  const venueNetPayoutPaise = baseCourtFeePaise - platformCommissionPaise;

  return {
    baseCourtFeePaise,
    platformFeePaise,
    gstOnPlatformFeePaise,
    totalPayablePaise,
    platformCommissionPaise,
    venueNetPayoutPaise,
  };
}
```

### 1.2 Cancellation & Refund Matrix

Cancellations enforce venue-specific cancellation windows to protect venue owners against lost court hours:

| Time Prior to Slot Start | Player Refund Eligibility | Platform Fee Refund | Venue Cancellation Compensation |
| :--- | :--- | :--- | :--- |
| **> 24 hours** | 100% of Base Court Fee | Non-refundable | 0% |
| **12 - 24 hours** | 50% of Base Court Fee | Non-refundable | 50% credited to venue |
| **< 12 hours** | 0% (No refund) | Non-refundable | 100% credited to venue |
| **Cancelled by Venue** | 100% Full Refund | 100% Refunded | Penalty assessed to venue reliability |

---

## 2. Game Lifecycle Engine

Games represent recreational sessions organized by individual players, independent of whether a court booking exists.

### 2.1 State Transition Invariants

```typescript
// packages/api/src/services/game-engine.ts
import { prisma } from '@playlo/db';
import { TRPCError } from '@trpc/server';

export async function joinGameSession(params: {
  gameId: string;
  userId: string;
}) {
  const { gameId, userId } = params;

  return await prisma.$transaction(async (tx) => {
    // 1. Lock game row for update
    const game = await tx.game.findUnique({
      where: { id: gameId },
      include: { participants: true },
    });

    if (!game) throw new TRPCError({ code: 'NOT_FOUND', message: 'Game does not exist' });
    if (game.status !== 'OPEN') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Cannot join game with status ${game.status}` });
    }

    // 2. Check if user already joined
    const alreadyJoined = game.participants.some((p) => p.userId === userId && p.status === 'CONFIRMED');
    if (alreadyJoined) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You have already joined this game' });
    }

    // 3. Check capacity limits
    const currentConfirmed = game.participants.filter((p) => p.status === 'CONFIRMED').length;
    if (currentConfirmed >= game.maxParticipants) {
      throw new TRPCError({ code: 'CONFLICT', message: 'This game is full' });
    }

    // 4. Create participant record
    await tx.gameParticipant.create({
      data: {
        gameId,
        userId,
        status: 'CONFIRMED',
      },
    });

    const newCount = currentConfirmed + 1;
    const isNowFull = newCount >= game.maxParticipants;

    // 5. Update game confirmed counter and state
    const updatedGame = await tx.game.update({
      where: { id: gameId },
      data: {
        confirmedCount: newCount,
        status: isNowFull ? 'FULL' : 'OPEN',
      },
    });

    return updatedGame;
  });
}
```

---

## 3. Venue Availability Scheduling Engine

Venues publish operational court hours. The availability engine computes bookable slots in real-time by intersecting operating schedules with existing bookings and manual blocks.

```typescript
// packages/api/src/services/venue-scheduler.ts
import { prisma } from '@playlo/db';
import { redis } from '@playlo/api/lib/redis';

export interface TimeSlot {
  startTime: string; // ISO String
  endTime: string;   // ISO String
  pricePaise: number;
  isAvailable: boolean;
  heldByMe: boolean;
}

export async function getCourtDaySlots(params: {
  courtId: string;
  dateStr: string; // "YYYY-MM-DD"
  currentUserId?: string;
}): Promise<TimeSlot[]> {
  const { courtId, dateStr, currentUserId } = params;

  const court = await prisma.court.findUnique({
    where: { id: courtId },
  });
  if (!court) throw new Error('Court not found');

  // Define operational hours (e.g., 06:00 to 22:00 in Asia/Kolkata)
  const slots: TimeSlot[] = [];
  const startHour = 6;
  const endHour = 22;

  // Query existing bookings for this day
  const dayStart = new Date(`${dateStr}T00:00:00+05:30`);
  const dayEnd = new Date(`${dateStr}T23:59:59+05:30`);

  const confirmedBookings = await prisma.booking.findMany({
    where: {
      courtId,
      status: { in: ['CONFIRMED', 'PAYMENT_PENDING'] },
      startTime: { gte: dayStart, lte: dayEnd },
    },
  });

  for (let hour = startHour; hour < endHour; hour++) {
    const slotStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00+05:30`);
    const slotEnd = new Date(`${dateStr}T${String(hour + 1).padStart(2, '0')}:00:00+05:30`);
    const startUnix = Math.floor(slotStart.getTime() / 1000);
    const endUnix = Math.floor(slotEnd.getTime() / 1000);

    // Check DB conflicts
    const isBookedInDb = confirmedBookings.some(
      (b) => b.startTime.getTime() === slotStart.getTime()
    );

    // Check Redis holds
    const holdKey = `hold:court:${courtId}:slot:${startUnix}_${endUnix}`;
    const holderId = await redis.get(holdKey);

    const isAvailable = !isBookedInDb && (!holderId || holderId === currentUserId);

    slots.push({
      startTime: slotStart.toISOString(),
      endTime: slotEnd.toISOString(),
      pricePaise: court.baseHourlyRatePaise,
      isAvailable,
      heldByMe: holderId === currentUserId,
    });
  }

  return slots;
}
```

---

## 4. Player Reliability & Reputation Formula

To eliminate the chronic issue of recreational match dropouts and no-shows, Playlo calculates a deterministic **Player Reliability Score (PRS)** (0 - 100%).

### 4.1 The PRS Formula

$$PRS = 100 - (25 \times \text{UnexcusedNoShows}) - (10 \times \text{LateCancellations}) + (2 \times \text{FulfilledGames})$$

- **Starting Base:** 100%
- **Unexcused No-Show:** Deducts 25 points per incident.
- **Late Cancellation (< 4 hours before session):** Deducts 10 points.
- **Completed Match:** Restores 2 points (capped at 100%).
- **Score Tiering:**
  - `90% - 100%`: 🟢 **Verified Reliable Player** (Priority join status)
  - `75% - 89%`: 🟡 **Standard Player**
  - `< 75%`: 🔴 **High Dropout Risk** (Restricted from joining competitive or paid sessions)

---

## 5. WhatsApp Viral Growth Engine

Recreational sports coordination in India happens overwhelmingly on WhatsApp. Playlo leverages **Deep-Linked Intent Links** (`wa.me`) to transform game organizers into organic distribution channels.

```typescript
// packages/ui/src/lib/whatsapp.ts
export function generateWhatsAppGameInvite(params: {
  gameTitle: string;
  venueName: string;
  startTimeFormatted: string;
  gameId: string;
  spotsLeft: number;
}): string {
  const { gameTitle, venueName, startTimeFormatted, gameId, spotsLeft } = params;
  const gameUrl = `https://playlo.in/app/games/${gameId}?ref=wa_share`;

  const message = [
    `🏸 *Badminton Game Alert!* 🏸`,
    ``,
    `*Game:* ${gameTitle}`,
    `*Where:* ${venueName}, Sirsa`,
    `*When:* ${startTimeFormatted}`,
    `*Spots Left:* ${spotsLeft} spot${spotsLeft > 1 ? 's' : ''}`,
    ``,
    `Join my game here on Playlo:`,
    `${gameUrl}`,
    ``,
    `_Chalo Khelein!_`,
  ].join('\n');

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
```

