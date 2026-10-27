# Playlo — System Architecture & Infrastructure Specification

> **Platform:** Sports Networking & Court Booking Engine  
> **Launch Market:** Sirsa, Haryana, India (Single-sport: Badminton)  
> **Target Audience:** Recreational players, venue hosts, tournament organizers  
> **Architecture Style:** Full-Stack TypeScript Monorepo (Turborepo) + Serverless Edge/Node  
> **Developer Archetype:** Solo Developer (High-leverage, zero-ops infrastructure)

---

## 1. High-Level Architecture Overview

Playlo is architected as an event-driven, modular monolith deployed across edge and serverless environments. Rather than fragmented microservices, all domains share a unified TypeScript type system, single database instance with connection pooling, and shared validation logic, while isolating client entry points into dedicated applications.

### 1.1 C4 Context Level (System Boundaries)

```
+-----------------------------------------------------------------------------------+
|                                   EXTERNAL USERS                                  |
|   +-----------------------+   +-----------------------+   +-------------------+   |
|   | Recreational Players  |   | Venue Owners & Staff  |   | Platform Admins   |   |
|   +-----------+-----------+   +-----------+-----------+   +---------+---------+   |
+---------------|---------------------------|-------------------------|-------------+
                |                           |                         |
                v                           v                         v
+-----------------------------------------------------------------------------------+
|                                 EDGE INGRESS ROUTING                              |
|                              (Vercel Edge Network / CDN)                          |
|  - Geo-Routing & IP Detection        - SSL/TLS Termination & HTTP/3               |
|  - Edge Middleware (Auth, Security)  - Global Static Caching (ISR / Assets)       |
+-------+-------------------+-----------------------+--------------------+----------+
        |                   |                       |                    |
        v                   v                       v                    v
+---------------+   +---------------+       +---------------+    +---------------+
|   apps/web    |   |  apps/player  |       |  apps/venue   |    |  apps/admin   |
|  (Public Web  |   |   (Player     |       |    (Venue     |    | (Ops & Trust  |
|    & SEO)     |   |   PWA App)    |       |   Portal)     |    |   Control)    |
+-------+-------+   +-------+-------+       +-------+-------+    +-------+-------+
        |                   |                       |                    |
        +-------------------+-----------+-----------+--------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                             UNIFIED tRPC / API LAYER                              |
|                         (Hosted inside Next.js Route Handlers)                    |
|  - Context Initialization (Session, Auth, Prisma Client, Redis Client)            |
|  - Procedure Middleware (RBAC, Rate Limiting, Audit Logging)                      |
|  - Core Domain Routers: Auth, Game, Venue, Booking, Payment, Community, Admin    |
+-------------------+-----------------------+-------------------+-------------------+
                    |                       |                   |
                    v                       v                   v
+---------------------------+   +-----------------------+   +-----------------------+
|    PERSISTENCE LAYER      |   |     CACHING & HOLDS   |   | ASYNC EVENT EXECUTION |
|  Neon Serverless Postgres |   |     Upstash Redis     |   |    Upstash QStash     |
|   - Prisma ORM Client     |   |  - 5-min Booking Holds|   |  - Webhook Delivery   |
|   - PostGIS Geospatial    |   |  - Rate Limit Buckets |   |  - Match Reminders    |
|   - Advisory Locks        |   |  - Ephemeral Sessions |   |  - Auto Slot Release  |
+---------------------------+   +-----------------------+   +-----------------------+
                    ^                       ^                   ^
                    |                       |                   |
+-----------------------------------------------------------------------------------+
|                               THIRD-PARTY INTEGRATIONS                            |
|  - Razorpay (Route Split Payments, UPI Intents, Webhook Signature Verification)  |
|  - MSG91 (Transactional SMS & Phone OTP Service for India)                        |
|  - Firebase Cloud Messaging (Web Push & Notification Delivery)                   |
|  - Cloudflare R2 + Cloudflare Images (Zero-egress Object Storage & Resizing)      |
|  - PostHog (Product Analytics & Feature Flags)                                    |
|  - Sentry + Axiom (Error Reporting & Ingestion of Structured JSON Logs)           |
+-----------------------------------------------------------------------------------+
```

