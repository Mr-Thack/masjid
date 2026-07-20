# AGENTS.md

## Current state (2026-07-20)
The project is a fully implemented monorepo with:
- **Working API** (SvelteKit + D1, 263 tests)
- **Working TV frontend** (SvelteKit static, 21 tests)
- **Working consumer frontend** (SvelteKit static/SPA, 33 tests)
- **All 317 tests passing**
- **Everything runs locally** — API on 5173, TV on 5174, consumer on 5175

## How to start everything
```bash
# Terminal 1 — seed DB + start API
npx tsx tooling/seed.ts   # only needed first time or after DB loss
npm run dev --workspace=@masjid/api          # port 5173

# Terminal 2 — TV display
npm run dev --workspace=@masjid/tv           # port 5174

# Terminal 3 — consumer PWA
npm run dev --workspace=@masjid/consumer     # port 5175
```

## How to test
```bash
npm run test          # API-only, 263 tests (no external deps)
npm run test:tv       # TV frontend, 21 tests (jsdom + testing-library)
npm run test:consumer # Consumer frontend, 33 tests (jsdom + testing-library)
npm run test:all      # everything
```

## Seed data
- Team: `admin@masjid-alnoor.org` / `password123`
- Who slug: `masjid-al-noor` (note dashes, not underscores)
- API endpoint: `http://localhost:5173/api/v1/masjids/masjid-al-noor`
- Consumer page: `http://localhost:5175/masjid-al-noor`
- TV page: `http://localhost:5174/display/masjid-al-noor`
- DB file: `.masjid/local.db` (SQLite via better-sqlite3 in dev mode)

## Monorepo structure
```
masjid/
  packages/schemas/          — Shared Zod types (Theme, Announcement, Jumuah, etc.)
  apps/api/                  — SvelteKit API + Drizzle ORM + Prayer engine
  apps/tv/                   — SvelteKit static, display-only (kiosk/TV)
  apps/consumer/              — SvelteKit static/SPA, PWA (user-facing)
  workers/push/              — Cloudflare Worker for push notifications (skeleton)
  tooling/seed.ts            — DB seed script
  vitest.config.ts           — Root vitest (API only, node)
  vitest.tv.config.ts        — TV vitest (jsdom, svelte plugin)
  vitest.consumer.config.ts   — Consumer vitest (jsdom, svelte plugin)
```

## Key architectural decisions
- **Local dev DB**: `better-sqlite3` at repo-root `.masjid/local.db`, NOT the wrangler D1 miniflare DB
- **`getDb()`** resolves DB path from `import.meta.dirname` → `apps/api/.masjid/local.db` in dev, D1 binding in production
- **API proxy**: Both TV and consumer have Vite proxy configs: `/api` → `localhost:5173`
- **SvelteKit fetch**: Load functions must use `event.fetch` for SSR, not `globalThis.fetch`. The `api.ts` in both apps accepts an optional `customFetch` parameter for this.
- **Svelte 5 runes**: All components use `$props()`, `$state`, `$derived`, `$effect`. No Svelte 4 syntax.
- **Tailwind v4**: Uses `@tailwindcss/vite` plugin (CSS-first config), NOT postcss. No `tailwind.config.ts` in consumer (deleted — uses `@theme` block in `app.css` instead).
- **Svelte `class:` directive bug**: Svelte 5 parser chokes on `class:` with Tailwind classes containing `/` (e.g., `class:bg-gray-900/80`). Must use inline `{cond ? 'class' : 'class'}` instead.
- **Admin routes**: Moved under `admin/masjids/[id]/...` to avoid route conflict with public `masjids/[slug]`.

## Consumer frontend architecture (Phase 2 complete)

### Theme system (extensible, per-masjid)
- **`src/lib/theme/context.svelte.ts`**: `applyTheme(theme)` function sets CSS custom properties on `document.documentElement` from DB theme data
- **`src/lib/theme/presets.ts`**: Two presets — `glass-dark` (dark glassmorphism) and `minimal-light` (light cards)
- **`layout_preset` field** in `masjid_themes` table switches presets. Current seed uses `"modern_minimal"` which falls through to `glass-dark` default.
- **CSS custom properties** (16 total):
  - `--color-primary`, `--color-accent`, `--color-primary-light`, `--color-accent-light` — set by theme
  - `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-text-dim` — set by preset
  - `--color-border`, `--color-border-hover` — set by preset
  - `--font-heading`, `--font-body` — set by theme
  - `--safe-bottom`, `--radius-card`, `--radius-btn` — layout
