# Playlo — Frontend & Design System Specification

> **Stack:** Next.js 15 (App Router) + React 19 + Tailwind CSS v4  
> **Component System:** shadcn/ui primitives built on Radix UI  
> **Mobile Paradigm:** Progressive Web App (PWA) with Mobile-First Responsive Layouts  
> **Localization:** `next-intl` (English primary at launch, Hindi-ready plumbing)  
> **Iconography:** Lucide React

---

## 1. Application Surface Routing & Boundaries

| App Surface | Path Scope | Target User | Key Architectural Requirement |
| :--- | :--- | :--- | :--- |
| **`apps/web`** | `/`, `/how-it-works`, `/pricing`, `/cities/*` | Public Visitors & SEO Crawlers | SSR & ISR with JSON-LD Schema markup; 100/100 Lighthouse performance |
| **`apps/player`** | `/app`, `/app/games/*`, `/app/venues/*` | Recreational Players & Hosts | PWA Service Worker, bottom tab navigation, touch gestures, offline caching |
| **`apps/venue`** | `/venue/dashboard`, `/venue/calendar` | Venue Owners & Staff | Desktop/tablet-optimized calendar grid, quick time-slot toggles, cashier mode |
| **`apps/admin`** | `/admin/venues`, `/admin/users` | Operations & Trust Team | Data tables, audit feeds, KYC verification image zoom, batch actions |

---

## 2. Design System Tokens (Tailwind CSS v4)

Playlo's aesthetic is energetic, high-contrast, and sporty, balancing clean usability with athletic vibrancy.

```css
/* packages/config/tailwind/theme.css */
@theme {
  /* Brand Primary: Court Lime / Electric Green */
  --color-brand-primary: #10b981;
  --color-brand-primary-hover: #059669;
  --color-brand-primary-foreground: #ffffff;

  /* Brand Secondary: Deep Midnight / Sport Charcoal */
  --color-brand-dark: #0f172a;
  --color-brand-dark-surface: #1e293b;
  --color-brand-card: #ffffff;

  /* Sport Accent: Court Clay / Badminton Gold */
  --color-brand-accent: #f59e0b;
  --color-brand-accent-hover: #d97706;

  /* Semantic Feedback */
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Typography */
  --font-heading: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;

  /* Radii */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
}
```

---

## 3. PWA Configuration & Mobile-First Shell (`apps/player`)

The player app acts as an installable Progressive Web App with a native-feeling bottom navigation bar.

### 3.1 Web App Manifest (`apps/player/public/manifest.json`)

```json
{
  "name": "Playlo — Sports & Court Booking",
  "short_name": "Playlo",
  "description": "Find badminton games and book courts in Sirsa",
  "start_url": "/app",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#10b981",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 3.2 Mobile-First Bottom Navigation Shell

```tsx
// apps/player/src/components/layout/bottom-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, PlusCircle, Calendar, User } from 'lucide-react';
import { cn } from '@playlo/ui/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/app', icon: Home },
    { label: 'Discover', href: '/app/games', icon: Compass },
    { label: 'Create', href: '/app/games/create', icon: PlusCircle, isPrimary: true },
    { label: 'My Games', href: '/app/my-games', icon: Calendar },
    { label: 'Profile', href: '/app/profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-slate-200 bg-white/95 px-4 backdrop-blur-md md:hidden">
      <div className="mx-auto flex w-full max-w-md items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="-mt-5 flex flex-col items-center justify-center rounded-full bg-emerald-600 p-3.5 text-white shadow-lg transition-transform active:scale-95"
              >
                <Icon className="h-6 w-6" />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-1 text-xs font-medium transition-colors',
                isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

---

## 4. Reusable Core UI Components

### 4.1 Game Discovery Card (`GameCard.tsx`)

```tsx
// packages/ui/src/components/game-card.tsx
import { MapPin, Users, Clock, ShieldCheck } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';

interface GameCardProps {
  id: string;
  title: string;
  sport: string;
  venueName: string;
  distanceKm: number;
  startTime: string;
  confirmedPlayers: number;
  maxPlayers: number;
  costPerPlayerPaise: number;
  skillLevel: string;
  onJoinClick: (gameId: string) => void;
}

export function GameCard({
  id,
  title,
  venueName,
  distanceKm,
  startTime,
  confirmedPlayers,
  maxPlayers,
  costPerPlayerPaise,
  skillLevel,
  onJoinClick,
}: GameCardProps) {
  const isFull = confirmedPlayers >= maxPlayers;
  const costFormatted =
    costPerPlayerPaise === 0 ? 'Free' : `₹${Math.round(costPerPlayerPaise / 100)}`;

  return (
    <div className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-slate-200 hover:shadow-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          🏸 Badminton
        </Badge>
        <span className="text-xs font-medium text-slate-500">{skillLevel}</span>
      </div>

      <h3 className="mt-3 text-lg font-bold text-slate-900 line-clamp-1">{title}</h3>

      <div className="mt-3 space-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          <span className="truncate">{venueName}</span>
          <span className="text-xs text-slate-400">({distanceKm} km away)</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>{startTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span>
            {confirmedPlayers}/{maxPlayers} joined
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
        <div>
          <span className="text-xs text-slate-400">Entry</span>
          <p className="text-lg font-bold text-slate-900">{costFormatted}</p>
        </div>
        <Button
          onClick={() => onJoinClick(id)}
          disabled={isFull}
          className="rounded-xl bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700"
        >
          {isFull ? 'Game Full' : 'Join Game'}
        </Button>
      </div>
    </div>
  );
}
```

---

## 5. Screen States Architecture

Every page and component must handle eight required visual states gracefully:

| State | Implementation Pattern |
| :--- | :--- |
| **Loading** | Tailwind skeleton pulses (`animate-pulse`) mirroring final layout geometry (no generic spinners) |
| **Empty** | Helpful illustration + clear action button (e.g. "No games in Sirsa this evening — Create One!") |
| **Error** | Human-readable explanation + retry button invoking React Query `refetch()` |
| **Success** | Green accent confirmation modal + instant WhatsApp share trigger |
| **Permission Denied** | Role mismatch prompt with switch account / login CTA |
| **Offline** | PWA offline banner notifying user that action will sync when back online |
| **Session Expired** | Non-disruptive phone OTP dialog preserving user form input in local storage |
| **Restricted** | Informative lockout card explaining trust score restoration policies |

---

## 6. Internationalization Framework (`next-intl`)

Configured for English and Hindi from Day 1 to ensure zero friction when expanding across Haryana and Tier-2/3 Indian cities.

```json
// packages/config/i18n/locales/en.json
{
  "common": {
    "appName": "Playlo",
    "tagline": "Chalo Khelein",
    "findGame": "Find a Game",
    "bookCourt": "Book a Court",
    "join": "Join Game"
  },
  "game": {
    "spotsLeft": "{count, plural, =1 {1 spot left} other {# spots left}}",
    "freeEntry": "Free",
    "skillLevel": "Skill Level"
  }
}
```

```json
// packages/config/i18n/locales/hi.json
{
  "common": {
    "appName": "प्लेलो",
    "tagline": "चलो खेलें",
    "findGame": "मैच खोजें",
    "bookCourt": "कोर्ट बुक करें",
    "join": "मैच में शामिल हों"
  },
  "game": {
    "spotsLeft": "{count} जगह बाकी",
    "freeEntry": "मुफ़्त",
    "skillLevel": "खेल स्तर"
  }
}
```