---

## 2. Monorepo Structure (Turborepo)

The repository uses **Turborepo** with **pnpm** workspaces. This structure guarantees strict boundaries between user surfaces while sharing database definitions, API contracts, design tokens, and authentication logic.

```
playlo/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Test, lint, typecheck on PR
│       └── deploy.yml                # Production deploy verification
├── apps/
│   ├── web/                          # Public landing pages, SEO, marketing (/how-it-works, /pricing)
│   │   ├── app/                      # Next.js App Router
│   │   ├── public/                   # Static landing assets
│   │   ├── package.json
│   │   └── next.config.ts
│   ├── player/                       # PWA Player Application (/app, /games, /venues, /profile)
│   │   ├── app/                      # Player-focused layouts & route groups
│   │   ├── public/manifest.json      # PWA Web App Manifest
│   │   ├── public/sw.js              # Service Worker (Push + Offline Shell)
│   │   ├── package.json
│   │   └── next.config.ts
│   ├── venue/                        # Venue Partner Portal (/venue/dashboard, /courts, /calendar)
│   │   ├── app/                      # Merchant operations UI
│   │   ├── package.json
│   │   └── next.config.ts
│   └── admin/                        # Internal Control Center (/admin/users, /verification, /audit)
│       ├── app/                      # Platform governance UI
│       ├── package.json
│       └── next.config.ts
├── packages/
│   ├── api/                          # Root tRPC definition, procedures, routers, and context
│   │   ├── src/
│   │   │   ├── routers/              # game, venue, booking, payment, admin, etc.
│   │   │   ├── trpc.ts               # initTRPC, procedure definitions, error formatters
│   │   │   ├── context.ts            # createContext(req, res) with auth & DB
│   │   │   └── root.ts               # AppRouter type export
│   │   └── package.json
│   ├── db/                           # Database access layer
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Single source of truth for database schema
│   │   │   ├── migrations/           # Versioned SQL migrations
│   │   │   └── seed.ts               # Development seed scripts
│   │   ├── src/
│   │   │   └── index.ts              # Exported singleton Prisma client with connection pooling
│   │   └── package.json
│   ├── auth/                         # Authentication configuration
│   │   ├── src/
│   │   │   ├── config.ts             # NextAuth (Auth.js v5) options (Phone OTP + Google)
│   │   │   ├── rbac.ts               # Role and permission matrices & checks
│   │   │   └── session.ts            # Session extraction & token verification helpers
│   │   └── package.json
│   ├── validators/                   # Zod schemas (Single Source of Truth)
│   │   ├── src/
│   │   │   ├── game.ts               # CreateGame, JoinGame, FilterGame schemas
│   │   │   ├── booking.ts            # ReserveSlot, CheckoutBooking schemas
│   │   │   ├── venue.ts              # VenueProfile, CourtPricing schemas
│   │   │   └── payment.ts            # Razorpay verification schemas
│   │   └── package.json
│   ├── ui/                           # Shared UI Component Library (shadcn/ui + Radix + Tailwind)
│   │   ├── src/
│   │   │   ├── components/           # Button, Dialog, Form, Badge, Calendar, Sheet, etc.
│   │   │   ├── hooks/                # useMediaQuery, useDebounce, useGeolocation
│   │   │   └── lib/utils.ts          # cn() helper (clsx + tailwind-merge)
│   │   └── package.json
│   ├── config/                       # Shared tooling configuration
│   │   ├── tailwind/                 # Tailwind v4 theme definitions and design tokens
│   │   ├── eslint/                   # Shared ESLint rules
│   │   └── typescript/               # Shared tsconfig.base.json
│   └── logger/                       # Structured JSON logging utility
│       ├── src/index.ts              # Axiom / Pino wrapper with context tracking
│       └── package.json
├── turbo.json                        # Pipeline configuration (build, test, lint, dev)
├── package.json                      # Workspace scripts & devDependencies
├── pnpm-workspace.yaml               # Workspace definitions
└── pnpm-lock.yaml
```

