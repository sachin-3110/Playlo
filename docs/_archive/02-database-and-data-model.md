# Playlo — Database Schema & Data Model Specification

> **Engine:** PostgreSQL 16+ (Neon Serverless with PgBouncer)  
> **ORM:** Prisma 5+ with `@prisma/client`  
> **Geospatial:** PostGIS Spatial Extensions  
> **Financial Precision:** Strict integer representation in minor units (Indian Paise: 1 INR = 100 Paise)  
> **Concurrency Guarantee:** Advisory Locks + `SELECT ... FOR UPDATE` + Ephemeral Redis Slot Reservation

---

## 1. Complete Production Prisma Schema (`schema.prisma`)

```prisma
// packages/db/prisma/schema.prisma

datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DIRECT_DATABASE_URL")
  relationMode      = "foreignKeys"
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

// ---------------------------------------------------------
// ENUMS
// ---------------------------------------------------------

enum UserStatus {
  ACTIVE
  SUSPENDED
  DEACTIVATED
}

enum Role {
  PLAYER
  GAME_ORGANIZER
  COMMUNITY_ADMIN
  VENUE_STAFF
  VENUE_OWNER
  SUPPORT_AGENT
  MODERATOR
  ADMINISTRATOR
}

enum SkillLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
  COMPETITIVE
}

enum SportFormat {
  SINGLES
  DOUBLES
  ANY
}

enum GameStatus {
  DRAFT
  OPEN
  FULL
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum GameVisibility {
  PUBLIC
  PRIVATE_INVITE
  COMMUNITY_ONLY
}

enum ParticipantStatus {
  INVITED
  REQUESTED
  CONFIRMED
  DECLINED
  WAITLISTED
  REMOVED
}

enum AttendanceStatus {
  PENDING
  ATTENDED
  NO_SHOW
  EXCUSED
}

enum VenueStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  VERIFIED
  REJECTED
  SUSPENDED
}

enum BookingStatus {
  PENDING
  PAYMENT_PENDING
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  REFUND_PENDING
  REFUNDED
}

enum PaymentStatus {
  INITIATED
  PROCESSING
  SUCCEEDED
  FAILED
  REFUND_INITIATED
  REFUNDED
}

enum PaymentMethod {
  UPI
  CARD
  NETBANKING
  WALLET
}

enum CommunityVisibility {
  PUBLIC
  PRIVATE
}

enum CommunityRole {
  MEMBER
  MODERATOR
  ADMIN
}

enum TournamentFormat {
  SINGLE_ELIMINATION
  DOUBLE_ELIMINATION
  ROUND_ROBIN
  LEAGUE
}

enum TournamentStatus {
  DRAFT
  REGISTRATION_OPEN
  REGISTRATION_CLOSED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum AchievementCategory {
  PARTICIPATION
  RELIABILITY
  COMMUNITY
  COMPETITION
}

enum NotificationType {
  GAME_INVITATION
  GAME_JOINED
  GAME_CONFIRMED
  GAME_CANCELLED
  BOOKING_CONFIRMED
  BOOKING_CANCELLED
  PAYMENT_SUCCESS
  REFUND_PROCESSED
  MATCH_REMINDER
  COMMUNITY_ANNOUNCEMENT
}

// ---------------------------------------------------------
// AUTHENTICATION & USERS
// ---------------------------------------------------------

model User {
  id            String      @id @default(cuid())
  phone         String?     @unique
  email         String?     @unique
  name          String?
  avatarUrl     String?
  status        UserStatus  @default(ACTIVE)
  roles         Role[]      @default([PLAYER])
  preferredLang String      @default("en")
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  // Domain Relations
  playerProfile        PlayerProfile?
  hostedGames          Game[]                 @relation("HostGames")
  gameParticipations   GameParticipant[]
  attendances          Attendance[]
  ownedVenues          Venue[]                @relation("VenueOwner")
  managedVenues        VenueStaff[]
  bookings             Booking[]
  payments             Payment[]
  createdCommunities   Community[]            @relation("CommunityCreator")
  communityMemberships CommunityMember[]
  organizedTournaments Tournament[]           @relation("TournamentOrganizer")
  tournamentEntries    TournamentEntry[]
  reviewsAuthored      Review[]               @relation("AuthorReviews")
  reviewsReceived      Review[]               @relation("TargetReviews")
  achievements         UserAchievement[]
  notifications        Notification[]
  auditLogs            AuditLog[]             @relation("UserAuditLogs")

  @@index([phone])
  @@index([email])
  @@map("users")
}

model PlayerProfile {
  id                String       @id @default(cuid())
  userId            String       @unique
  user              User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  city              String       @default("Sirsa")
  neighborhood      String?
  latitude          Float?
  longitude         Float?
  preferredSportId  String?
  skillLevel        SkillLevel   @default(BEGINNER)
  preferredFormat   SportFormat  @default(DOUBLES)
  reliabilityScore  Int          @default(100) // Percentage scale 0-100
  totalGamesPlayed  Int          @default(0)
  totalGamesHosted  Int          @default(0)
  totalNoShows      Int          @default(0)
  bio               String?      @db.VarChar(300)
  xpPoints          Int          @default(0)
  currentLevel      Int          @default(1)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@index([city, skillLevel])
  @@map("player_profiles")
}

// ---------------------------------------------------------
// SPORTS METADATA
// ---------------------------------------------------------

model Sport {
  id              String      @id @default(cuid())
  slug            String      @unique // e.g. "badminton"
  name            String      // e.g. "Badminton"
  minPlayers      Int         @default(2)
  maxPlayers      Int         @default(4)
  isActive        Boolean     @default(true)
  courts          Court[]
  games           Game[]
  tournaments     Tournament[]

  @@map("sports")
}

// ---------------------------------------------------------
// VENUES, COURTS & AVAILABILITY
// ---------------------------------------------------------

model Venue {
  id              String       @id @default(cuid())
  name            String
  slug            String       @unique
  description     String?      @db.Text
  addressLine1    String
  addressLine2    String?
  city            String       @default("Sirsa")
  state           String       @default("Haryana")
  postalCode      String       @default("125055")
  latitude        Float
  longitude       Float
  phone           String
  email           String?
  images          String[]     @default([])
  amenities       String[]     @default([]) // e.g. ["Parking", "Changing Room", "Drinking Water", "Floodlights"]
  status          VenueStatus  @default(DRAFT)
  cancellationRule String?     @db.Text
  ownerId         String
  owner           User         @relation("VenueOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  // Relations
  courts          Court[]
  staff           VenueStaff[]
  games           Game[]
  reviews         Review[]
  subscriptions   Subscription[]

  @@index([city, status])
  @@index([latitude, longitude])
  @@map("venues")
}

model VenueStaff {
  id        String   @id @default(cuid())
  venueId   String
  venue     Venue    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      String   @default("STAFF") // "STAFF" or "MANAGER"
  createdAt DateTime @default(now())

  @@unique([venueId, userId])
  @@map("venue_staff")
}

model Court {
  id                 String             @id @default(cuid())
  venueId            String
  venue              Venue              @relation(fields: [venueId], references: [id], onDelete: Cascade)
  sportId            String
  sport              Sport              @relation(fields: [sportId], references: [id])
  name               String             // e.g. "Court 1 (Wooden Floor)"
  surfaceType        String?            // "Synthetic", "Wooden", "Cement"
  isIndoor           Boolean            @default(true)
  isActive           Boolean            @default(true)
  baseHourlyRatePaise Int               // Standard price in paise (e.g. 40000 = ₹400/hr)
  peakHourlyRatePaise Int?              // Peak pricing in paise
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  // Relations
  availabilitySlots  AvailabilitySlot[]
  bookings           Booking[]

  @@index([venueId, isActive])
  @@map("courts")
}

model AvailabilitySlot {
  id            String    @id @default(cuid())
  courtId       String
  court         Court     @relation(fields: [courtId], references: [id], onDelete: Cascade)
  startTime     DateTime  // UTC Timestamp
  endTime       DateTime  // UTC Timestamp
  pricePaise    Int       // Price in paise for this specific slot
  isBlocked     Boolean   @default(false) // Marked unavailable manually by venue
  blockedReason String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  booking       Booking?

  @@unique([courtId, startTime, endTime])
  @@index([courtId, startTime])
  @@map("availability_slots")
}

// ---------------------------------------------------------
// BOOKINGS & FINANCIAL TRANSACTIONS
// ---------------------------------------------------------

model Booking {
  id                  String             @id @default(cuid())
  bookingNumber       String             @unique // Human-readable e.g. "BK-2026-00123"
  userId              String
  user                User               @relation(fields: [userId], references: [id], onDelete: Restrict)
  courtId             String
  court               Court              @relation(fields: [courtId], references: [id], onDelete: Restrict)
  slotId              String?            @unique
  slot                AvailabilitySlot?  @relation(fields: [slotId], references: [id], onDelete: SetNull)
  startTime           DateTime           // Booking Start (UTC)
  endTime             DateTime           // Booking End (UTC)
  baseAmountPaise     Int                // Net court price
  platformFeePaise    Int                @default(0) // Platform fee
  taxesPaise          Int                @default(0) // GST / Tax component
  totalAmountPaise    Int                // Sum total paid by user
  status              BookingStatus      @default(PENDING)
  cancellationReason  String?
  cancelledAt         DateTime?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  // Decoupled Game Reference (Optional)
  game                Game?
  payments            Payment[]

  @@index([userId, status])
  @@index([courtId, startTime, endTime])
  @@map("bookings")
}

model Payment {
  id                  String         @id @default(cuid())
  paymentNumber       String         @unique // e.g. "PAY-2026-99123"
  bookingId           String
  booking             Booking        @relation(fields: [bookingId], references: [id], onDelete: Restrict)
  userId              String
  user                User           @relation(fields: [userId], references: [id], onDelete: Restrict)
  amountPaise         Int            // Total charged amount in paise
  platformSharePaise  Int            // Platform commission
  venueSharePaise     Int            // Venue payout share
  status              PaymentStatus  @default(INITIATED)
  paymentMethod       PaymentMethod?
  razorpayOrderId     String?        @unique
  razorpayPaymentId   String?        @unique
  razorpaySignature   String?
  idempotencyKey      String         @unique
  failureReason       String?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  // Relations
  refunds             Refund[]

  @@index([bookingId])
  @@index([razorpayOrderId])
  @@map("payments")
}

model Refund {
  id                  String         @id @default(cuid())
  paymentId           String
  payment             Payment        @relation(fields: [paymentId], references: [id], onDelete: Restrict)
  amountPaise         Int            // Refunded amount in paise
  reason              String?
  status              PaymentStatus  @default(INITIATED)
  razorpayRefundId    String?        @unique
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  @@map("refunds")
}

// ---------------------------------------------------------
// GAMES & PARTICIPATION (LIFECYCLE SEPARATE FROM BOOKING)
// ---------------------------------------------------------

model Game {
  id                  String             @id @default(cuid())
  title               String             @db.VarChar(120)
  sportId             String
  sport               Sport              @relation(fields: [sportId], references: [id])
  hostId              String
  host                User               @relation("HostGames", fields: [hostId], references: [id], onDelete: Restrict)
  venueId             String?            // Optional physical venue link
  venue               Venue?             @relation(fields: [venueId], references: [id], onDelete: SetNull)
  bookingId           String?            @unique // Optional confirmed court booking
  booking             Booking?           @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  communityId         String?            // Optional hosted by community
  community           Community?         @relation(fields: [communityId], references: [id], onDelete: SetNull)
  startTime           DateTime
  endTime             DateTime
  format              SportFormat        @default(DOUBLES)
  minSkillLevel       SkillLevel         @default(BEGINNER)
  maxSkillLevel       SkillLevel         @default(COMPETITIVE)
  maxParticipants     Int                @default(4)
  confirmedCount      Int                @default(1) // Host is counted
  costPerPlayerPaise  Int                @default(0) // Share fee in paise (0 = free)
  visibility          GameVisibility     @default(PUBLIC)
  status              GameStatus         @default(OPEN)
  customLocationName  String?            // If playing in public park / outside partner venue
  rulesDescription    String?            @db.Text
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  // Relations
  participants        GameParticipant[]
  attendances         Attendance[]

  @@index([sportId, status, startTime])
  @@index([hostId])
  @@index([status, startTime])
  @@map("games")
}

model GameParticipant {
  id          String             @id @default(cuid())
  gameId      String
  game        Game               @relation(fields: [gameId], references: [id], onDelete: Cascade)
  userId      String
  user        User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  status      ParticipantStatus  @default(CONFIRMED)
  hasPaid     Boolean            @default(false)
  joinedAt    DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@unique([gameId, userId])
  @@index([userId, status])
  @@map("game_participants")
}

model Attendance {
  id          String            @id @default(cuid())
  gameId      String
  game        Game              @relation(fields: [gameId], references: [id], onDelete: Cascade)
  userId      String
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  status      AttendanceStatus  @default(PENDING)
  markedById  String?           // Host or admin who marked attendance
  markedAt    DateTime?
  notes       String?

  @@unique([gameId, userId])
  @@map("attendances")
}

// ---------------------------------------------------------
// COMMUNITIES (PHASE 2)
// ---------------------------------------------------------

model Community {
  id          String               @id @default(cuid())
  name        String               @unique
  slug        String               @unique
  description String?              @db.Text
  city        String               @default("Sirsa")
  creatorId   String
  creator     User                 @relation("CommunityCreator", fields: [creatorId], references: [id], onDelete: Restrict)
  visibility  CommunityVisibility  @default(PUBLIC)
  avatarUrl   String?
  memberCount Int                  @default(1)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  // Relations
  members     CommunityMember[]
  games       Game[]

  @@index([city, visibility])
  @@map("communities")
}

model CommunityMember {
  id          String         @id @default(cuid())
  communityId String
  community   Community      @relation(fields: [communityId], references: [id], onDelete: Cascade)
  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  role        CommunityRole  @default(MEMBER)
  joinedAt    DateTime       @default(now())

  @@unique([communityId, userId])
  @@map("community_members")
}

// ---------------------------------------------------------
// TOURNAMENTS (PHASE 3)
// ---------------------------------------------------------

model Tournament {
  id              String            @id @default(cuid())
  title           String
  slug            String            @unique
  sportId         String
  sport           Sport             @relation(fields: [sportId], references: [id])
  organizerId     String
  organizer       User              @relation("TournamentOrganizer", fields: [organizerId], references: [id])
  format          TournamentFormat  @default(SINGLE_ELIMINATION)
  city            String            @default("Sirsa")
  startDate       DateTime
  endDate         DateTime
  entryFeePaise   Int               @default(0)
  maxTeams        Int               @default(16)
  status          TournamentStatus  @default(DRAFT)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  entries         TournamentEntry[]

  @@map("tournaments")
}

model TournamentEntry {
  id            String      @id @default(cuid())
  tournamentId  String
  tournament    Tournament  @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamName      String?
  seedNumber    Int?
  isPaid        Boolean     @default(false)
  createdAt     DateTime    @default(now())

  @@unique([tournamentId, userId])
  @@map("tournament_entries")
}

// ---------------------------------------------------------
// REVIEWS, ACHIEVEMENTS & NOTIFICATIONS
// ---------------------------------------------------------

model Review {
  id          String    @id @default(cuid())
  authorId    String
  author      User      @relation("AuthorReviews", fields: [authorId], references: [id], onDelete: Cascade)
  targetId    String?   // Target User ID (if reviewing a player/host)
  targetUser  User?     @relation("TargetReviews", fields: [targetId], references: [id], onDelete: Cascade)
  venueId     String?   // Target Venue ID (if reviewing a venue)
  venue       Venue?    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  rating      Int       // 1 - 5 stars
  comment     String?   @db.Text
  createdAt   DateTime  @default(now())

  @@index([targetId])
  @@index([venueId])
  @@map("reviews")
}

model Achievement {
  id          String               @id @default(cuid())
  code        String               @unique // e.g. "FIRST_GAME", "CONSISTENT_PLAYER"
  title       String
  description String
  category    AchievementCategory
  xpReward    Int                  @default(50)
  badgeIcon   String

  userAwards  UserAchievement[]

  @@map("achievements")
}

model UserAchievement {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievementId  String
  achievement    Achievement  @relation(fields: [achievementId], references: [id], onDelete: Cascade)
  awardedAt      DateTime     @default(now())

  @@unique([userId, achievementId])
  @@map("user_achievements")
}

model Notification {
  id          String            @id @default(cuid())
  userId      String
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        NotificationType
  title       String
  body        String
  linkUrl     String?
  isRead      Boolean           @default(false)
  createdAt   DateTime          @default(now())

  @@index([userId, isRead])
  @@map("notifications")
}

model Subscription {
  id          String    @id @default(cuid())
  venueId     String
  venue       Venue     @relation(fields: [venueId], references: [id], onDelete: Cascade)
  planName    String    // e.g. "STARTER", "GROWTH", "ENTERPRISE"
  amountPaise Int
  isActive    Boolean   @default(true)
  currentPeriodEnd DateTime
  createdAt   DateTime  @default(now())

  @@map("subscriptions")
}

model AuditLog {
  id          String    @id @default(cuid())
  actorId     String
  actor       User      @relation("UserAuditLogs", fields: [actorId], references: [id], onDelete: Restrict)
  action      String    // e.g. "VENUE_VERIFIED", "USER_SUSPENDED", "BOOKING_FORCE_CANCELLED"
  entityType  String    // e.g. "Venue", "User", "Booking"
  entityId    String
  metadata    Json?     // Diff or snapshot
  ipAddress   String?
  createdAt   DateTime  @default(now())

  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

---

## 2. State Machine Lifecycles

### 2.1 Court Booking Lifecycle

```
       [User Selects Slot]
                |
                v
            [PENDING] (5-Minute Redis Ephemeral Hold)
                |
          (Initiates Payment)
                v
        [PAYMENT_PENDING]
           /         \
  (Payment Succeeded) (Payment Failed / 5-min Timeout)
         /             \
        v               v
   [CONFIRMED]      [CANCELLED] -> (Slot Released)
        |
   (Start Time)
        v
  [IN_PROGRESS]
        |
   (End Time)
        v
   [COMPLETED]
