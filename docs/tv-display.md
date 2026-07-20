# TV Display Architecture

The TV display (`apps/tv/`) is a **static SvelteKit kiosk display** built for prayer hall big-screen TVs. It renders on `GET /display/{masjid_slug}` and targets TVs 10 years old or newer.

## Design Philosophy

1. **Runs on potato TVs** — No heavy frameworks, no Tailwind CSS (replaced with ~300 lines of hand-written CSS), non-blocking Google Fonts with `<noscript>` fallback.
2. **Fail cleanly** — Stale data continues displaying silently during network blips. Error boundary page for hard failures. No crashing.
3. **Dual audience** — Serves both the congregation (prayer times, what's happening now) and the Muazzin (flash signal at exact adhaan/iqaamah minute).
4. **Single API call** — The board endpoint returns all data (today + 7 upcoming days, theme, jumuah, announcements) in one request. No client-side waterfall fetches.

## Layout

Two-column layout optimized for 16:9 (1920×1080) screens:

```
┌──────────────────────────────────────────────────────────────────────┐
│  MASJID AL-NOOR · Chicago, IL                                       │
│  Monday, July 20, 2026  ·  Safar 6, 1448 AH                         │
├───────────────┬──────────────────────────────────────────────────────┤
│               │                                                      │
│   ┌─────────┐ │     FAJR      DHUHR      ASR     MAGHRIB     ISHA   │
│   │ ANALOG  │ │    ─────     ─────     ─────    ─────      ─────   │
│   │ CLOCK   │ │  Azaan   Azaan      Azaan     Azaan       Azaan    │
│   │ (SVG)   │ │  4:15 AM  12:57 PM   3:14 PM   8:21 PM    9:57 PM  │
│   │         │ │  Iqamah  Iqamah     Iqamah    Iqamah     Iqamah   │
│   │         │ │  5:00 AM   1:10 PM   3:24 PM   8:26 PM   10:10 PM  │
│   │ 2:14 pm │ │    Sun                                            │
│   └─────────┘ │   5:33 AM                                         │
│               │               ███ CURRENT ███                       │
│   2:14 PM     │                                                      │
│               │   * Jumu'ah: 1:30 PM (Eng) · 2:30 PM (Arb)          │
│  Maghrib in   │                                                    │
│   6h 07m      │                                                    │
│               │                                                    │
│  ──────────── │                                                    │
│  Coming up:   │                                                    │
│  Thu  Fajr    │                                                    │
│   5:00→5:45   │                                                    │
│  Fri  Asr     │                                                    │
│   3:24→4:00   │                                                    │
├───────────────┴──────────────────────────────────────────────────────┤
│ 🔊  Community Iftar This Saturday — scrolling banner ──────────────→│
└──────────────────────────────────────────────────────────────────────┘
```

### Left column (260px, the "info panel")
| Element | Description |
|---|---|
| `AnalogClock` | SVG clock face with hour/minute/second hands, accent-colored second hand |
| Digital time | Below clock, subtle gray text |
| Countdown | "Maghrib in 6h 07m" — compact, counts to next iqaamah |
| Divider | Gradient line separator |
| Upcoming changes | Iqaamah time diffs for next 7 days (only shown when times differ from today) |

### Right column (flex, the prayer grid)
| Element | Description |
|---|---|
| Prayer grid | 6-column CSS grid: label column + 5 prayer columns |
| Azaan row | Adhaan times for all 5 prayers |
| Iqamah row | Iqaamah times for all 5 prayers |
| Sunrise row | Sunrise time (Fajr column only) |
| Current prayer highlight | Accent-colored column for the prayer whose time window we're in |
| Flash signal | Sharp pulse animation on a cell when current minute matches its time |

## Component Inventory

| Component | File | Purpose |
|---|---|---|
| `AnalogClock` | `src/lib/components/AnalogClock.svelte` | SVG clock, ~100 lines, pure CSS `transform: rotate()` via derived angles |
| `PrayerBoard` | `src/lib/components/PrayerBoard.svelte` | CSS grid table, flash logic, sunrise row, current prayer highlight, themed labels |
| `Countdown` | `src/lib/components/Countdown.svelte` | Compact `<span>` showing "Xh Ym" or "MM:SS" until next iqaamah |
| `JumuahNotice` | `src/lib/components/JumuahNotice.svelte` | One-liner: `* Jumu'ah: 1:30 PM (Eng) · 2:30 PM (Arb)` |
| `AnnouncementBanner` | `src/lib/components/AnnouncementBanner.svelte` | Marquee banner at page bottom, accent-colored gradient background |

## Routing

```
src/routes/
├── +layout.svelte          # Root layout — imports app.css
├── display/
│   └── [masjid_slug]/
│       ├── +layout.svelte  # Pass-through layout
│       ├── +page.ts        # Load: calls fetchBoardPayload()
│       ├── +page.svelte    # Main two-column display
│       └── +error.svelte   # Error boundary ("Unable to load display")
```

## Data Flow

1. **SSR load** (`+page.ts`): Calls `fetchBoardPayload(slug)` → `GET /api/v1/masjids/{slug}/board`
2. **Client mount**: Derives times, time format, labels, current prayer, flash state, upcoming changes
3. **1-second tick**: `setInterval` updates `now` → reactive derivations recompute clock hands, countdown, flash, current prayer
4. **60-second poll**: Re-fetches board endpoint, replaces payload in-place. Silently continues on error.

## Current Prayer Logic

The prayer whose time window we're currently in is highlighted:

| Prayer | Window |
|---|---|
| Fajr | [Fajr iqaamah, sunrise) |
| — | (sunrise, Dhuhr iqaamah) — *null, no prayer highlighted* |
| Dhuhr | [Dhuhr iqaamah, Asr iqaamah) |
| Asr | [Asr iqaamah, Maghrib iqaamah) |
| Maghrib | [Maghrib iqaamah, Isha iqaamah) |
| Isha | [Isha iqaamah, midnight) ∪ [midnight, next Fajr iqaamah) |

The Fajr sunrise cutoff is critical — without it, Fajr would incorrectly appear "current" until Dhuhr.

## Flash Signal

When `now.getHours()*60 + now.getMinutes()` matches an adhaan or iqaamah time, that cell gets a sharp CSS pulse:

```css
@keyframes flash-pulse {
  0%   { color: var(--color-accent); transform: scale(1); }
  100% { color: #fff; transform: scale(1.08);
         text-shadow: 0 0 12px var(--color-accent), 0 0 24px var(--color-accent); }
}
```

Repeats every 500ms (alternate direction) for the full 60-second duration of the matching minute. This signals the Muazzin when to rise.

## Upcoming Iqaamah Changes

The board endpoint returns 7 upcoming days of prayer times. The page derives diffs by comparing each future day's iqaamah against today's baseline. Only entries where the time differs are displayed.

Shown compactly in the left panel:
```
Coming up:
  Thu  Fajr   5:00→5:45
  Fri  Asr   3:24→4:00
```

**Note:** This computation moved server-side (board endpoint) to avoid 7 client-side waterfall fetches. The old consumer implementation fetches 1 day at a time client-side — this TV approach is more efficient.

## Theming

All theme fields from `masjid_themes` flow through the board endpoint to the TV:

| Field | Usage |
|---|---|
| `primary_color` | Masjid name color in header |
| `accent_color` | Current prayer highlight, flash, countdown urgent, analog clock second hand |
| `font_heading` | Prayer labels, masjid name |
| `font_body` | Body text |
| `time_format` | `12h` (AM/PM) or `24h` — applied via `formatTime()` |
| `label_fajr`–`label_isha` | Custom prayer names in column headers |
| `label_adhaan`, `label_iqaamah` | Row labels in prayer grid |
| `label_sunrise` | Sunrise row label |
| `label_jumuah` | Jumuah notice heading |

All labels fall back to English defaults if the theme row is missing. `layout_preset` is not used (the TV has its own minimal dark theme).

## CSS Decision: No Tailwind

Tailwind v4 was replaced with hand-written CSS (~300 lines, 6 KB gzipped). Reasons:

1. **Tailwind v4 failed to output CSS** in the static build — `/src/app.css` returned 404 in production.
2. **Old TV browsers** struggle with large CSS files. The custom CSS file is 6 KB vs Tailwind's ~50 KB+ uncompressed output.
3. **Zero build dependency** — no Vite plugin needed. The CSS is imported in the root `+layout.svelte` and bundled by Vite natively.
4. **Simpler maintenance** — all styles for a single-page kiosk app live in one file.

## Font Loading

Google Fonts are loaded **non-blocking** with a timeout fallback:

```html
<link rel="stylesheet" href="..." media="print" onload="this.media='all'" />
<noscript><link rel="stylesheet" href="..." /></noscript>
```

- With JS: fonts load asynchronously, page renders instantly with system fonts
- Without JS: `<noscript>` fallback loads fonts synchronously
- If Google Fonts is unreachable (no internet on TV): system `sans-serif` is used

## API Endpoint

`GET /api/v1/masjids/{slug}/board` — defined at `apps/api/src/routes/api/v1/masjids/[slug]/board/+server.ts`

Returns in a single response:
- `masjid` — slug, name, city, external_donation_url
- `theme` — all 15 theme fields with defaults
- `today` — date + computed prayer times (adhaan + iqaamah + sunrise)
- `upcoming_days` — array of 7 future days with computed prayer times
- `jumuah` — active jumuah sessions
- `pinned_announcement` — single pinned/published announcement
- `recent_announcements` — up to 20 recent published announcements

Computes 8 days of prayer times server-side (today + 7 future) using the existing `computeIqaamah()` prayer engine. This is intentional — the TV makes one request, not eight.

## Future Considerations

- **Multiple announcement cycling** — `recent_announcements` is already in the board payload. Could cycle through them in the banner instead of only showing the pinned one.
- **Right-after-adhaan** — The `right_after_adhaan` boolean from the prayer engine is available in the board payload but not yet used in the display. Could collapse the adhaan/iqamah row when true (Maghrib at sunset).
- **TV-specific theme** — The `layout_preset` field is not used. Could add a TV preset that adjusts contrast/brightness for TV screens.