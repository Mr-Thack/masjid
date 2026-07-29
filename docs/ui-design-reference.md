# Masjid Platform — UI/Design Reference for External Agents

## Project Overview

**Masjid** is a monorepo platform for mosque (masjid) digital presence. It powers four separate apps from a single codebase:

| App | Port | Audience | Tech |
|---|---|---|---|
| **API** | 5173 | Backend | SvelteKit + D1/SQLite + Drizzle ORM |
| **Consumer** | 5175 | Congregation (public) | SvelteKit static SPA, Tailwind v4, PWA |
| **TV** | 5174 | Prayer hall kiosk/TV | SvelteKit static, hand-written CSS (no Tailwind) |
| **Admin** | 5176 | Masjid administrators | SvelteKit static SPA, Tailwind v4 |
| **WhatsApp Worker** | — | Admins via WhatsApp | Cloudflare Worker |
| **@masjid/agent** | — | Shared bot logic | Pure TypeScript package |

**Production URLs:**
- API: `mapi.mr-thack.workers.dev`
- Consumer: `masjid-live.pages.dev`
- TV: `masjid-live-tv.pages.dev`
- Admin: `masjid-live-admin.pages.dev`

---

## Design Goals & Philosophy

### 1. Multi-tenant, fully themed
Every masjid gets its own look. The same SvelteKit app renders differently per masjid based on database-stored theme configuration. No static branding — everything flows from CSS custom properties set at runtime.

### 2. Two visual tracks

**Public-facing (Consumer + TV): Theme-driven per masjid**
- Dark mode is the default aesthetic (`glass-dark` preset)
- Glass morphism: translucent card surfaces, backdrop blur, subtle white borders
- Emerald green accent (`#10b981`) + dark navy blue primary (`#1e3a8a`)
- A `minimal-light` preset exists for congregations preferring light themes
- **Every** visual element reads from CSS custom properties — no hardcoded colors in components

**Admin dashboard: Functional dark theme**
- Slate-900/800 palette (`#0f172a` / `#1e293b`)
- NOT per-masjid themed (though it reads accent for active nav highlighting)
- Clean form controls, custom toggle switches, color-coded domain badges
- Inter font throughout

### 3. Zero build dependency for TV
The TV app must run on old, low-powered smart TV browsers. Tailwind v4 was removed because it failed to emit CSS in the static build. All ~411 lines of TV CSS are hand-written with minimal class names (~6 KB gzipped).

### 4. Mobile-first PWA (Consumer)
Bottom navigation on mobile, sticky header on desktop. Service worker with versioned caching. Offline-capable with graceful degradation.

### 5. Accessibility
- `prefers-reduced-motion: reduce` kills all animations across all three apps
- `display=swap` on all Google Fonts for zero layout shift
- System font fallback when Google Fonts is unreachable
- Focus-visible outlines on interactive elements

---

## Theming Architecture

### How it works (runtime)

1. **Database** stores per-masjid theme in `masjid_themes` table (15 fields)
2. **API** returns theme as part of page/board payloads
3. **`applyTheme()`** from `@masjid/ui-utils` (`packages/ui-utils/src/apply-theme.ts`) writes CSS custom properties to `document.documentElement` on page load
4. **Components** read colors from CSS custom properties directly — no prop-drilled colors
5. **Tailwind v4 `@theme` block** bridges custom properties into Tailwind utilities (`bg-primary`, `text-accent`, `font-heading`)

### Theme fields (stored per masjid)

```
primary_color   # hex, e.g. #1e3a8a    — brand/primary
accent_color    # hex, e.g. #10b981    — action/highlight/secondary
font_heading    # e.g. 'Inter'         — heading font family
font_body       # e.g. 'Roboto'        — body font family
layout_preset   # 'glass-dark' | 'minimal-light' | 'modern_minimal' (defaults to glass-dark)
time_format     # '12h' | '24h'        — time display format
label_adhaan    # default: 'Adhaan'     — can be 'Azaan' for Indo-Pak
label_iqaamah   # default: 'Iqaamah'   — can be 'Iqamah'
label_jumuah    # default: "Jumu'ah"   — can be 'Jummah'
label_speech    # default: 'Speech'
label_sunrise   # default: 'Sunrise'
label_fajr      # default: 'Fajr'
label_dhuhr     # default: 'Dhuhr'     — can be 'Zuhr' for Indo-Pak
label_asr       # default: 'Asr'
label_maghrib   # default: 'Maghrib'
label_isha      # default: 'Isha'
```