---

## 3. Infrastructure Topology

```
+-------------------------------------------------------------------------------------+
|                                 VERCEL PLATFORM                                     |
|                                                                                     |
|   Edge Middleware:                                                                  |
|   - Domain routing (maps playlo.in -> apps/web, playlo.in/app -> apps/player)       |
|   - Session cookie inspection                                                       |
|   - Security headers (CSP, HSTS, X-Frame-Options)                                   |
|                                                                                     |
|   Serverless Functions (Node.js runtime / aws-lambda behind Vercel):                |
|   - Next.js Server Components & Server Actions                                      |
|   - tRPC batch endpoint (/api/trpc)                                                 |
|   - Webhook ingress endpoints (/api/webhooks/razorpay, /api/webhooks/qstash)        |
+-----------------------+-------------------------+-------------------+---------------+
                        |                         |                   |
                        v                         v                   v
+-------------------------------+   +-----------------------------+   +---------------+
|     NEON SERVERLESS POSTGRES  |   |        UPSTASH REDIS        |   | CLOUDFLARE R2 |
|                               |   |                             |   |               |
| - Primary Compute (Autoscale) |   | - Global serverless Redis   |   | - S3-API      |
| - PgBouncer Connection Pooler |   | - TTL Key: `hold:slot:{id}` |   | - Buckets:    |
| - Branching:                  |   | - Upstash Ratelimit         |   |   - avatars   |
|   * `main` -> Production      |   | - Pub/Sub for SSE pushes    |   |   - venues    |
|   * `staging` -> Preview PRs  |   |                             |   |   - kyc_docs  |
| - PostGIS Spatial Extension   |   |                             |   | - Cloudflare  |
|                               |   |                             |   |   Images CDN  |
+-------------------------------+   +-----------------------------+   +---------------+
```

### 3.1 Persistence & Connection Management (Neon)
Serverless execution environments instantiate and terminate ephemeral function containers. Direct PostgreSQL connections quickly saturate max connection limits (`too many connections`).
- **Connection Pooling**: All application instances communicate via Neon's built-in **PgBouncer endpoint** using connection pooling mode on port `6543`.
- **Database Branching**: Automated schema migrations run on isolated Neon database branches generated automatically per GitHub pull request preview environment.
- **Data Locality**: Neon database region is configured in `ap-south-1` (Mumbai, India) to maintain sub-15ms round-trip latency to Vercel's Mumbai edge servers.

### 3.2 Transient Storage & Concurrency Locking (Upstash Redis)
- **Short-Lived Slot Holds**: When a player proceeds to the checkout step, an atomic hold key is written to Upstash Redis:
  ```text
  Key: hold:court:{courtId}:slot:{startTimeUnix}
  Value: { userId: "usr_123", expiresAt: 1730000000 }
  TTL: 300 seconds (5 minutes)
  ```
- **Distributed Rate Limiting**: Upstash Ratelimit token-bucket algorithm is enforced at the edge middleware and tRPC procedure level (preventing SMS OTP spam, checkout brute-forcing, and scraping).

### 3.3 Asynchronous Job Queue (Upstash QStash)
Background tasks execute reliably without dedicated worker VMs:
- **Game Match Reminders**: Scheduled message published to QStash targeting a webhook endpoint 2 hours prior to game commencement.
- **Slot Hold Expiry Cleanup**: If checkout is abandoned, QStash fires a reconciliation check at `T + 5m` to release the court slot if no payment webhook arrived.
- **SMS & Push Retries**: Exponential backoff delivery for SMS OTPs and push notifications via webhook triggers.

