# Playlo — Operations, CI/CD, Testing & Solo-Dev Roadmap

> **Target Execution:** Solo Full-Stack Developer  
> **Velocity Strategy:** Trunk-Based Development + GitHub Actions CI + Vercel Preview Environments  
> **Release Control:** PostHog Feature Flags (Decouple Deployment from Release)  
> **Testing Budget:** Vitest (Integration & Engines) + Playwright (Checkout & Auth E2E)

---

## 1. Feature Flag Architecture (PostHog)

Rather than maintaining long-lived feature branches, all code is merged into `main` and protected behind PostHog feature flags. This allows the solo developer to deploy Phase 2 and Phase 3 capabilities safely into production without exposing them until Sirsa Phase 1 adoption metrics are satisfied.

```typescript
// packages/config/src/flags.ts
export const FEATURE_FLAGS = {
  // Phase 1 (MVP)
  PHONE_OTP_LOGIN: 'flag-phone-otp-login',
  BADMINTON_BOOKING: 'flag-badminton-booking',
  RAZORPAY_CHECKOUT: 'flag-razorpay-checkout',
  WHATSAPP_INVITE_SHARE: 'flag-whatsapp-invite-share',

  // Phase 2 (Retention & Differentiation)
  PLAYER_MATCHMAKING_ALGO: 'flag-player-matchmaking-algo',
  COMMUNITIES_CLUBS: 'flag-communities-clubs',
  RELIABILITY_SCORING: 'flag-reliability-scoring',
  ACHIEVEMENTS_XP: 'flag-achievements-xp',
  VENUE_DISCOUNT_PROMOS: 'flag-venue-discount-promos',

  // Phase 3 (Monetization & Scale)
  VENUE_SUBSCRIPTIONS: 'flag-venue-subscriptions',
  TOURNAMENTS_LEAGUES: 'flag-tournaments-leagues',
  MULTI_SPORT_EXPANSION: 'flag-multi-sport-expansion', // Futsal, Tennis
  MULTI_CITY_EXPANSION: 'flag-multi-city-expansion',   // Hisar, Rohtak
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];
```

```tsx
// packages/ui/src/components/feature-guard.tsx
'use client';

import { useFeatureFlagEnabled } from 'posthog-js/react';
import type { FeatureFlagKey } from '@playlo/config/flags';

interface FeatureGuardProps {
  flag: FeatureFlagKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGuard({ flag, children, fallback = null }: FeatureGuardProps) {
  const isEnabled = useFeatureFlagEnabled(flag);
  if (!isEnabled) return <>{fallback}</>;
  return <>{children}</>;
}
```

---

## 2. CI/CD Pipeline (GitHub Actions)

Every pull request runs automated typechecks, linter checks, and unit/integration tests before receiving an ephemeral Vercel preview deployment URL.

```yaml
# .github/workflows/ci.yml
name: Playlo CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    name: Lint, Typecheck & Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install Workspace Dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: pnpm --filter @playlo/db prisma:generate

      - name: Turborepo Typecheck & Lint
        run: pnpm turbo run lint typecheck

      - name: Run Vitest Unit & Integration Suites
        run: pnpm turbo run test:unit
        env:
          DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/playlo_test'
          AUTH_SECRET: 'test-secret-at-least-32-characters-long'
          RAZORPAY_KEY_ID: 'rzp_test_placeholder'
          RAZORPAY_KEY_SECRET: 'placeholder_secret'

  e2e:
    name: Playwright Critical Path E2E
    needs: validate
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright Browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E Tests (Auth & Booking Checkout)
        run: pnpm test:e2e
```

---

## 3. Automated Testing Strategy

As a solo developer, writing tests for trivial UI layouts is counter-productive. Test investments are strictly concentrated where bugs lead to revenue loss or double-bookings:

### 3.1 Concurrency & Advisory Lock Test (`Vitest`)