### Layout presets

#### `glass-dark` (default)
```css
--color-bg:             #030712           /* pitch dark navy */
--color-surface:        rgba(17,24,39,0.6) /* translucent glass */
--color-text:           #f9fafb            /* near-white */
--color-text-muted:     #d1d5db            /* light gray */
--color-text-dim:       #9ca3af            /* medium gray */
--color-border:         rgba(255,255,255,0.06)
--color-border-hover:   rgba(255,255,255,0.12)
--color-current-highlight: rgba(255,255,255,0.08)
--glass-shine:          rgba(255,255,255,0.06)
--shadow-card:          0 4px 24px rgba(0,0,0,0.28), inset 0 1px 0 var(--glass-shine)
--shadow-card-hover:    0 8px 32px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.1)
```

#### `minimal-light`
```css
--color-bg:             #f8fafc            /* slate-50 */
--color-surface:        #ffffff             /* pure white */
--color-text:           #0f172a             /* slate-900 */
--color-text-muted:     #64748b             /* slate-500 */
--color-text-dim:       #94a3b8             /* slate-400 */
--color-border:         rgba(0,0,0,0.1)
--color-border-hover:   rgba(0,0,0,0.18)
--color-current-highlight: rgba(0,0,0,0.06)
--glass-shine:          rgba(255,255,255,0.6)
--shadow-card:          0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 var(--glass-shine)
--shadow-card-hover:    0 8px 28px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)
```

### All 16 CSS custom properties
| Property | Set by | Purpose |
|---|---|---|
| `--color-primary` | theme DB | Brand/current-prayer/header accent |
| `--color-accent` | theme DB | Actions, highlights, next-prayer, countdown, flash |
| `--color-primary-light` | preset (minimal-light only) | Subtle gradient |
| `--color-accent-light` | preset (minimal-light only) | Subtle gradient |
| `--color-bg` | preset | Page background |
| `--color-surface` | preset | Card/panel background |
| `--color-text` | preset | Primary text |
| `--color-text-muted` | preset | Secondary text |
| `--color-text-dim` | preset | Tertiary text |
| `--color-border` | preset | Default borders |
| `--color-border-hover` | preset | Hover/active borders |
| `--color-current-highlight` | preset (TV) | Current prayer row bg |
| `--glass-shine` | preset | Glass reflection overlay |
| `--shadow-card` | preset | Card shadow |
| `--shadow-card-hover` | preset | Card hover shadow |
| `--font-heading` | theme DB | Heading font stack |
| `--font-body` | theme DB | Body font stack |
| `--safe-bottom` | hardcoded | Bottom safe area for notched phones |
| `--radius-card` | hardcoded | Card border-radius (1rem) |
| `--radius-btn` | hardcoded | Button border-radius (0.75rem) |

---

## CSS Architecture Per App

### Consumer (`apps/consumer/src/app.css` — 162 lines)

**Tech:** Tailwind v4 with CSS-first config (`@import 'tailwindcss'` + `@theme` block).

**`@theme` mappings** — these bridge CSS custom properties into Tailwind utilities:
```css
@theme {
  --color-primary: var(--color-primary);
  --color-accent: var(--color-accent);
  --color-primary-light: var(--color-primary-light);
  --color-accent-light: var(--color-accent-light);
  --color-surface: var(--color-surface);
  --font-heading: var(--font-heading);
  --font-body: var(--font-body);
}
```
This makes `bg-primary`, `text-accent`, `font-heading`, etc. valid Tailwind utilities.

**Global styles:**
- `box-sizing: border-box` everywhere
- `scroll-behavior: smooth`
- Body: `background-color: var(--color-bg)`, antialiased, `min-height: 100dvh`
- Selection: primary color bg + white text