---

## 4. Networking, Edge Ingress & Security

### 4.1 Route Disambiguation & Subpath Mapping
Playlo operates across clean functional subpaths from a unified root domain:
- `playlo.in/` -> Serves `apps/web` (Static/ISR marketing & SEO pages)
- `playlo.in/app/*` -> Serves `apps/player` (Authenticated player application)
- `playlo.in/venue/*` -> Serves `apps/venue` (Venue manager portal)
- `playlo.in/admin/*` -> Serves `apps/admin` (Platform administration)

Edge Middleware inspects path prefixes and applies role-based session assertions before routing requests to serverless function handlers.

### 4.2 Security Architecture & OWASP Mitigations

| Vulnerability | Mitigation Strategy |
| :--- | :--- |
| **SQL Injection** | Parameterized queries enforced natively through Prisma Client ORM; raw SQL strictly forbidden except for PostGIS geospatial queries where `$queryRaw` parameters are strictly typed and sanitized. |
| **Cross-Site Scripting (XSS)** | React JSX auto-escaping; strict Content Security Policy (CSP) header enforced via Next.js Middleware; zero `dangerouslySetInnerHTML` usage. |
| **Cross-Site Request Forgery (CSRF)** | NextAuth v5 HttpOnly, SameSite=Lax session cookies; custom header verification (`x-trpc-source`) required on mutation requests. |
| **Broken Access Control (IDOR)** | Server-side procedure guards in `packages/api` verifying that `ctx.session.user.id` owns the target resource or holds an explicit permission key. |
| **Double Booking Race Conditions** | Dual-layer locking: Upstash Redis distributed lock during checkout + PostgreSQL `SELECT ... FOR UPDATE` row-level lock within a transaction at payment confirmation. |
| **Payment Tampering** | Razorpay HMAC-SHA256 signature verification computed over `order_id|payment_id` using secret stored in environment variables; client amounts never trusted. |

### 4.3 Content Security Policy (CSP) Header Configuration

```typescript
// packages/auth/src/csp.ts
export const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://eu.posthog.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://cdn.playlo.in https://*.r2.cloudflarestorage.com;
  font-src 'self';
  connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://eu.posthog.com https://*.upstash.io https://*.neon.tech https://*.ingest.sentry.io;
  frame-src https://api.razorpay.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  block-all-mixed-content;
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();
```

---

## 5. Environment & Secrets Configuration

All configuration is managed through Zod-validated environment schemas to prevent runtime configuration failures.

```typescript
// packages/config/src/env.ts
import { z } from 'zod';

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(), // Direct port 5432 for migrations
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  QSTASH_URL: z.string().url(),
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  MSG91_AUTH_KEY: z.string().min(1),
  MSG91_TEMPLATE_ID: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  SENTRY_DSN: z.string().url().optional(),
  AXIOM_TOKEN: z.string().optional(),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  NEXT_PUBLIC_DEFAULT_CITY: z.literal('sirsa'),
  NEXT_PUBLIC_DEFAULT_SPORT: z.literal('badminton'),
});
```

---

## 6. Scaling Strategy & Bottlenecks

### 6.1 Scaling Metrics & Growth Milestones

```
+------------------+-----------------------+-----------------------+------------------------+
| Metric           | 100 - 1,000 MAU       | 10,000 MAU            | 100,000 MAU            |
|                  | (Sirsa Validation)    | (Haryana Expansion)   | (Multi-State Scale)    |
+------------------+-----------------------+-----------------------+------------------------+
| Vercel Ingress   | Free / Pro ($20/mo)   | Pro ($20 + usage)     | Enterprise / Dedicated |
| Neon Database    | Free / Launch ($19/mo)| Scale ($69/mo)        | Custom Read Replicas   |
| Search Engine    | Postgres Full-Text    | Postgres Full-Text    | Dedicated Meilisearch  |
| Redis Key Volume | < 10,000 keys/day     | ~150,000 keys/day     | Managed Redis Cluster  |
| File Bandwidth   | Cloudflare R2 Free    | Cloudflare R2 Paid    | Cloudflare Enterprise  |
| Push & SMS       | Low volume (~500/mo)  | ~15,000 SMS/mo        | Tiered Aggregator Rates|
+------------------+-----------------------+-----------------------+------------------------+
```