```

*Cancellation & Refund Branch:*
From `[CONFIRMED]`:
- If User Cancels within policy window -> Status moves to `[REFUND_PENDING]` -> Gateway webhook executes refund -> Status moves to `[REFUNDED]`.

### 2.2 Game Lifecycle (Independent of Booking)

```
   [DRAFT] -> (Host Sets Sport, Time, Location)
      |
      v
    [OPEN] <----+ (Player Leaves)
      |         |
  (Max Spots)   |
      v         |
    [FULL] -----+
      |
  (Host Locks / Confirmed Min Players)
      v
  [CONFIRMED]
      |
  (Commencement)
      v
 [IN_PROGRESS]
      |
  (Session Closes)
      v
  [COMPLETED] -> (Triggers Post-Session Attendance & Feedback Ratings)
```

---

## 3. Double-Booking Prevention & Concurrency Control

To guarantee zero double-bookings in a distributed serverless runtime, Playlo implements a **three-tier defensive concurrency lock**:

```typescript
// packages/api/src/services/booking-engine.ts
import { prisma } from '@playlo/db';
import { redis } from '@playlo/api/lib/redis';
import { TRPCError } from '@trpc/server';

export async function reserveCourtSlot(params: {
  courtId: string;
  startTime: Date;
  endTime: Date;
  userId: string;
}) {
  const { courtId, startTime, endTime, userId } = params;
  const startUnix = Math.floor(startTime.getTime() / 1000);
  const endUnix = Math.floor(endTime.getTime() / 1000);
  const holdKey = `hold:court:${courtId}:slot:${startUnix}_${endUnix}`;

  // STEP 1: Fast Ephemeral Hold in Redis (atomic NX with 5-minute TTL)
  const acquired = await redis.set(holdKey, userId, { nx: true, ex: 300 });
  if (!acquired) {
    const existingHolder = await redis.get(holdKey);
    if (existingHolder !== userId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This court slot is currently held by another user completing checkout.',
      });
    }
  }

  // STEP 2: PostgreSQL Transaction with SELECT ... FOR UPDATE Row-Level Lock
  return await prisma.$transaction(async (tx) => {
    // Acquire Postgres Advisory Lock specific to this court ID
    const lockHash = hashCourtSlotToBigInt(courtId, startUnix);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockHash})`;

    // Check for existing confirmed or active bookings intersecting the time window
    const overlappingBooking = await tx.booking.findFirst({
      where: {
        courtId,
        status: { in: ['CONFIRMED', 'PAYMENT_PENDING'] },
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } },
        ],
      },
    });

    if (overlappingBooking) {
      // Release Redis hold if DB already has a reservation
      await redis.del(holdKey);
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This court slot has already been booked.',
      });
    }

    // Create the pending booking record
    const booking = await tx.booking.create({
      data: {
        bookingNumber: `BK-${Date.now().toString(36).toUpperCase()}`,
        userId,
        courtId,
        startTime,
        endTime,
        baseAmountPaise: 40000,
        platformFeePaise: 2000,
        taxesPaise: 7200,
        totalAmountPaise: 49200,
        status: 'PENDING',
      },
    });

    return booking;
  });
}

function hashCourtSlotToBigInt(courtId: string, startUnix: number): bigint {
  let hash = 0n;
  const str = `${courtId}:${startUnix}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5n) - hash + BigInt(str.charCodeAt(i));
    hash |= 0n;
  }
  return hash;
}
```

---

## 4. PostGIS Geospatial Queries for Discovery

PostGIS calculates exact spherical distances from player GPS coordinates to venues, returning the nearest games and courts in sub-millisecond query windows.

```typescript
// packages/api/src/routers/venue.ts
import { prisma } from '@playlo/db';