**Key utility classes:**
- `.glass` — `backdrop-filter: blur(20px)`, surface bg, subtle white border
- `.glass-card` — `.glass` + gradient overlay, `border-radius: var(--radius-card)`, card shadow, hover lift (+2px translateY)
- `.geometric-pattern` — two radial gradients (primary + accent at 0.08 opacity, 40px blur), used behind hero area

**CSS animations (all disabled by `prefers-reduced-motion`):**
| Name | Duration | Effect |
|---|---|---|
| `fade-in-up` | 0.5s ease-out | Opacity 0→1 + translateY(12px→0) |
| `fade-in` | 0.4s ease-out | Opacity 0→1 |
| `scale-in` | 0.3s ease-out | Opacity + scale(0.95→1) |
| `slide-up` | 0.4s ease-out | translateY(100%→0) |
| `pulse-border` | 2s infinite | Accent border glow pulse |
| `shimmer` | 1.5s infinite | Linear gradient sweep for skeleton loading |

### TV (`apps/tv/src/app.css` — 411 lines)

**Tech:** Hand-written CSS, zero framework. ~6 KB gzipped. Semantic class names only. No `@theme`, no preprocessor.

**Design decisions:**
1. Tailwind v4 was removed — failed to output CSS in static builds
2. Old TV browsers struggle with large CSS files
3. Single-purpose kiosk app — flat CSS is adequate
4. Zero build dependency — native Vite CSS bundling only

**Key classes:**

| Class | Purpose |
|---|---|
| `.tv-page` | Full viewport flex column, no scroll, no user-select |
| `.tv-page--compact` | Overrides 20+ props when TV is not fullscreen (browser chrome visible, height < 88% screen) |
| `.tv-header` | Flex row, 3px primary top border accent, masjid name + city + date |
| `.tv-columns` | Two-column flex: 260px left panel + flex right grid |
| `.tv-info-panel` | 260px fixed, scrollable, contains clock + countdown + jumuah + upcoming changes |
| `.prayer-grid` | 3-column CSS grid (label + adhaan + iqaamah), font-size via `clamp()` |
| `.prayer-name--current` | Accent-colored row highlight |
| `.prayer-cell--flash` | 0.5s alternate pulse — accent → white + text-shadow glow |
| `.announcement-banner` | Bottom strip, accent bg, 30s infinite marquee, two duplicated items for seamless loop |
| `.countdown-time--urgent` | Accent color + pulse when <5 min remaining |

**Flash animation (key UX feature for Muazzin):**
```css
@keyframes flash-pulse {
  0%   { color: var(--color-accent); transform: scale(1); }
  100% { color: #fff; transform: scale(1.08);
         text-shadow: 0 0 12px var(--color-accent), 0 0 24px var(--color-accent); }
}
```
Triggers for a full 60 seconds when the current minute matches an adhaan or iqaamah time.

**Compact mode:** Detects when window height < 88% of screen height (meaning browser chrome is visible). Shrinks padding, gaps, and font sizes across ~20 properties.

### Admin (`apps/admin/src/app.css` — 324 lines)

**Tech:** Tailwind v4, same `@theme` approach as consumer.

```css
@theme {
  --color-primary:   var(--color-primary, #1e3a8a);
  --color-accent:    var(--color-accent, #10b981);
  --color-bg:        var(--color-bg, #0f172a);
  --color-surface:   var(--color-surface, #1e293b);
  --color-text:      var(--color-text, #f8fafc);
  --color-text-muted: var(--color-text-muted, #94a3b8);
  --color-border:    var(--color-border, #334155);
  --font-heading:    var(--font-heading, 'Inter');
  --font-body:       var(--font-body, 'Inter');
}
```

**Form styles** are classless — applied via element selectors (`input[type="text"]`, `textarea`, `select`). This means every form element in the admin app inherits these styles automatically.

**Button variants:**
- `.btn-primary` — accent bg, white text
- `.btn-secondary` — transparent, border, surface bg on hover
- `.btn-danger` — red text + border, red tint on hover

**Badge variants** (7 colors): `.badge-green`, `.badge-yellow`, `.badge-grey`, `.badge-purple`, `.badge-blue`, `.badge-amber`, `.badge-cyan`

**Custom toggle switch:** Pure CSS, 44×24px track + 18px thumb, accent-colored when checked.

---

## Fonts & Typography