- **Tailwind v4 `@theme`** in `app.css` maps `--color-primary: var(--color-primary)` etc. so `bg-primary`, `text-accent`, `font-heading` are valid Tailwind utilities.
- **No prop-drilled colors**: PrayerCard, PrayerList, AnnouncementCard, DonateButton all read colors from CSS custom properties directly. No `accentColor` prop.
- **Fonts loaded** in `app.html`: Inter, Roboto, Amiri, Noto Naskh Arabic, Scheherazade New — all with `display=swap`.
- **Seed data uses `font_body: "Roboto"`** — Roboto was added to the Google Fonts URL specifically for this.

### Component library (`src/lib/components/`)
| Component | Purpose |
|---|---|
| `PrayerCard` | Single prayer time card (adhaan + iqaamah, next/past states) |
| `PrayerList` | Grid of PrayerCards with next prayer index logic |
| `AnnouncementCard` | Expandable announcement (title, date, compiled_html, pin badge) |
| `DonateButton` | External donation link CTA (heart + external link icons) |
| `LoadingSpinner` | Centered spinning loader |
| `ErrorState` | Error message card with warning icon |
| `EmptyState` | Empty state card with icon, title, and message |
| `SkeletonPrayerCard` | Shimmer placeholder for prayer card loading |

### Pages (under `/[masjid_slug]/`)
| Route | Description |
|---|---|
| `+layout.svelte` | Shell: sticky header, bottom nav (4 tabs), theme application, nav transitions |
| `+layout.ts` | Load function — fetches page payload, returns masjid/theme/prayer_times/jumuah/announcements |
| `+page.svelte` | Home: hero + countdown, prayer cards grid, jumuah today, pinned announcement, donate CTA |
| `+error.svelte` | Error boundary fallback |
| `prayer/+page.svelte` | Weekly prayer times viewer (prev/next week navigation) |
| `jumuah/+page.svelte` | Jumu'ah sessions list with session cards |
| `announcements/+page.svelte` | Announcements feed |
| `donate/+page.svelte` | Donation page with CTA and "Why Give" section |

## KNOWN ISSUES (for next session)

### Visual/styling problems
The consumer frontend is functionally correct (data loads, pages render, no JS errors) and the major visual bugs are now fixed:

1. **SVG sizing fixed** — every SVG icon now has explicit `width`/`height` attributes, preventing Tailwind v4's `display: block` reset from inflating them to the viewport size.

2. **Glass-card styling fixed** — the theme CSS is now actually imported via `src/routes/+layout.svelte`. `app.css` has a richer `.glass-card` gradient, stronger borders, and a subtler `.geometric-pattern`. The hero countdown, `PrayerCard`, and `DonateButton` were tightened up.

3. **No image visibility** — screenshots can now be captured and iterated on.

4. **The page title was fixed** — shows the actual masjid name via `<svelte:head>` in `+layout.svelte`.

5. **Font loading was fixed** — simplified to synchronous `display=swap`. Roboto added to the font URL to match the seed data's `font_body`.

6. **Service worker was fixed** — removed `addAll(['/'])` from install event (caused "Request failed" cache errors). Now only caches static assets by file extension.

### Other known items
- **The `minimal-light` preset exists** but has no light-mode `.glass`/`.glass-card` equivalents — would need light variants for a true light theme.
- **Only 1 admin per masjid** — the `admins` table has a UNIQUE FK on `masjid_id`.
- **No admin UI exists** — all data management is via API only. This is intentional (Zero-UI ingestion path).
- **TV frontend uses separate theming** — check `apps/tv/src/routes/display/[masjid_slug]/+page.svelte` for its CSS variable injection.
- **The `+error.svelte` page is basic** — shows a generic error message. Could be improved.

## Design documents (always useful)
- `Background.md` — original vision/spec
- `schema.sql` — complete D1 schema (9 tables + indexes)
- `docs/api.md` — 24 API route reference
- `docs/rules-engine.md` — prayer rules engine spec
- `docs/mcp-integration.md` — MCP/Zod strategy

## Quick dev tips
- DB goes missing? Re-run `npx tsx tooling/seed.ts`
- Consumer page returning 500? API might be down or DB empty — check `curl http://localhost:5173/api/v1/masjids/masjid-al-noor`
- Frontend tests fail? Make sure `conditions: ['browser']` is in the vitest config — this is required for `@testing-library/svelte` to work with Svelte 5
- Need to inspect the running page? `curl http://localhost:5175/masjid-al-noor` gives the SSR output
- The CSS is served at `http://localhost:5175/src/app.css` — contains the full compiled Tailwind v4 output