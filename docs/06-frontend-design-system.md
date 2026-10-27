# 06 · Frontend & Design System

| | |
|---|---|
| **Status** | v2.0 — colour contrast ratios computed with the WCAG 2.x relative-luminance formula; component code is reference |
| **Audience** | Frontend engineers, designers, QA, accessibility reviewers |
| **Related** | [01-product-requirements](./01-product-requirements.md) · [02-architecture](./02-architecture.md) · [04-api-specification](./04-api-specification.md) |

---

## 1. Surfaces and routing

One Next.js app (ADR-002) with route groups. Everything below the line is shared.

| Surface | Path | Users | Rendering | Primary requirement |
|---|---|---|---|---|
| Marketing site | `/`, `/how-it-works`, `/pricing`, `/players`, `/venues/partners`, `/help`, `/contact`, `/legal/*`, `/cities/*` | Visitors, search engines | RSC + ISR | Fast LCP, indexable, JSON-LD only where content qualifies |
| Public share page | `/g/[code]` | Anyone with a WhatsApp link | RSC, dynamic | Rich link preview, **`noindex`**, no login wall, no PII |
| Player app (PWA) | `/app/*` | Players, hosts | RSC shell + client islands | Mobile-first, one-hand use, installable |
| Venue portal | `/venue/*` | Owners, staff | Client-heavy (calendar) | Tablet/desktop, quick slot actions |
| Admin console | `/admin/*` | Ops, support, moderators | Client-heavy (tables) | Dense data tables, audit, document viewer |

**Reference device:** a mid-range Android phone on 4G in a tier-2 Indian city (≈ 360 px wide, 3–4 GB RAM). Desktop is a secondary target for the player app and the primary one for venue and admin.

## 2. Design principles

1. **Three taps to a game.** Landing → game card → join. Login is deferred until the moment of commitment and returns the user to the same place.
2. **WhatsApp-native.** Every game and every confirmation can be shared in one tap; shared links must work without an account.
3. **Trust is visible.** Verified venue badge, attendance facts, clear cancellation terms, itemised price — before the user commits.
4. **Honest states.** Never show planned features as live; never show a slot as available when it is not; never promise offline actions will "sync later" when they involve money or capacity.
5. **Accessible by default.** WCAG 2.2 AA is the floor, not a stretch goal.
6. **Light on the wire.** Server components by default; client JavaScript only for interaction.

## 3. Design tokens

### 3.1 Colour — with computed contrast

v1's primary button was white text on `#10b981` (2.54 : 1, **fails** WCAG AA's 4.5 : 1 for normal text and even 3 : 1 for large text) and the component code used Tailwind's `emerald-600` directly (3.77 : 1, still failing for body-size text) instead of the tokens. Several greys used for text (`slate-400`) are 2.56 : 1. The palette below keeps the brand green but assigns it roles that pass.

| Token | Value | Use | Pairing and contrast |
|---|---|---|---|
| `--color-brand-500` | `#10b981` | **Fills**: primary buttons, selected chips, progress | with `ink-900` text → **7.04 : 1** ✓ |
| `--color-brand-600` | `#059669` | Hover/pressed fill | with `ink-900` text → 4.74 : 1 ✓ |
| `--color-brand-700` | `#047857` | **Text and links** on light surfaces; icon strokes | on white → **5.48 : 1** ✓; on `brand-50` → 5.21 : 1 ✓ |
| `--color-brand-50` | `#ecfdf5` | Tinted backgrounds | – |
| `--color-ink-900` | `#0f172a` | Primary text, text on brand fills | on white → 17.85 : 1 ✓ |
| `--color-ink-700` | `#334155` | Secondary text | on white → 10.35 : 1 ✓ |
| `--color-ink-600` | `#475569` | Tertiary text, captions | on white → 7.58 : 1 ✓ |
| `--color-ink-500` | `#64748b` | Placeholder, disabled-adjacent text (minimum allowed text grey) | on white → 4.76 : 1 ✓ |
| `--color-ink-400` | `#94a3b8` | **Non-text only** (borders, dividers, decorative icons) | on white → 2.56 : 1 ✗ for text |
| `--color-accent-500` | `#f59e0b` | Accent fills (ratings, highlights) | with `ink-900` text → 8.31 : 1 ✓; **never white text** (2.15 : 1) |
| `--color-accent-700` | `#b45309` | Accent text on light | on white → 5.02 : 1 ✓ |
| `--color-danger-700` | `#b91c1c` | Error text, destructive actions | on white → 6.47 : 1 ✓; on `#fef2f2` → 5.91 : 1 ✓ (v1 `#ef4444` is 3.76 : 1 ✗) |
| `--color-info-700` | `#1d4ed8` | Informational text/links | on white → 6.70 : 1 ✓ |
| `--color-surface` / `--color-surface-dark` | `#ffffff` / `#0f172a` | Cards / dark shell | `white` on `#1e293b` → 14.63 : 1 ✓ |