### Font stack
Five Google Fonts are loaded across all apps:

| Font | Style | Default use |
|---|---|---|
| **Inter** | Sans-serif, 100–900 weights + italic | Default heading + body (default for everything in admin) |
| **Roboto** | Sans-serif, 100–900 weights + italic | Default body font in DB schema; used in seed data |
| **Amiri** | Serif (Arabic-aware), 400/700 + italic | Arabic-named masjids |
| **Noto Naskh Arabic** | Serif (Arabic), 400–700 | Traditional Arabic script |
| **Scheherazade New** | Serif (Arabic), 400–700 | Quranic/classical Arabic |

Loading: `display=swap` everywhere. Consumer/admin load synchronously with `<link>`. TV loads asynchronously with `media="print" onload="this.media='all'"` trick (non-blocking).

### Typography scale highlights

**Consumer (Tailwind-driven):**
| Element | Classes | Weight |
|---|---|---|
| Hero title | `text-2xl sm:text-3xl lg:text-4xl font-bold` | 700 |
| Countdown | `text-4xl sm:text-5xl font-mono font-bold tabular-nums text-accent` | 700 |
| Prayer names | `text-xs font-semibold uppercase tracking-[0.15em] font-heading` | 600 |
| Adhaan time | `text-xl font-bold tabular-nums` | 700 |
| Iqaamah time | `text-2xl font-extrabold tabular-nums` | 800 |
| Nav items | `text-sm font-medium` | 500 |
| Mobile nav labels | `text-[10px] font-medium` | 500 |

**TV (hand-written, clamp-based):**
| Element | Size | Weight |
|---|---|---|
| Masjid name | `clamp(1.75rem, 2.8vw, 3rem)` | 800 |
| Prayer names | `clamp(1.35rem, 2.4vw, 2.5rem)` | 800 (900 current) |
| Prayer times | `clamp(1.75rem, 3vw, 3.75rem)` | 700 (800 current) |
| Column headers | `clamp(0.85rem, 1.5vw, 1.15rem)` | 800 |
| Digital time | `clamp(1.5rem, 2vw, 2.25rem)` | 300 |

---

## Component Inventory

### Consumer (`apps/consumer/src/lib/components/`)

| Component | Purpose | Key visual details |
|---|---|---|
| **PrayerCard** | Single prayer time card | `.glass-card`, current → primary ring + pulse-border, next → accent border, past → 40% opacity |
| **PrayerList** | Wrapping grid of PrayerCards | Flex-wrap, 2-up mobile / 3-up desktop, current/next index logic |
| **AnnouncementCard** | Expandable announcement | `.glass-card`, click-to-expand, pinned → accent left border, chevron rotation |
| **DonateButton** | External donation CTA | Accent bg, heart icon, hover scale 105%, active scale 95% |
| **EmptyState** | Empty/zero state | Centered badge/icon + title + message |
| **ErrorState** | Error display | Warning triangle + message |
| **LoadingSpinner** | Spinner | 32px circle, accent border, transparent top |
| **SkeletonPrayerCard** | Loading placeholder | 6 shimmer bars, `.glass-card` wrapper |

### TV (`apps/tv/src/lib/components/`)

| Component | Purpose | Key visual details |
|---|---|---|
| **AnalogClock** | SVG clock | 200×200 viewBox, accent-colored second hand, surface fill |
| **PrayerBoard** | 3-column prayer grid | CSS grid, current highlight, flash pulse, asr secondary display |
| **Countdown** | Live countdown to next iqaamah | "Xh Ym" or "MM:SS", urgent red + pulse <5 min |
| **JumuahNotice** | Jumu'ah sessions list | Surface bg cards, bold accent time + optional khateeb |
| **AnnouncementBanner** | Bottom marquee | Accent bg, duplicate items for seamless scroll, 30s, pauses on hover |

### Admin (`apps/admin/src/lib/components/`)