export async function findNearbyVenues(params: {
  userLat: number;
  userLng: number;
  radiusKm: number;
  sportSlug: string;
}) {
  const { userLat, userLng, radiusKm, sportSlug } = params;
  const radiusMeters = radiusKm * 1000;

  // PostGIS ST_DWithin query utilizing spatial geography index
  const nearbyVenues = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    addressLine1: string;
    distance_meters: number;
    base_rate_paise: number;
  }>>`
    SELECT 
      v.id,
      v.name,
      v.address_line1,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography
      ) AS distance_meters,
      MIN(c.base_hourly_rate_paise) AS base_rate_paise
    FROM venues v
    JOIN courts c ON c.venue_id = v.id
    JOIN sports s ON s.id = c.sport_id
    WHERE 
      v.status = 'VERIFIED'
      AND s.slug = ${sportSlug}
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
        ${radiusMeters}
      )
    GROUP BY v.id, v.name, v.address_line1, v.longitude, v.latitude
    ORDER BY distance_meters ASC
    LIMIT 25;
  `;

  return nearbyVenues;
}
```

---

## 5. Seed Data Manifest (`seed.ts`)

For testing the launch environment in Sirsa, the seed script sets up:
1. **Sports**: Badminton (`slug: "badminton"`).
2. **Launch Venues in Sirsa**:
   - *Sirsa Badminton Academy*, Barnala Road, Sirsa (3 Indoor Synthetic Courts, ₹350/hr).
   - *Shri Guru Gobind Singh Stadium Club*, Court Road, Sirsa (2 Indoor Wooden Courts, ₹400/hr).
3. **Users & Hosts**:
   - Admin account: `admin@playlo.in`.
   - 2 Verified Venue Owner accounts with complete court configurations.
   - 10 Seeded Player Profiles with varying skill levels (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`).
4. **Active Game Sessions**:
   - 4 upcoming open games (singles & doubles formats) ready for immediate testing.