Rules: text must meet **4.5 : 1** (3 : 1 for ≥ 24 px or ≥ 18.66 px bold); UI boundaries and focus indicators 3 : 1; **never convey state by colour alone** (v1's active bottom-nav item changed only colour — add `aria-current="page"` and a weight/indicator change).

Ratios are calculated, not eyeballed; re-verify with a tool (e.g. Axe or the Figma contrast plugin) when any token changes.

```css
/* packages/config/tailwind/theme.css  (Tailwind v4 @theme) */
@theme {
  --color-brand-50:  #ecfdf5;
  --color-brand-500: #10b981;
  --color-brand-600: #059669;
  --color-brand-700: #047857;

  --color-ink-900: #0f172a;
  --color-ink-700: #334155;
  --color-ink-600: #475569;
  --color-ink-500: #64748b;
  --color-ink-400: #94a3b8;          /* decorative only */

  --color-accent-500: #f59e0b;
  --color-accent-700: #b45309;
  --color-danger-700: #b91c1c;
  --color-info-700:   #1d4ed8;

  --color-surface: #ffffff;
  --color-surface-muted: #f8fafc;
  --color-border: #e2e8f0;

  --font-heading: "Plus Jakarta Sans", "Noto Sans Devanagari", system-ui, sans-serif;
  --font-body:    "Inter", "Noto Sans Devanagari", system-ui, sans-serif;

  --radius-sm: 0.375rem;  --radius-md: 0.5rem;  --radius-lg: 0.75rem;  --radius-xl: 1rem;  --radius-full: 9999px;
  --spacing-touch: 2.75rem;          /* 44 px minimum interactive target */
}
```

Components reference **semantic** utilities (`bg-brand-500 text-ink-900`) — never raw palette classes like `bg-emerald-600`, which bypass the contrast rules above.

### 3.2 Typography

- **Fonts:** Plus Jakarta Sans (headings) and Inter (body) via `next/font` (self-hosted, `display: swap`, Latin subset, ≤ 4 weights). **Add Noto Sans Devanagari** (subset `devanagari`): neither Inter nor Plus Jakarta Sans contains Devanagari glyphs, so v1's Hindi strings would have fallen back to an arbitrary system font with mismatched metrics.
- **Scale:** 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36. Body 16 px minimum for reading; 14 px for secondary; 12 px only for non-essential metadata.
- Line height 1.5 body, 1.25 headings. Hindi needs ~10 % more line height — set per-locale on `html[lang="hi"]`.
- Prices use tabular numerals (`font-variant-numeric: tabular-nums`) and the `en-IN` grouping (`₹1,25,000`).

### 3.3 Space, shape, motion

4 px base grid. Cards `radius-xl`, inputs/buttons `radius-lg`. Minimum interactive target **44 × 44 px**. Motion ≤ 200 ms, disabled under `prefers-reduced-motion`. Elevation: one shadow for cards, one for sheets/modals.

## 4. Navigation

- **Player app, mobile:** bottom bar `Home · Discover · Create · My Games · Profile`. Center "Create" is emphasised but remains a real link with a visible label (not `sr-only` as in v1 — sighted users with low literacy benefit from the label). Active item: `aria-current="page"`, bold label and a filled icon. Hide the bar on checkout and while typing.
- **Player app, desktop ≥ 768 px:** left sidebar with the same five destinations.
- **Venue portal:** sidebar — Dashboard, Calendar, Bookings, Courts, Venue profile, Pricing, (Phase 2: Customers, Promotions), (Phase 3: Analytics, Billing), Settings.
- **Admin:** sidebar — Dashboard, Venues (queue), Users, Bookings, Payments, Games, Reports & moderation, Config, Audit.
- **Marketing:** top navigation with logo, Find Games, For Venues, Pricing, Log in, Join now; a mobile drawer.

## 5. Component inventory

Built on shadcn/ui primitives (Radix) in `packages/ui`. "P1" = needed for launch.

| Group | Components | Phase |
|---|---|---|
| Foundations | Button, IconButton, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Tabs, Badge, Avatar, Card, Separator, Skeleton, Toast, Dialog, Sheet (bottom sheet on mobile), Popover, Tooltip, Calendar/DatePicker | P1 |
| Global | Header, Footer, LocationSelector, SportSelector, SearchBar, NotificationBell, UserMenu, LanguageSwitcher, OfflineBanner | P1 |
| Discovery | GameCard, VenueCard, FilterPanel (sheet on mobile), SortMenu, EmptyState, MapListToggle (optional) | P1 (PlayerCard, CommunityCard, TournamentCard later) |
| Booking | SlotPicker, CourtDayGrid, PriceBreakdown, BookingSummary, HoldCountdown, PaymentStatus, ConfirmationScreen, CancellationDialog (with refund preview), RefundStatus, TermsAcknowledgement | P1 |
| Trust | VerifiedBadge, AttendanceSummary, ReliabilityBadge (Phase 2) with "how this works" link, ReportDialog, BlockButton, ReviewForm (Phase 2) | P1 / P2 |
| Sharing | ShareSheet (WhatsApp first, copy link, native share), QR | P1 |
| Venue | CalendarGrid (day/week), SlotBlockDialog, CourtForm, PricingRuleEditor, BookingTable | P1 |
| Admin | DataTable (server pagination, filters), DocumentViewer (zoom, signed URL), ReasonDialog (mandatory reason), AuditFeed | P1 |

### 5.1 Behaviour specs for the critical components

**SlotPicker / CourtDayGrid.** Shows the selected IST day, courts as rows or tabs, slots as 44-px cells. States: available, selected, booked, blocked/closed (greyed, with `aria-label` "Booked"), held-by-someone (shown as unavailable with tooltip text "Held by another player for up to 5 min"), past. Selecting contiguous slots forms one interval (within `minDuration…maxDuration`); the footer shows interval, **total price**, and the primary button "Continue to pay". Availability is re-fetched on focus and every 30 s while visible; a failed `initiateHold` with `SLOT_UNAVAILABLE` refreshes the grid and explains.

**HoldCountdown.** After `initiateHold`, show "Slot held for 04:59" (synchronise with `holdExpiresAt` from the server, not the device clock). At 60 s remaining, announce politely (`aria-live="polite"`). On expiry, disable Pay and offer "Pick the slot again". If the payment sheet is open at expiry, do not close it — the server extends the hold while a payment is in flight (05 §2.4).

**PriceBreakdown.** Court price, convenience fee, GST on fee, discount (if any), **Total** — same numbers the server computed (`booking.quote`), never client-calculated. Shows the venue's cancellation terms inline: "Free cancellation until {time}" derived from `previewCancellation`.

**GameCard.** Sport chip (from data, not hard-coded), title, venue or custom location, distance (only if user shared approximate location), local time, seats `x/y` as text *and* a progress glyph, skill range, cost (`Free` or `₹…`, "paid at venue/host" note in Phase 1), a Join button whose label reflects state (Join, Request to join, Waitlist, Full, Joined). Card body is one link target; the button is separate.

```tsx
// packages/ui/src/components/game-card.tsx — reference implementation (server component)
import Link from 'next/link';
import { MapPin, Users, Clock } from 'lucide-react';
import { useTranslations, useFormatter } from 'next-intl';

export function GameCard({ game, joinSlot }: { game: GameListItem; joinSlot: React.ReactNode }) {
  const t = useTranslations('game');
  const f = useFormatter();
  const costLabel = game.costPerPlayerPaise === 0 ? t('free') : f.number(game.costPerPlayerPaise / 100, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">{game.sportName}</span>
        <span className="text-xs font-medium text-ink-600">{t(`skill.${game.skillRange}`)}</span>
      </header>

      <h3 className="mt-3 line-clamp-1 font-heading text-lg font-bold text-ink-900">
        <Link href={`/app/games/${game.id}`} className="after:absolute after:inset-0 focus-visible:outline-2">{game.title}</Link>
      </h3>

      <dl className="mt-3 space-y-2 text-sm text-ink-700">
        <div className="flex items-center gap-2"><MapPin aria-hidden className="size-4 text-ink-500" /><dt className="sr-only">{t('where')}</dt><dd className="truncate">{game.locationName}{game.distanceKm != null && <span className="ml-1 text-ink-600">· {t('km', { n: game.distanceKm })}</span>}</dd></div>
        <div className="flex items-center gap-2"><Clock aria-hidden className="size-4 text-ink-500" /><dt className="sr-only">{t('when')}</dt><dd><time dateTime={game.startTime.toISOString()}>{f.dateTime(game.startTime, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</time></dd></div>
        <div className="flex items-center gap-2"><Users aria-hidden className="size-4 text-ink-500" /><dt className="sr-only">{t('players')}</dt><dd>{t('joined', { count: game.confirmedCount, max: game.maxParticipants })}</dd></div>
      </dl>

      <footer className="relative z-10 mt-5 flex items-center justify-between border-t border-border pt-3">
        <p className="text-lg font-bold text-ink-900"><span className="block text-xs font-normal text-ink-600">{t('entry')}</span>{costLabel}</p>
        {joinSlot /* a small client component owning the join mutation — keeps the card a server component */}
      </footer>
    </article>
  );
}
```

Fixes against v1's card: it ignored the `sport` prop and hard-coded "🏸 Badminton"; it hard-coded English strings; it used `text-slate-400` (2.56 : 1) for the "Entry" label; it accepted an `onJoinClick` function prop, which a server component cannot pass to a client component; the whole card was not keyboard-navigable as one target.

## 6. Screen states

Every data-driven screen must design all **nine** states (the product plan lists nine; v1 implemented eight and dropped *unavailable resource*).

| State | Pattern |
|---|---|
| **Loading** | Skeletons that match final layout; no full-page spinners; `aria-busy` |
| **Empty** | Explain why and offer the next action. Game search: "No games near you this evening — create one or widen your radius." |
| **Error** | Human message + **Retry** (refetch) + request ID in small print; never raw error text |
| **Success** | Inline confirmation with next steps; booking success offers Share on WhatsApp and Add to calendar |
| **Permission denied** | Explain which role is required; offer sign-in or request access; do not reveal existence of private resources |
| **Offline / connection failure** | Banner "You're offline — showing saved results". **Mutations are disabled** (join, book, pay, cancel) with an explanation. v1 promised actions "will sync when back online" — unsafe for payments and capacity, and removed. Drafts of text input are preserved locally |
| **Session expired** | Non-destructive OTP dialog; preserve form state in memory/`sessionStorage`; resume the interrupted action |
| **Unavailable resource** | Game cancelled/full/started, slot taken, venue suspended: say what happened and offer alternatives (similar games, other slots) |
| **Restricted / suspended account** | Clear lockout card: reason category, what is restricted, how to appeal, support contact. Never expose other users' reports |

## 7. Progressive Web App

| Item | Specification |
|---|---|
| Manifest | `/manifest.webmanifest`, `id: "/app"`, `start_url: "/app?source=pwa"`, **`scope: "/app/"`**, `display: "standalone"`, `lang: "en-IN"`, theme `#10b981`, background `#0f172a`. Provide 192 and 512 icons, and a **separate** maskable icon (v1 combined `"any maskable"` in one entry, which browsers discourage because the artwork rarely suits both) |
| Orientation | Do not lock; v1's `portrait` lock harms tablets and accessibility settings |
| Service worker | Served from **`/app/sw.js`** via a route handler so its default scope is `/app/`; or serve from `/sw.js` with the `Service-Worker-Allowed: /app/` header. v1 placed `sw.js` in `public/`, i.e. at `/sw.js`, with a `/app` start URL, which gives the wrong scope relationship |
| Caching | Precache the app shell and icons. **Stale-while-revalidate** for read-only lists (games, venues). **Network-only** for anything touching availability, bookings, payments, auth and `/api/*` |
| Offline | Read cached lists and my upcoming games; show OfflineBanner; mutations disabled (§6) |
| Updates | Version the SW; prompt "Update available — reload" rather than silently swapping mid-checkout |
| Push | Web Push via FCM. Android Chrome supports it directly; **iOS requires the app be installed to the Home Screen** (iOS 16.4+) and a user gesture to grant permission. Ask for permission after a meaningful moment (first confirmed game), not on load. SMS remains the guaranteed fallback for critical messages |
| Install | Custom prompt after the user's second visit or first booking |

## 8. Internationalisation

- **Library:** `next-intl`. Catalogs in `packages/config/i18n/messages/{en,hi}.json`, namespaced by feature. English is the launch language; **Hindi catalogs are kept complete from day one** (v1's header said "Hindi-ready plumbing" while its text said "English and Hindi from Day 1" — decide: ship English, keep Hindi at parity, switch on when a native speaker has reviewed).
- **No concatenated sentences**; use ICU messages for plurals and variables. v1's Hindi `spotsLeft` omitted the plural form that its English counterpart had.
  ```json
  { "game": { "spotsLeft": "{count, plural, =1 {1 spot left} other {# spots left}}" } }
  { "game": { "spotsLeft": "{count, plural, =1 {1 जगह बाकी} other {# जगहें बाकी}}" } }
  ```
- **Routing:** keep `/app/*` URLs locale-free (locale from a cookie/profile setting) so deep links, SMS and WhatsApp links are stable; marketing pages may use `/hi/...` for SEO when Hindi launches.
- **Formats:** `en-IN`/`hi-IN` via `Intl`; times always in `Asia/Kolkata` with the zone implicit for Sirsa users; never hard-code `₹` or digit grouping.
- **SMS/push templates** are localised too; DLT templates are registered per language (07 §5).
- **Hindi QA:** test long strings (Hindi runs ~20–30 % longer), conjuncts rendering, and line-height; add a pseudo-locale in development.

## 9. Accessibility

Target **WCAG 2.2 AA**.

- Semantic landmarks, one `h1` per page, ordered headings; labelled form controls with visible labels; error text associated by `aria-describedby`.
- Focus: visible 2 px ring (3 : 1 contrast), logical order, focus returned after dialogs close, no keyboard traps in the Razorpay overlay (test it).
- Targets ≥ 44 px; spacing between adjacent targets.
- Dynamic content: toasts and countdown use `aria-live="polite"`; avoid auto-dismissing errors.
- Respect `prefers-reduced-motion` and 200 % text zoom without horizontal scroll at 320 px.
- Icons paired with text or `aria-label`; decorative icons `aria-hidden`.
- Automation: `eslint-plugin-jsx-a11y`; **axe checks inside the Playwright flows** for the booking path, login, game list, and create game; manual screen-reader pass (TalkBack on Android) before launch.

## 10. Performance budget

Budgets turn "100/100 Lighthouse" (v1) into enforceable, relevant numbers.

| Metric | Budget |
|---|---|
| Marketing pages | LCP < 2.5 s, CLS < 0.1, INP < 200 ms at p75 on mid-range Android/4G; Lighthouse performance ≥ 90 in CI (mobile profile) |
| Player app first-load JS (route) | ≤ 170 KB gzip; client components only where interaction requires |
| Images | `next/image` with R2/CDN origin, AVIF/WebP, explicit dimensions, `priority` only for the LCP image; venue photos ≤ 150 KB at display size |
| Fonts | ≤ 4 files, preloaded, `swap`, subsetted (Latin + Devanagari on demand) |
| Third-party scripts | Razorpay Checkout loaded **only** on the checkout route; PostHog loaded after interaction/idle |
| Data | Server components fetch via server-side tRPC callers; list endpoints paginate (≤ 20 cards) |

Track with Lighthouse CI on preview deployments and real-user vitals in PostHog/Vercel Analytics.

## 11. Public site and SEO

| Page | Indexable | Notes |
|---|---|---|
| `/`, `/how-it-works`, `/players`, `/venues/partners`, `/pricing`, `/help`, `/contact`, `/legal/*`, `/about` | ✓ | Unique titles/descriptions, canonical URLs, sitemap |
| `/cities/[slug]`, `/cities/[slug]/badminton`, `/sports/badminton` | ✓ **only when real supply exists** (≥ N verified venues) | Avoid thin pages |
| `/g/[code]` | ✗ `noindex`, but Open Graph/Twitter metadata present | Preview card for WhatsApp |
| `/app/*`, `/venue/*`, `/admin/*`, `/api/*` | ✗ | `X-Robots-Tag: noindex` from middleware **and** `robots.txt` disallow |
| Filtered/sorted list URLs | ✗ canonicalised to the base list | Prevent unbounded duplicate URLs |

Structured data only where truthful (`Organization`; `LocalBusiness`/`SportsActivityLocation` on verified venue pages once those are public). Social-proof numbers on the homepage must be **real and verifiable** — render them from the database or omit them.

## 12. Venue and admin UI notes

- **Venue calendar:** day view with courts as columns and 30/60-minute rows; week view for overview; click-drag to block; colour-plus-pattern for booked vs blocked (not colour alone). Include **"Add walk-in / phone booking"**: venues take bookings offline, and the way to keep availability truthful is to block the slot with reason "Offline booking" in two taps. (v1's "cashier mode" hints at this but nothing in the data model or API supported it; it is implemented as a `CourtBlock`.)
- **Pricing editor:** base rate plus time-band rules with a live preview of the week.
- **Admin tables:** server-side pagination/filter, saved filters, masked PII with an explicit "reveal" that writes an audit row, **ReasonDialog** (mandatory text) for every sensitive action, document viewer with zoom and rotate over signed URLs that expire in minutes.

## 13. Changes from v1

| v1 | v2 |
|---|---|
| Four Next.js apps | One app with route groups; packages unchanged |
| Primary button white on `#10b981` (2.54 : 1) | Dark ink on brand fill (7.04 : 1); `brand-700` for text |
| Components used raw `emerald-*`/`slate-*` classes | Semantic tokens only |
| `slate-400`/`#ef4444` text | Banned for text; replaced with passing tokens |
| No Devanagari font | Noto Sans Devanagari in the stacks |
| `manifest` orientation lock, combined maskable icon, SW at `/sw.js` | Scope `/app/`, separate maskable icon, SW under `/app/` |
| "Actions will sync when back online" | Mutations disabled offline |
| 8 screen states | 9 (adds *unavailable resource*) |
| Share link to a login-walled URL | Public `/g/{code}` with preview |
| GameCard with function props and hard-coded strings | Server component, i18n, data-driven chip, join as a client slot |
| "100/100 Lighthouse" | Measurable budgets |