| Component | Purpose | Key visual details |
|---|---|---|
| **AdminShell** | Navigation shell | 64px sidebar (desktop), hamburger overlay (mobile), accent active state |
| **BotChat** | AI chat interface | User/bot bubbles, DiffReceiptCard embed, confirm/cancel buttons, thinking dots |
| **ChatInput** | Message input | Auto-resize textarea, file upload, send button |
| **DiffReceiptCard** | Config change display | Domain color badges, action icons (+/−/✎/📌), expandable sections |
| **ConfirmDialog** | Modal confirmation | Backdrop, warning icon, cancel + confirm buttons |
| **ErrorCard** | Error + retry | Red tint card, optional retry button |
| **SkeletonForm** | Form loading | Shimmer label + input placeholders |

---

## Consumer Page Structure (`/[masjid_slug]/`)

```
+layout.svelte         Shell: sticky header + main + bottom nav
  ├── Header: logo (masjid initial) + name + desktop nav links
  ├── Main content area (max-w-7xl, pb-24 on mobile)
  └── Bottom nav: 5 tabs (Home | Prayer | News | Info | Maktab), fixed, lg:hidden

+page.svelte           Home page
  ├── Hero: masjid name + countdown to next iqaamah
  ├── PrayerCard grid (PrayerList)
  ├── Today's Jumu'ah (if Friday)
  ├── Pinned announcement
  └── DonateButton

prayer/+page.svelte    Weekly prayer times viewer (prev/next week)
jumuah/+page.svelte    Jumu'ah sessions list
announcements/+page.svelte  Announcements feed
donate/+page.svelte    Donation page with CTA
info/+page.svelte      Masjid contact info + social links
maktab/+page.svelte    Term/pricing card + Enroll CTA
maktab/enroll/+page.svelte  Square Web Payments enrollment form
```

### Embed mode
When `?embed=1` is in the URL (used for iframe embedding on external masjid sites), the header and bottom navigation are hidden.

---

## Admin Page Structure (`/admin/[slug]/`)

```
/login                          Admin login (email + password)
/admin/[slug]                   Dashboard (stats, status, quick actions)
/admin/[slug]/settings/profile   Profile settings (18 fields)
/admin/[slug]/settings/theme     Theme (presets, colors, fonts, labels)
/admin/[slug]/settings/prayer    Prayer rules table + dry-run simulator
/admin/[slug]/settings/jumuah    Jumu'ah sessions management
/admin/[slug]/settings/maktab    Maktab term/pricing + registrations
/admin/[slug]/settings/announcements  Announcements with markdown editor
/admin/[slug]/settings/domain    Custom domain management
/admin/[slug]/settings/snapshots  Config snapshots + rollback
/admin/[slug]/settings/account   Password change
/admin/[slug]/bot                AI bot chat panel
```

---

## TV Display Structure (`/display/[slug]/`)

Single-page, full-viewport kiosk. No layout wrapper.

```
.tv-page
  ├── .tv-header           Masjid name + city/state + Gregorian/Hijri date
  ├── .tv-main
  │   └── .tv-columns
  │       ├── .tv-info-panel    (260px)
  │       │   ├── AnalogClock
  │       │   ├── Digital time
  │       │   ├── Countdown (next iqaamah)
  │       │   ├── JumuahNotice (if Friday)
  │       │   └── Upcoming changes strip
  │       └── .tv-grid-section
  │           └── PrayerBoard   3-column grid (label + adhaan + iqaamah)
  └── AnnouncementBanner   Bottom marquee
```

---

## Known Design Issues & Areas for Improvement

### High priority

1. **`minimal-light` preset has no light-mode `.glass` equivalents**
   - `.glass` and `.glass-card` classes assume dark backgrounds (translucent dark surfaces, white borders)
   - A proper light theme would need `.glass-light` / `.glass-card-light` variants, or the classes need to be made preset-aware
   - Currently, switching to `minimal-light` gives white cards but the glass morphism classes don't visually match

2. **Consumer Jumuah homepage: 1 pre-existing test failure**
   - 48 tests, 1 failure (noted in AGENTS.md)

3. **Admin tests not yet written (~202 expected)**
   - All UI is scaffolded and working but untested

### Medium priority

4. **TV display: multiple announcement cycling not implemented**
   - Board payload already returns 20 announcements, but only pinned is shown
   - Could implement cycling animation (fade between announcements)

5. **TV display: `right_after_adhaan` not used**
   - When iqaamah follows adhaan immediately (e.g. Maghrib at sunset), the TV display should collapse into a single row
   - Data is already in the board payload, just not rendered