### 6.2 Key Architectural Bottlenecks & Evolution Triggers

1. **Court Availability Queries**:
   - *Current (MVP)*: Relational query filtering `AvailabilitySlot` against existing `Booking` records using SQL joins and PostGIS distances.
   - *Trigger (> 2,000 active courts)*: Pre-generate materialized daily court schedule bitmaps stored in Upstash Redis.
2. **Search & Geo-Distance**:
   - *Current (MVP)*: PostGIS `ST_DWithin` spatial indexing on venue coordinates.
   - *Trigger (> 50,000 active game listings)*: Offload discovery queries to Meilisearch or Algolia with pre-filtered geo-radius facets.
3. **Transactional Slot Contention**:
   - *Current (MVP)*: 5-minute Redis hold + Postgres transaction with `SELECT FOR UPDATE`.
   - *Capacity*: Easily supports 500 concurrent checkout attempts/minute per court with zero phantom bookings.

---

## 7. Disaster Recovery & High Availability

| Failure Mode | Automated Recovery Mechanism | RPO / RTO Target |
| :--- | :--- | :--- |
| **Corrupted Production Migration** | Neon Instant Point-In-Time Recovery (PITR) to a branch timestamp 60 seconds prior to migration execution. | RPO: < 60s<br>RTO: < 5 mins |
| **Vercel Serverless Outage** | Automated Vercel Rollback to previous deployment hash via CLI or GitHub integration. | RPO: 0s<br>RTO: < 1 min |
| **Razorpay Webhook Dropped** | QStash scheduled reconciliation job querying Razorpay Orders API at `T+10m` for all bookings still in `PAYMENT_PENDING` status. | RPO: 0s<br>RTO: Automatic |
| **Redis Cache Eviction** | Redis acts strictly as a cache and ephemeral lock; all source of truth remains in PostgreSQL. Dropped hold keys fail gracefully to database validation. | RPO: 0s<br>RTO: Instantaneous |

---

## 8. Monthly Cost Model Estimates

| Service Tier | 100 MAU (Local Launch) | 1,000 MAU (Traction) | 10,000 MAU (Scale) |
| :--- | :--- | :--- | :--- |
| **Vercel** (Compute & Edge) | $20.00 (Pro) | $20.00 (Pro) | $60.00 (Pro + Extra Bandwidth) |
| **Neon PostgreSQL** | $0.00 (Free Tier) | $19.00 (Launch Tier) | $69.00 (Scale Tier) |
| **Upstash Redis + QStash** | $0.00 (Free Tier) | $5.00 (Pay-per-request)| $25.00 |
| **Cloudflare R2 + Images** | $0.00 (Free 10GB) | $2.00 | $15.00 |
| **MSG91 (SMS / OTP)** | ₹150 (~$2.00) | ₹1,500 (~$18.00) | ₹15,000 (~$180.00) |
| **Razorpay Fees** | 2% per txn (absorbed) | 2% per txn (absorbed)| 2% per txn (absorbed) |
| **PostHog + Sentry** | $0.00 (Free Tier) | $0.00 (Free Tier) | $35.00 |
| **Total Estimated Run-Rate** | **~$22.00 / month** | **~$64.00 / month** | **~$384.00 / month** |

*Conclusion:* The architecture is engineered so a solo developer can run Playlo in production for under $30/month during launch in Sirsa, with operational costs scaling strictly with transaction volume.