```typescript
// packages/api/src/services/__tests__/booking-concurrency.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { reserveCourtSlot } from '../booking-engine';
import { prisma } from '@playlo/db';

describe('Booking Engine Concurrency Guarantee', () => {
  it('prevents two players from simultaneously reserving the exact same slot', async () => {
    const courtId = 'test_court_sirsa_1';
    const startTime = new Date('2026-11-01T18:00:00Z');
    const endTime = new Date('2026-11-01T19:00:00Z');

    // Simulate 2 parallel reservation requests arriving at the exact same millisecond
    const playerA = reserveCourtSlot({ courtId, startTime, endTime, userId: 'user_A' });
    const playerB = reserveCourtSlot({ courtId, startTime, endTime, userId: 'user_B' });

    const results = await Promise.allSettled([playerA, playerB]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one reservation must succeed, and one must be rejected with CONFLICT
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });
});
```

### 3.2 Critical Path E2E Test (`Playwright`)

```typescript
// apps/player/e2e/booking-checkout.spec.ts
import { test, expect } from '@playwright/test';

test('Player can discover court, reserve slot, and reach checkout', async ({ page }) => {
  await page.goto('/app/venues');
  await page.click('text=Sirsa Badminton Academy');

  // Verify court slot listing is visible
  await expect(page.locator('text=Court 1 (Wooden Floor)')).toBeVisible();

  // Select 6:00 PM slot
  await page.click('button:has-text("06:00 PM")');
  await page.click('button:has-text("Proceed to Checkout")');

  // Verify fee summary
  await expect(page.locator('text=Base Court Fee')).toContainText('₹400');
  await expect(page.locator('text=Platform Fee')).toContainText('₹20');
  await expect(page.locator('text=Total Amount')).toContainText('₹423.60');

  // Verify Razorpay modal trigger is primed
  await expect(page.locator('button:has-text("Pay with UPI / Card")')).toBeEnabled();
});
```

---

## 4. Solo Developer Execution Roadmap (Phased Sprints)

```
Sprints:      [ Sprint 0 ] ===> [ Sprint 1 ] ===> [ Sprint 2 ] ===> [ Launch ]
Timeline:       Weeks 1-2         Weeks 3-4         Weeks 5-6         Week 7
Scope:          Foundations       Core MVP          Polish & Gate     Sirsa Live
```

### 4.1 Sprint 0: Foundations & Monorepo Setup (Weeks 1 - 2)
- [ ] Initialize Turborepo with pnpm workspaces.
- [ ] Setup `packages/db` with Prisma schema, Neon serverless Postgres connection, and seeds for Sirsa.
- [ ] Implement NextAuth.js v5 with MSG91 Phone OTP authentication.
- [ ] Scaffold `packages/ui` with shadcn/ui components, Tailwind CSS v4 design tokens.
- [ ] Setup PostHog and Sentry error monitoring.

### 4.2 Sprint 1: Core Engine & Player MVP (Weeks 3 - 4)
- [ ] Implement PostGIS geospatial venue search procedure (`venue.searchNearby`).
- [ ] Build court availability scheduler with Upstash Redis 5-minute ephemeral hold.
- [ ] Build Razorpay Route checkout integration with HMAC webhook signature verification.
- [ ] Create `apps/player` mobile-first PWA bottom-nav shell.
- [ ] Implement game creation, listing, and join procedures.
- [ ] Implement WhatsApp deep-link invite generation.

### 4.3 Sprint 2: Venue Portal & Admin Governance (Weeks 5 - 6)
- [ ] Build `apps/venue` merchant dashboard (Calendar grid view, court block toggle).
- [ ] Build `apps/admin` venue verification queue (Approve/Reject with file preview).
- [ ] Setup Upstash QStash scheduled reminders (2 hours prior to game).
- [ ] Execute Vitest concurrency and Playwright checkout E2E tests.
- [ ] Finalize legal documents (Terms, Refund Policy, Privacy).

### 4.4 Sprint 3: Sirsa Market Launch (Week 7+)
- [ ] Onboard 2 partner badminton venues in Sirsa (e.g. Sirsa Badminton Academy).
- [ ] Seed 5 local regular badminton organizers.
- [ ] Monitor real-time logs in Axiom and transaction reconciliation in Razorpay dashboard.
- [ ] Track Phase 1 primary success metric: **% of game viewers in Sirsa who join a game**.