6. **Consumer `+error.svelte` is basic**
   - Shows generic "Something went wrong" — could show contextual diagnostics

7. **Admin AI bot: SSE streaming not implemented (Phase 5)**
   - Currently request-response with loading indicator
   - No conversation history browsing
   - No markdown rendering in bot text messages
   - No keyboard shortcuts or slash command autocomplete

8. **Only 1 admin per masjid**
   - `admins` table has UNIQUE FK on `masjid_id`
   - No multi-admin or role-based access control

### Low priority / nice to have

9. **No dark/light mode toggle for admin**
   - Admin is always dark. Some admins may prefer light mode

10. **No TV-specific theme preset**
    - TV uses the same `glass-dark` / `minimal-light` presets as consumer
    - TV could benefit from a dedicated preset optimized for large screens (higher contrast, larger touch targets for interactive kiosk mode if ever needed)

11. **Consumer service worker complexity**
    - 26 Playwright integration tests
    - Versioned cache with build hash
    - `/sw-kill` self-destruct mechanism
    - Multiple guard layers (scheme, method, navigation, origin, opaque)
    - This is hardened but complex — any SW changes should be approached carefully

---

## Technical Constraints to Respect

1. **No Tailwind v4 on TV** — Tailwind v4 fails to output CSS in static builds. TV CSS must remain hand-written.

2. **Svelte 5 `class:` directive bug** — `class:bg-gray-900/80` crashes the parser (the `/` in the class name is the problem). Always use inline ternaries: `{cond ? 'bg-gray-900/80' : 'bg-gray-900'}`.

3. **No prop-drilled colors in consumer components** — all colors come from CSS custom properties. This is intentional. Components never accept `accentColor` or similar props.

4. **API times are always 24h** — `formatTime()` utility converts to 12h client-side based on `time_format` theme field.

5. **Fonts loaded from Google Fonts CDN** — system sans-serif fallback when unreachable. `display=swap` on all.

6. **No admin service worker** — by design. Browser cache is sufficient. No offline support needed for admin.

7. **Svelte 5 runes** — all components use `$props()`, `$state`, `$derived`, `$effect`. No Svelte 4 syntax anywhere.

---

## Design Priorities for UI Work

If improving the visual design, these areas would have the highest impact:

1. **`minimal-light` preset completion** — create light-mode variants of `.glass` / `.glass-card` so the light preset actually looks good
2. **TV display polish** — the prayer grid is functional but utilitarian. Opportunities for subtle design refinements: prayer iconography, smoother flash transitions, better spacing at extreme screen sizes
3. **Admin form UX** — forms are classless (element-selector-based styling). Could benefit from componentized form controls (FormField, ColorPicker, FontSelector, TimezonePicker)
4. **Consumer animations** — the existing animations are solid but minimal. Opportunities for micro-interactions (prayer card hover states, countdown flourish at zero, page transition polish)
5. **Admin bot chat UX** — the DiffReceiptCard is functional but could be more visual (side-by-side before/after, animated section expands, color-coded change indicators)

---

## Key Files for UI Work

```
packages/ui-utils/src/apply-theme.ts       — Runtime theme application
packages/ui-utils/src/presets.ts           — Preset token definitions
packages/schemas/src/masjid.ts             — Theme schema (Zod types)
apps/consumer/src/app.css                  — Consumer Tailwind v4 config + utility classes
apps/consumer/src/lib/components/          — 8 consumer components
apps/consumer/src/routes/[masjid_slug]/+layout.svelte  — Consumer shell
apps/tv/src/app.css                        — TV hand-written CSS (~411 lines)
apps/tv/src/lib/components/                — 5 TV components
apps/tv/src/routes/display/[slug]/+page.svelte  — TV page
apps/admin/src/app.css                     — Admin Tailwind v4 config
apps/admin/src/lib/components/             — 7 admin components
apps/admin/src/routes/admin/[slug]/+layout.svelte  — Admin shell
docs/tv-display.md                         — TV display design doc
docs/admin-manual-settings.md              — Admin settings UI design doc
docs/admin-ai-capabilities.md              — Admin AI bot UI design doc
```
