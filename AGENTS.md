# AGENTS.md

## Current state (2026-08-05)
The project is a fully implemented monorepo with:
- **Working API** (SvelteKit + D1, 671 tests)
- **Working TV frontend** (SvelteKit static, 210 tests — no Tailwind, hand-written CSS)
- **Working consumer frontend** (SvelteKit static/SPA, 165 tests)
- **Working WhatsApp worker** (Stages 1-4 complete — webhook + session + LLM agent + vision + dry-run + rollback + RTL, 215 tests)
- **Working @masjid/agent** (shared bot logic extracted from WhatsApp worker — tools, runner, prompts, format, api-client, session, media)
- **Admin app scaffolded** (SvelteKit static/SPA on port 5176 — auth, dashboard, 9 settings pages, bot chat panel — tests pending)
- **Mishkaat style system shipped (Phases 0-3, 2026-07-29)** — `style_system`/`style_options` columns, Mishkaat preset (espresso/gold), RTL TV layout, Amiri headings, star-and-octagon band (default motif; honeycomb opt-in), arch clock-niche + rosette ornaments, classic clock, server-time sync, soul-column frames (hadith/jumu'ah/announcements/donate appeal + QR as two slides), schedule changes rolling through the prayer board (45s/15s cycle, adhaan→iqaamah+5min holdoff), ceremony states (adhaan → countdown → in-progress → quiet → night calm: 20% veil, board stays readable), Friday/Ramadan/Eid modes, ambient palette. Sakeenah unchanged. New registrations default to Mishkaat. See `docs/design-language.md`.
- **Prayer tables shipped (2026-07-30)** — the homepage prayer section is the classic masjid timetable (`PrayerTable`: one row per prayer, adhaan/iqaamah columns, sunrise row, current-row highlight + rosette, next chip, right-after-adhaan and dual-Asr notes) and the Times tab is the weekly timetable (`WeeklyPrayerTable`: days × prayers, iqaamah over adhaan per cell, today row, cross-week change accents, styled legend) — BOTH style systems, replacing the card grid and the stacked day cards. `PrayerCard`/`PrayerList`/`SkeletonPrayerCard` deleted.
- **Mishkaat consumer adaptation shipped (§7.11, 2026-07-30)** — the soul comes to the mobile main page when Mishkaat is selected: mihrab hero niche (shared arch geometry), star band + rosette header glyph, Hadith of the Day card, Jumu'ah pinned Thu–Fri, adhaan/iqaamah hero moments (shared `computeCeremony`), mild ambient background, current-prayer rosette marker. Ceremony overlays/rotation/board roll deliberately stay TV-only. Shared ornaments/state machine now live in `@masjid/ui-utils` (`components/`, `arch.ts`, `ceremony.ts`).
- **Everything runs locally** — API on 5173, TV on 5174, consumer on 5175, admin on 5176
- **Production deployed** — API on mapi.mr-thack.workers.dev; ALL 3 page apps (consumer + TV + admin) unified on **masjid-live.pages.dev** via Pages advanced mode (`_worker.js` router in the merged deploy)
- **Unified deploy live (2026-07-29)** — one domain for everything. **Read `docs/unified-deploy.md` before touching deployment.** Old `masjid-live-tv`/`masjid-live-admin` Pages projects deleted; cutover complete.
- **Branching model (2026-08-05)**: `master` = dev (commit freely), `staging` = release gate (auto-deploy + E2E on push), production = manual `workflow_dispatch` only. **Only push to staging when you are preparing a production release.** Development happens on master; when enough changes are ready, merge master → staging, let E2E run, then manually trigger `Deploy to Cloudflare` to push to prod. Staging is NOT for everyday testing — it's the final gate before prod.
- **Build ID (2026-08-05)**: every frontend app injects `<meta name="build-id" content="<git-hash>">` via `hooks.server.ts` `transformPageChunk`. The API `/status` endpoint also returns `build_id`. Check from any device: View Source or `curl /api/v1/status | jq .build_id`.
- **E2E hydration signal (2026-08-05)**: each root layout sets `document.documentElement.dataset.hydrated="true"` in `$effect()`. The `visitPage()` helper waits for `html[data-hydrated]` before checking `expectText`/`expectSelector`. Tests use `waitUntil: 'load'` (never `networkidle` — breaks on Square SDK/polling pages).
- **E2E determinism rework (2026-08-05)**: the harness (`tests/e2e/helpers.js`) is condition-based, not sleep-based. Key rules: (1) every case runs inside `testCase(t, id, fn)` — a thrown timeout becomes a FAIL line, never a process-killing uncaught exception; (2) `loginAdmin()` logs in ONCE per admin run (hydration awaited before touching the form — a pre-hydration submit click triggers a NATIVE form submit, which was the `waitForURL('**/admin/**')` CI flake — and `waitForURL` is registered before the click); the navigation is raced against the app's error banner so a 500ing login API fails FAST with the real message; later authed cases reuse `context.storageState()` (JWT lives in localStorage); (3) fixed `waitForTimeout` only for stress pacing, never readiness — use `gotoPage`/`settlePage` (adaptive network-quiet settle); (4) ceilings: nav 30s, expectation 15s, login 45s, settle ≤2s; visitPage expectations run concurrently; (5) suite watchdog `E2E_SUITE_WATCHDOG_MS` (default 8min) aborts stuck suites with the in-flight case name; (6) all non-browser fetches use `AbortSignal.timeout` and return `status: 0` on failure; (7) `run.js` honors multiple `--suite=` flags and prints per-suite timings; (8) CI browser/deploy jobs run `tests/e2e/wait-for-deploy.js <app>` first — a readiness probe that polls until the edge serves the fresh deploy (build-id meta == `GITHUB_SHA`, chunks are real assets) and warms it, replacing the blind `sleep 30` (mixed-version edge serving flaked consumer/tv for minutes post-deploy, 2026-08-06). Full local run ≈ 3.5 min; CI splits suites across parallel jobs. See `docs/integration-testing.md` §5.2.
- **D1 column-order fix (2026-08-05)**: `fetchThemeRow()` in `apps/api/src/lib/server/db/index.ts` bypasses Drizzle's position-based `.raw()` mapping by using raw D1 binding (`.all()` → named objects) in production, falling back to Drizzle locally. The Drizzle schema column order now matches `schema.sql` migration order. Do NOT insert new columns in the middle of `masjidThemes` — always append them (D1's `ALTER TABLE ADD COLUMN` puts them at the end).
- **E2E determinism restructure (2026-08-09)**: the post-lessons-36-46 flakes were shared-STATE races, not readiness. Fixes (full rationale: `docs/e2e-determinism.md`): (1) transient gateway codes 502/503/520-524 from our origins are `warnings`, not `failedRequests` — a 503 that breaks a page still fails via missing expectations; (2) mutation tests are hermetic — one `testCase` per mutation, unique per-run entity names, UI creates but **API restores/cleanup in `finally`** via `tests/e2e/api-client.js` (`snapshotProfileFields`/`restoreProfileFields`, `restoreEnrollmentOpen`, `delete*ByPrefix`); ADM-16..22 are separate cases, ADM-18/19 now really open the create forms (they were silently dead); (3) **staging D1 is reseeded on every staging deploy** (`tooling/dump-seed-sql.ts` → `wrangler d1 execute --file`) — no run inherits drift; (4) `wait-for-deploy.js api` mode gates the `e2e-api` job and checks the worker's `build_id` == `GITHUB_SHA` (a 200 from a mid-propagation old worker is not readiness); (5) ALL `/maktab/enroll` loads use `waitUntil: 'domcontentloaded'` (Square iframes stall `load`); CON-46 asserts the enrollment-open precondition via API first; (6) `loginAdminWithRetry` retries once (cold bcrypt) — attach request listeners at CONTEXT level so they survive the retry. Two latent app bugs found and fixed along the way: admin profile/theme pages rendered saveable default forms when the initial GET failed (now a load-error state), and `ensureTables` still created the dropped `external_donation_url` column locally. Note: the announcement DELETE endpoint ARCHIVES (soft delete) — API cleanup means "archived", residue rows are wiped by the staging reseed.

## First-time setup (fresh clone or worktree)

Every fresh checkout — whether `git clone` or `git worktree add` — needs these steps before anything else will work:

```bash
# 1. One-shot setup (install + sync + seed)
npm run setup

# 2. (Legacy manual steps kept for reference)
npm install

# 3. Generate SvelteKit types in every SvelteKit workspace
#    (vite dev/build do this automatically, but vitest / tsc don't)
for ws in apps/api apps/consumer apps/tv apps/admin; do
  npx --workspace=@masjid/${ws##*/} svelte-kit sync
done

# 4. Seed the local SQLite database
npx tsx tooling/seed.ts
```

> **`npm run setup`** runs all of the above in one pass. Use it for fresh clones and new worktrees.

> **Per-worktree note**: each `git worktree` is a separate directory with its own `.masjid/local.db` and `node_modules`. You must `npm install` and seed inside each worktree. See "Multi-agent parallel work (worktrees)" below.
>
> **If admin/consumer/TV tests fail with `Cannot find module './.svelte-kit/tsconfig.json'`**, the `.svelte-kit/` output is missing — re-run step 2 above (`svelte-kit sync`).

## How to start everything
```bash
# Terminal 1 — start API
npm run dev --workspace=@masjid/api          # port 5173

# Terminal 2 — TV display
npm run dev --workspace=@masjid/tv           # port 5174

# Terminal 3 — consumer PWA
npm run dev --workspace=@masjid/consumer     # port 5175

# Terminal 4 — admin dashboard
npm run dev --workspace=@masjid/admin        # port 5176
```

## How to test
```bash
npm run test             # API unit tests, 671 (no server needed)
npm run test:integration  # API integration tests, 7 (requires `npm run dev` on 5173)
npm run test:tv          # TV frontend, 210 tests (jsdom + testing-library)
npm run test:consumer    # Consumer frontend, 165 tests (jsdom + testing-library)
npm run test:whatsapp    # WhatsApp worker, 215 tests (node, mocked D1 + fetch)
npm run test:sw          # Service worker removal tests, 12 (Playwright, requires running dev servers)
npm run test:agent       # Agent package tests (pending: ~175 expected)
npm run test:admin       # Admin app tests, 115 tests (jsdom + testing-library)
npm run test:tooling     # Tooling tests (merge-pages, build integrity — 13 tests)
npm run test:e2e         # Browser E2E smoke vs local dev servers (tests/e2e/ — api + consumer suites live; spec: docs/integration-testing.md, cases: docs/integration-test-cases.md)
npm run test:e2e:staging # Browser E2E vs staging (masjid-staging.pages.dev + mapi-staging worker + masjid-db-staging; writes OK — disposable DB)
npm run test:e2e:prod    # Browser E2E vs prod, read-only
npm run test:all         # everything (excluding test:sw and test:admin since they need servers running)
```

## Seed data

### Masjid Al-Noor (Chicago, IL)
- Team: `admin@masjid-alnoor.org` / `password123`
- Who slug: `masjid-al-noor` (note dashes, not underscores)
- WhatsApp: `+15551230001` (Zero-UI admin)
- Style system: **Mishkaat** (gold, `layout_preset='mishkaat'`, Amiri headings) — the flagship seed
- API endpoint: `http://localhost:5173/api/v1/masjids/masjid-al-noor`
- Consumer page: `http://localhost:5175/masjid-al-noor`
- TV page: `http://localhost:5174/display/masjid-al-noor`
- Maktab enrollment: `http://localhost:5175/masjid-al-noor/maktab/enroll`
  - Seed term: Fall 2026, 4 months, open, prices $100 / $160 / $200 per month

### Masjid Al-Jabal (Kennesaw, GA)
- Team: `admin@masjid-aljabal.org` / `password123`
- Who slug: `masjid-al-jabal`
- WhatsApp: `+15551230002` (Zero-UI admin)
- API endpoint: `http://localhost:5173/api/v1/masjids/masjid-al-jabal`
- Consumer page: `http://localhost:5175/masjid-al-jabal`
- TV page: `http://localhost:5174/display/masjid-al-jabal`
- Notes: Hanafi / Indo-Pak congregation; **Sakeenah** style system (`minimal-light` preset), `12h` time format, ISNA calculation method, and Indo-Pak transliterations (`Azaan`, `Iqamah`, `Zuhr`, `Jummah`).
- DB file: `.masjid/local.db` (SQLite via better-sqlite3 in dev mode)

## Monorepo structure
```
masjid/
  packages/schemas/          — Shared Zod types (Theme, Announcement, Jumuah, etc.)
  packages/ui-utils/         — Shared UI helpers: theme presets, applyTheme, prayer-change utilities, Mishkaat shared modules (components/Rosette + StarBand, arch.ts geometry, ceremony.ts state machine, hadith.ts collection)
  packages/agent/            — Shared bot logic: LLM runner, 22 MCP tools, prompts, api-client, session, media
  apps/api/                  — SvelteKit API + Drizzle ORM + Prayer engine
  apps/tv/                   — SvelteKit static, display-only (kiosk/TV)
  apps/consumer/              — SvelteKit static/SPA, PWA (user-facing)
  apps/admin/                — SvelteKit static/SPA, admin dashboard (settings + AI bot chat)
  workers/push/              — Cloudflare Worker for push notifications (skeleton)
  workers/whatsapp/          — Cloudflare Worker for WhatsApp Zero-UI (imports bot logic from @masjid/agent)
  workers/gateway/           — SPA router source (shipped as _worker.js in the merged Pages deploy; see docs/unified-deploy.md)
  apps/api/src/lib/server/maktab/ — Maktab registration/enrollment module (Square only)
  tooling/seed.ts            — DB seed script
  vitest.config.ts           — Root vitest (API only, node)
  vitest.tv.config.ts        — TV vitest (jsdom, svelte plugin)
  vitest.consumer.config.ts   — Consumer vitest (jsdom, svelte plugin)
  vitest.agent.config.ts     — Agent vitest (node)
```

## Key architectural decisions
- **Local dev DB**: `better-sqlite3` at repo-root `.masjid/local.db`, NOT the wrangler D1 miniflare DB
- **`getDb()`** resolves DB path from `import.meta.dirname` → `apps/api/.masjid/local.db` in dev, D1 binding in production
- **API proxy**: Both TV and consumer have Vite proxy configs: `/api` → `localhost:5173`
- **SvelteKit fetch**: Load functions must use `event.fetch` for SSR, not `globalThis.fetch`. The `api.ts` in both apps accepts an optional `customFetch` parameter for this.
- **Svelte 5 runes**: All components use `$props()`, `$state`, `$derived`, `$effect`. No Svelte 4 syntax.
- **Tailwind v4**: Used in consumer app only (via `@tailwindcss/vite` plugin, CSS-first config, `@theme` block in `app.css`). TV app uses hand-written CSS (~300 lines, 6 KB gzipped) — Tailwind v4 was removed because it failed to output CSS in the static build.
- **Svelte `class:` directive bug**: Svelte 5 parser chokes on `class:` with Tailwind classes containing `/` (e.g., `class:bg-gray-900/80`). Must use inline `{cond ? 'class' : 'class'}` instead.
- **Admin routes**: Moved under `admin/masjids/[id]/...` to avoid route conflict with public `masjids/[slug]`.
- **Board endpoint**: `GET /api/v1/masjids/{slug}/board` returns today + 7 upcoming days of prayer times, theme, jumuah, and announcements in a single request. The TV frontend uses this instead of 8 separate API calls.

## Consumer service worker — REMOVED (2026-08)

The consumer app **no longer registers a service worker** (caching had already
been disabled; push was never wired up; a root-scope SW controls all 3 apps on
the unified origin — too much blast radius for zero benefit). PWA
installability is unaffected (manifest + HTTPS suffice). Full story + re-add
checklist: `docs/consumer-service-worker.md`.

What remains, **permanently**:

- **Suicide worker** (`apps/consumer/static/sw.js`): purges all CacheStorage
  caches and unregisters itself on activate; no fetch handler. Served
  `no-store`, so old installs self-heal on their next visit. Never delete it.
- **`/sw-kill` recovery hatch**: served by the **gateway worker** before SPA
  routing (one canonical URL for all 3 apps — app-shell kill scripts were
  unreachable in prod since `/sw-kill` always routed to the consumer shell).
  Unregisters all SWs, purges caches, redirects to `/`. Permanent
  infrastructure.

Caching is HTTP-only now, configured in ONE place (`tooling/merge-pages.js` →
`.merged/_headers` + gateway code): `/_app/immutable/*` immutable; SPA
fallbacks + `/sw.js` + direct `/__*_spa.html` hits no-store; unversioned root
statics (`/manifest.json`, `/icon-*.png`) `max-age=3600`; **asset-like misses
get a real 404 + no-store from the gateway** (serving SPA HTML for a missing
chunk made browsers parse markup as JS). Per-app `static/_headers` files are
non-canonical (consumer/TV keep security headers only; admin's was deleted —
its `/*.js`/`/*.json` immutable patterns were a standalone-deploy footgun).

### Theme & display settings (extensible, per-masjid)
- **`@masjid/ui-utils`**: Shared `presetTokens` and `applyTheme(theme)` used by both consumer and TV. Also hosts the shared Mishkaat modules: `components/Rosette.svelte` + `components/StarBand.svelte` (subpath exports `@masjid/ui-utils/components/*`), `arch.ts` (canonical mihrab geometry), `ceremony.ts` (`computeCeremony`, `getAmbientPhase`, Hijri helpers — TV re-exports via `$lib/ceremony`), `hadith.ts` (collection + `hadithTagsForContext`).
- **Mishkaat consumer adaptation (§7.11)**: `style_system` flows through the page payload; pages branch via `resolveStyleSystem(theme)`. Hero mihrab niche (`HeroNiche`), header star band + rosette glyph, `HadithCard`, Jumu'ah pinned Thu–Fri, adhaan/iqaamah hero moments, ambient background via `src/lib/ambient.ts` (`data-ambient-phase` on the app root), `rosetteMarker` on the prayer table's current row. All Mishkaat CSS keys off `html[data-style-system='mishkaat']` or renders only under the branch.
- **`src/lib/theme/context.svelte.ts`**: Thin re-export of `applyTheme` from `@masjid/ui-utils` for consumer-specific import paths.
- **`layout_preset` field** in `masjid_themes` table switches presets. Al-Noor seeds to `'mishkaat'` (Mishkaat style system); Al-Jabal seeds to `'minimal-light'` (Sakeenah). Unknown values fall through to the style system's default preset.
- **`masjid_themes` also stores display vocabulary**: `time_format` (`12h`/`24h`) and custom labels for `adhaan`, `iqaamah`, `jumuah`, `sunrise`, and each prayer name (`fajr`, `dhuhr`, `asr`, `maghrib`, `isha`). These flow through the public API and are consumed by `PrayerTable` and the weekly prayer view.
- **CSS custom properties** (16 total):
  - `--color-primary`, `--color-accent`, `--color-primary-light`, `--color-accent-light` — set by theme
  - `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-text-dim` — set by preset
  - `--color-border`, `--color-border-hover` — set by preset
  - `--font-heading`, `--font-body` — set by theme
  - `--safe-bottom`, `--radius-card`, `--radius-btn` — layout
- **Tailwind v4 `@theme`** in `app.css` maps `--color-primary: var(--color-primary)` etc. so `bg-primary`, `text-accent`, `font-heading` are valid Tailwind utilities.
- **No prop-drilled colors**: PrayerTable, AnnouncementCard, DonateButton all read colors from CSS custom properties directly. No `accentColor` prop.
- **Fonts loaded** in `app.html`: Inter, Roboto, Amiri, Noto Naskh Arabic, Scheherazade New — all with `display=swap`.
- **Roboto stays in the font stack** because it is the `font_body` column default (schema + Zod), even though both seed masjids now set explicit body fonts (Al-Noor: Inter, Al-Jabal: Noto Naskh Arabic).

### Component library (`src/lib/components/`)
| Component | Purpose |
|---|---|
| `PrayerTable` | Classic homepage timetable (one row per prayer, adhaan/iqaamah columns, dimmed sunrise row, current-row highlight + chip, right-after-adhaan collapse, dual-Asr note, `rosetteMarker` prop for the Mishkaat current-prayer rosette) |
| `WeeklyPrayerTable` | Times-tab week timetable (days × prayers, iqaamah over adhaan per cell, today row + chip, cross-week change accents vs dim, styled legend, dual-Asr note) |
| `HeroNiche` | Mishkaat hero: canonical mihrab arch + apex rosette framing the countdown (§7.11) |
| `HadithCard` | Mishkaat Hadith of the Day (Arabic RTL + English + source, rosette-flanked heading) |
| `AnnouncementCard` | Expandable announcement (title, date, compiled_html, pin badge) |
| `DonateButton` | External donation link CTA (heart + external link icons) |
| `LoadingSpinner` | Centered spinning loader |
| `ErrorState` | Error message card with warning icon |
| `EmptyState` | Empty state card with icon, title, and message |

### Pages (under `/[masjid_slug]/`)
| Route | Description |
|---|---|
| `+layout.svelte` | Shell: sticky header, top nav on desktop/bottom nav on mobile (Home | Prayer | News | Info | Maktab), theme application, nav transitions |
| `+layout.ts` | Load function — fetches page payload, returns masjid/theme/prayer_times/jumuah/announcements |
| `+page.svelte` | Home: hero + countdown, prayer times table, jumuah today, pinned announcement, donate CTA |
| `+error.svelte` | Error boundary fallback |
| `prayer/+page.svelte` | Weekly prayer times viewer (prev/next week navigation, `WeeklyPrayerTable`) |
| `jumuah/+page.svelte` | Jumu'ah sessions list with session cards (sessions now also show on homepage; location shown once when shared) |
| `announcements/+page.svelte` | Announcements feed |
| `donate/+page.svelte` | Donation page with CTA and "Why Give" section |
| `info/+page.svelte` | Masjid contact info, address, and social links |
| `maktab/+page.svelte` | Minimal term/pricing card with **Enroll Now** CTA |
| `maktab/enroll/+page.svelte` | Square Web Payments SDK enrollment form (parent, address, children, card) |

### Other known items
- **The `minimal-light` preset exists** but has no light-mode `.glass`/`.glass-card` equivalents — would need light variants for a true light theme.
- **Only 1 admin per masjid** — the `admins` table has a UNIQUE FK on `masjid_id`.
- **No admin UI exists** — all data management is via API only. This is intentional (Zero-UI ingestion path).
- **TV frontend shares theming with consumer** — both use `@masjid/ui-utils` for preset tokens and `applyTheme()`. All 15 theme fields (including `time_format` and `label_*`) are used.
- **The `+error.svelte` page is basic** — shows a generic error message. Could be improved.

## TV frontend architecture

The TV display is a static SvelteKit kiosk for prayer hall TVs. Full design doc: `docs/tv-display.md`.

### Component library (`src/lib/components/`)
| Component | Purpose |
|---|---|
| `AnalogClock` | SVG clock; `classic` prop renders the Mishkaat face (deep face, gold hands, 60 clean ticks) |
| `PrayerBoard` | 6-column CSS grid table (label + 5 prayers) with adhaan/iqamah/sunrise rows, current prayer highlight, sharp flash pulse, optional rosette current-prayer marker; Mishkaat also rolls upcoming iqaamah changes through the board on a 45s/15s cycle (see `board-cycle.ts`) |
| `Countdown` | Compact `<span>` showing "6h 07m" or "04:32" until next iqaamah |
| `JumuahNotice` | One-liner: `* Jumu'ah: 1:30 PM (Eng) · 2:30 PM (Arb)` |
| `AnnouncementBanner` | Marquee banner at page bottom (Sakeenah only — Mishkaat demotes announcements to frames, §7.5 motion budget) |
| `Rosette` | Eight-point star identity glyph (§7.3) |
| `HoneycombFrame` | Honeycomb hairline border SVG (opt-in motif). Band must be ≥ one tiling row — narrower renders as clipped "notches" |
| `StarBandFrame` | Default motif: eight-point stars + interlocking octagons band (§7.3), bracketed by the panel border + an inset hairline rule |
| `ArchCrest` | Mihrab arch + apex rosette; one arch per screen (§7.3) — rendered as a **niche around the clock** (`.tv-clock-niche`), height-bounded via `clamp(310px, 41vh, 450px)` (claims a larger share of the column in compact/windowed mode, never dropped); the wide 140×150 viewBox lets the arch encapsulate the clock + sunrise + countdown (`.tv-niche-body`), one integrated unit. No digital time inside the niche — the analog clock already carries it |
| `SoulColumn` | Frame rotation host — one visible frame, 20s cadence, rightward slide, reduced-motion static (§7.5) |
| `HadithFrame` / `JumuahFrame` / `AnnouncementFrame` / `DonateFrame` / `QrFrame` | Soul-column frames (§7.5); donate is two separate slides — appeal text (`DonateFrame`) then scan-to-give QR (`QrFrame`, via `qrcode` package SVG). Schedule changes are NOT a frame — they roll through the prayer board |
| `CeremonyOverlay` | Full-screen ceremony states: adhaan → iqaamah countdown → prayer in progress → quiet (§7.6); night calm is a page-level 20% veil (`.tv-night-veil`), not an overlay — the board stays readable |

### Key libraries (`src/lib/`)
| Module | Purpose |
|---|---|
| `server-clock.ts` | Server-time sync (§7.7): offset-corrects the TV clock against board `server_time` |
| `frames.ts` | Frame list builder (priority order, pinned Jumu'ah Thu–Fri, empty suppression) + rotation math + hadith occasion tags |
| `board-cycle.ts` | Prayer-board roll cycle (§7.5): 45s times / 15s changes, wall-clock anchored; per-row roll (today's iqaamah slides into the adhaan column, new iqaamah rises in gold, date under the label; headers roll too — ADHAAN→IQAAMAH, IQAAMAH→NEW IQAAMAH); holdoff from adhaan → iqaamah+5min; reduced-motion pins to today's times. Pure, fully unit-tested |
| `ceremony.ts` | Ceremony state machine (§7.6) + ambient palette phases (§7.4) + Hijri helpers — pure, fully unit-tested |

### Mishkaat implementation notes
- **Style systems**: `masjid_themes.style_system` ('sakeenah' default, 'mishkaat' flagship) + `style_options` JSON column (metal/motif/arch/numerals/density/ambient/quietHours/frames/emblem/donateAppeal; unknown keys ignored, missing keys → defaults). Synced across `schema.sql`, Drizzle schema, and `ensureTables`/`addColumnIfMissing`.
- **`applyTheme` / `buildThemeVars`** (ui-utils) branch per style system and set `data-style-system` on `<html>`; all Mishkaat CSS keys off that attribute. Metal palettes recolor accents (gold default); stock Sakeenah colors (`#1e3a8a`/`#10b981`) are treated as unset under Mishkaat; explicit custom colors are raw overrides on top of metal (§7.4). Amiri is the display default unless `font_heading` was explicitly changed from Inter (§7.2).
- **New registrations default to Mishkaat** (gold + `layout_preset='mishkaat'` + Amiri headings). **Al-Noor seeds to Mishkaat; Al-Jabal stays Sakeenah** — one seed masjid per style system.
- **Hadith collection**: `packages/ui-utils/src/hadith.ts` — 24 curated entries (Arabic + English + canonical source), date-seeded daily rotation, occasion tags (jumu'ah/ramadan/fajr/prayer) for context seeding.
- **Rotation bug to remember**: the soul column drives rotation by wall-clock elapsed time (`getActiveFrameIndex`), not a frame-index interval — `framesList` recomputes every second upstream, so an effect watching it resets its own timer.
- **jsdom/WAAPI**: TV test setup polyfills `Element.prototype.animate` (Svelte 5 transitions need it; the stub fires `onfinish` via microtask).
- **Register route**: `db.batch()` is D1-only; local dev falls back to a better-sqlite3 synchronous transaction (pre-existing local-dev bug fixed 2026-07-29).

### Key design decisions
- **No Tailwind** — replaced with ~300 lines of hand-written CSS in `app.css`. Tailwind v4 failed to emit CSS in the static build.
- **Synced theming** — TV now shares theme preset tokens and `applyTheme()` with the consumer frontend via `@masjid/ui-utils`, so both apps honor `layout_preset` (`glass-dark`, `minimal-light`).
- **Single API call** — `fetchBoardPayload()` hits the `/board` endpoint which returns today + 7 upcoming days in one response. No client-side waterfall.
- **Board payload includes `state`** — the masjid block now exposes `state` so the header can render `City, ST` instead of a hardcoded `, IL`.
- **Current prayer highlight** — highlights the prayer whose time window we're in. Fajr window ends at sunrise (not Dhuhr iqaamah).
- **Flash signal** — CSS pulse animation on cells when `now` matches an adhaan/iqaamah minute. Replaces the old countdown-centric approach.
- **Upcoming changes** — uses the shared `findNearestIqaamahChanges()` helper, capped to the nearest change per prayer (max 5 entries) from the board payload.
- **Continuous marquee** — announcement banner uses two duplicated items, each `100vw` wide, for a smooth infinite scroll on older TVs.
- **Non-blocking fonts** — Google Fonts loaded with `media="print" onload="this.media='all'"`, `<noscript>` fallback.
- **`formatTime()` utility** — copied from consumer (`src/lib/time.ts`), handles 12h/24h from admin config.

## Naming & design language (canonical — see docs/design-language.md)
- **Mihraab** = the platform (mihraab.pro). **Sakeenah** = the minimal style system (`glass-dark`, `minimal-light`). **Mishkaat** = the flagship style system (soul-forward: RTL layout, frames, ceremony states, ambient palette — **Phases 0–3 shipped 2026-07-29**; Phase 4 admin UI/logo engraving pending).
- Terminology: **style system** (`style_system` column) → **preset** (`layout_preset`) → **theme options** (`style_options` JSON). Don't say "theme engine".
- Admin UI uses plain-English labels only ("Screen Appearance", "Hadith of the Day", "Quiet Hours"); code identifiers stay plain English too.
- Reserved preset names: `manara` (portrait), `mashrabiya` (pattern), `qandeel` (seasonal). Never name anything `sakina` or `mihrab`.

## Design documents (always useful)
- `Background.md` — original vision/spec
- **`docs/design-language.md` — CANONICAL naming + Sakeenah/Mishkaat style-system spec (read before any UI work)**
- `schema.sql` — complete D1 schema (9 tables + indexes)
- `docs/api.md` — API route reference (including board endpoint)
- `docs/tv-display.md` — TV display architecture & design decisions
- `docs/rules-engine.md` — prayer rules engine spec
- `docs/mcp-integration.md` — MCP/Zod strategy
- `docs/zero-ui.md` — Native MCP / Agentic config setup for admins strategy
- `docs/whatsapp-zero-ui.md` — Implementation plan + architecture for WhatsApp worker
- `docs/bot-abstraction.md` — How to extract core agent logic from WhatsApp worker into `@masjid/agent`
- `docs/admin-manual-settings.md` — Admin microservice manual settings UI (profile, theme, prayer rules, jumu'ah, announcements, domains, snapshots, account)
- `docs/admin-ai-capabilities.md` — Admin AI bot chat panel design (DiffReceiptCard, vision, SSE streaming)
- `docs/admin-tests.md` — Admin app test strategy (~202 tests: unit + integration + E2E)
- **`docs/unified-deploy.md` — Unified deployment (all apps on masjid-live.pages.dev via Pages advanced mode), merge pipeline, deploy/verify runbook, cutover plan (read before any deploy work)**
- **`docs/integration-testing.md` — Browser E2E smoke-test spec: staging environment (masjid-staging.pages.dev + mapi-staging worker + masjid-db-staging), staging branch flow, test catalog, swarm work packages (read before any E2E/deploy work)**
- **`docs/integration-test-cases.md` — Enumerated E2E test-case catalog + swarm work order (exact steps/assertions per case; statuses)**

## WhatsApp Zero-UI worker (`workers/whatsapp/`)

> **NOT DEPLOYED (2026-08-06)**: WhatsApp/push workers are disabled until launch and have never been deployed (the account runs `mapi` + `mapi-staging` only). The prod deploy matrix in `deploy.yml` skips them — their entries are commented out with re-add instructions (no-op `build` scripts already in place; wrangler compiles TS at deploy time, no build step needed). `wrangler.toml` carries `global_fetch_strictly_public` so its calls to `mapi`'s public URL won't hit CF error 1042 when re-enabled (lesson 54).

Stages 1-3 are complete. The worker handles Meta webhook verification, inbound message parsing,
phone-to-tenant resolution, branch lifecycle (OPEN/MERGED/ABANDONED), media file handling,
and LLM-powered configuration via OpenAI-compatible API.

### Architecture
- Worker receives WhatsApp webhooks from Meta, resolves tenant by `admins.whatsapp_phone`
- All admin mutations are staged in `config_branches` → `config_mutations` (git-style branches)
- Worker calls the *existing* SvelteKit admin API via JWT proxy (no business logic duplication)
- Stage 3: LLM agent interprets messages, calls 20 MCP-style tools (theme, profile, prayer rules, jumu'ah, announcements), stores mutations, presents diff receipt, confirms on `/confirm`
- Stage 4 (completed): Vision LLM for timetable photos, time-travel rollback, RTL handling

### Agent module (`src/agent/`)
| File | Purpose |
|------|---------|
| `tools.ts` | Thin re-export from `@masjid/agent` |
| `prompt.ts` | Thin wrapper converting `Env` → `BotContext`, delegates to `@masjid/agent` |
| `runner.ts` | Wrapper converting `Env` → `BotContext`, formats structured diff receipt as WhatsApp markdown |
| `format.ts` | WhatsApp markdown renderer on top of `@masjid/agent` structured diff data |

### Agent tools (22 total)
| Domain | Tools |
|--------|-------|
| THEME | `theme_get`, `theme_update` |
| PROFILE | `profile_get`, `profile_update`, `prayer_config_get`, `prayer_config_update` |
| PRAYER_RULES | `prayer_rules_list`, `prayer_rules_create`, `prayer_rules_update`, `prayer_rules_delete`, `prayer_rules_reorder` |
| JUMUAH | `jumuah_list`, `jumuah_create`, `jumuah_update`, `jumuah_delete` |
| ANNOUNCEMENTS | `announcements_list`, `announcements_create`, `announcements_update`, `announcements_delete`, `announcements_pin` |

### LLM configuration
Uses OpenAI-compatible chat completions API. Configurable via env vars:
- `LLM_API_URL` — defaults to `https://openrouter.ai/api/v1` (can use OpenAI, Groq, etc.)
- `LLM_API_KEY` — required; if not set, falls back to text-only acknowledgment mode
- `LLM_MODEL` — defaults to `google/gemma-4-31b-it`

### Agent flow
1. User sends WhatsApp message (e.g. "Make Dhuhr iqaamah 10 min after adhaan, Fridays at 1:30 PM")
2. Agent fetches current masjid state via read tools
3. LLM with system prompt + tool definitions returns function calls
4. Tool handlers execute via JWT proxy to admin API (changes go live immediately)
5. Mutations stored in `config_mutations` with sequence ordering
6. Diff receipt formatted and sent to user via WhatsApp
7. User types `/confirm` → snapshot created, branch transitions to MERGED
8. User types `/cancel` → branch transitions to ABANDONED

### New DB tables (5 new + 1 column)
- `config_branches` — staging branches (OPEN/MERGED/ABANDONED)
- `config_mutations` — granular mutation entries per branch
- `config_snapshots` — point-in-time frozen state for rollback
- `masjid_assets` — multimodal file map (images, documents from WhatsApp)
- `announcement_attachments` — join between announcements and assets
- `admins.whatsapp_phone` — E.164 phone number for WhatsApp auth

### Environment variables (wrangler.toml)
| Binding | Purpose |
|---------|---------|
| DB | D1 database (shared with API) |
| ASSETS | R2 bucket for media uploads |
| WHATSAPP_TOKEN | Meta Cloud API access token |
| WHATSAPP_PHONE_ID | WhatsApp Business phone number ID |
| WHATSAPP_VERIFY_TOKEN | Webhook verification token |
| API_URL | SvelteKit API base URL |
| JWT_SECRET | Same secret as the API (for signing JWTs) |

## @masjid/agent package (`packages/agent/`)
The core bot logic extracted from WhatsApp worker. Used by both WhatsApp worker and admin app.

### Exports
| Module | Purpose |
|--------|---------|
| `getToolDefinitions()` | 22 MCP tool definitions (theme, profile, prayer rules, jumu'ah, announcements, vision, rollback) |
| `runAgent()` | LLM agent loop: send message → call LLM → execute tool calls → repeat → return structured `AgentResult` |
| `runVisionAgent()` | Vision LLM agent for timetable photo extraction |
| `buildSystemPrompt()` | System prompt builder with domain guides and examples |
| `buildVisionPrompt()` | Vision-specific system prompt for timetable extraction |
| `buildDiffReceipt()` | Returns structured `DiffReceipt` data (not rendered) |
| `api-client.ts` | 18 JWT-authenticated API proxy functions — all responses validated via `apiJson()` (ok-check + JSON parse guard); optional `fetcher` injection (SvelteKit `event.fetch`) avoids CF error 1042 on same-zone calls — see lesson 54 |
| `session.ts` | Branch/mutation/snapshot lifecycle (no tenant resolution) |
| `media.ts` | `bufferToDataUri`, `uploadToR2`, `registerAsset` |

### Key types
- `BotContext` — unified context: `{ adminId, masjidId, branchId, db, apiUrl, jwtSecret, llmConfig, assets? }`
- `AgentResult` — `{ textResponse, diffReceipt }` where diffReceipt is structured `DiffReceipt`
- `ToolDefinition`, `ToolResult`, `LLMMessage`, `LLMContentPart`

## Admin app (`apps/admin/`)
SvelteKit static SPA on port 5176. Admin dashboard for manual settings and AI bot chat.

### Routes
| Route | Description |
|-------|-------------|
| `/login` | Admin login (email + password) |
| `/admin/[slug]` | Dashboard (stats, status, quick actions) |
| `/admin/[slug]/settings/profile` | Masjid profile (18 fields) |
| `/admin/[slug]/settings/theme` | Theme settings (presets, colors, fonts, labels) |
| `/admin/[slug]/settings/prayer` | Prayer rules table + dry-run simulator |
| `/admin/[slug]/settings/jumuah` | Jumu'ah sessions management |
| `/admin/[slug]/settings/maktab` | Maktab term/pricing management + registrations |
| `/admin/[slug]/settings/announcements` | Announcements with markdown editor |
| `/admin/[slug]/settings/posts` | Posts with markdown editor + homepage/info pins |
| `/admin/[slug]/settings/navigation` | Nav items (add/reorder built-in routes, custom pages, external links; desktop/mobile toggles) |
| `/admin/[slug]/settings/domain` | Custom domain management |
| `/admin/[slug]/settings/snapshots` | Configuration snapshots + rollback |
| `/admin/[slug]/settings/account` | Password change |
| `/admin/[slug]/bot` | AI bot chat panel |

### Key components
| Component | Purpose |
|-----------|---------|
| `AdminShell` | Navigation shell (desktop sidebar + mobile hamburger) |
| `BotChat` | Full chat interface with messages, thinking indicator, diff receipts |
| `ChatInput` | Textarea input with auto-resize, file upload, send |
| `DiffReceiptCard` | Structured diff card with domain-color badges, action icons |
| `ErrorCard` | Error display with retry button |
| `ConfirmDialog` | Modal confirmation with backdrop |
| `SkeletonForm` | Loading placeholder |

### Architecture
- **Auth**: `auth.svelte.ts` rune store manages JWT login/logout, localStorage persistence
- **API client**: `api.ts` wraps Maktab endpoints plus admin API calls, auto-attaches JWT, handles 401 → logout
- **All LLM calls go through the API server** — the project's single API key is used server-side
- **Tailwind v4** CSS-first config in `app.css`
- **svelte-sonner** for toast notifications, **lucide-svelte** for icons
- **No service worker** — browser cache is sufficient. There is no `navigator.serviceWorker.register()` call and no `static/sw.js`; the admin app does not currently need offline support or push notifications. A stale SW-like poisoning risk from the catch-all `Cache-Control` header in `static/_headers` was fixed (see `docs/admin-cache-poisoning.md`); the admin `_headers` file was later deleted (2026-08) because canonical headers live in `tooling/merge-pages.js`. Recovery uses the origin-wide `/sw-kill` gateway route.

## Maktab Registration (`apps/api`)

Maktab enrollment lives inside the main `@masjid/api` monolith, using the same D1/SQLite database as the rest of the platform.

### State
- **671 API tests** total; 67 of those cover Maktab (public info, auth, validation, admin CRUD, Square enrollment, term activation, registrations, and helper units for Square/email/money/schemas).
- **Enrollment form errors (2026-08-10)**: client validation lives in `apps/consumer/src/lib/maktab-validation.ts` (pure, unit-tested) and mirrors `SquareEnrollmentSchema` — keep the two in sync when rules change. The enroll page shows a `role="alert"` summary panel at the top on submit (scrolled into view + focused) plus per-field inline errors with `aria-invalid`; inline errors also appear on blur pre-submit (the summary panel stays submit-only) and clear on input. Required fields carry accent asterisks + `aria-required`; server Zod failures return readable sentences, not the raw Zod JSON blob.
- **Square is the only payment provider**; Stripe support was removed because account verification could not be completed in time.
- **No migration from `suffah-old`** — only new enrollments are tracked.
- **Embed mode** for the enrollment form: `?embed=1` (or `?embed=true`) hides the consumer header and bottom navigation so the form can be dropped into an existing masjid website via iframe.
- **Local dev secrets** live in `apps/api/.dev.vars` — this file is gitignored and loaded by Wrangler-style dev setups (and merged into `process.env` by the Maktab API routes for `vite dev`).

### D1 tables
| Table | Purpose |
|---|---|
| `mkt_terms` | Program terms with 3-tier pricing (1 / 2 / 3+ children) and Square plan IDs |
| `mkt_settings` | Active term pointer + enrollment open/closed flag per masjid |
| `mkt_registrations` | Enrollment records linked to Square subscriptions |
| `mkt_outbox` | Available for future retry-able email queue; currently unused |

### Environment variables (configured where `@masjid/api` is deployed)
| Var/Secret | Purpose |
|---|---|
| `SQUARE_ACCESS_TOKEN` + `SQUARE_APP_ID` + `SQUARE_LOCATION_ID` | Square subscriptions + cards |
| `BREVO_API_KEY` | Transactional email |
| `SENDER_EMAIL` / `SENDER_NAME` / `FORWARD_TO_EMAIL` / `LOGGING_EMAIL` / `BOT_NAME` | Email headers/addresses |

### Endpoints
All routes are part of the main API; no Vite proxy or separate worker is needed.

| Path | Auth | Purpose |
|---|---|---|
| `GET /api/v1/masjids/:slug/maktab` | Public | Active term, prices, open/closed status, Square app/location IDs |
| `POST /api/v1/masjids/:slug/maktab/enroll` | Public | Create Square customer/card/subscription and register enrollment |
| `GET/PUT /api/v1/admin/masjids/:id/maktab/settings` | JWT | Enrollment switch + active term |
| `GET/POST /api/v1/admin/masjids/:id/maktab/terms` | JWT | Term CRUD; creates Square subscription plan |
| `POST /api/v1/admin/masjids/:id/maktab/terms/:termId/activate` | JWT | Make term active |
| `GET /api/v1/admin/masjids/:id/maktab/registrations` | JWT | List registrations |

### How to test
```bash
npm run test
```

## Quick dev tips
- DB goes missing? Re-run `npx tsx tooling/seed.ts`
- Consumer page returning 500? API might be down or DB empty — check `curl http://localhost:5173/api/v1/masjids/masjid-al-noor`
- Frontend tests fail? Make sure `conditions: ['browser']` is in the vitest config — this is required for `@testing-library/svelte` to work with Svelte 5
- Need to inspect the running page? `curl http://localhost:5175/masjid-al-noor` gives the SSR output
- The CSS is served at `http://localhost:5175/src/app.css` — contains the full compiled Tailwind v4 output
- To start admin: `npm run dev --workspace=@masjid/admin` (port 5176)
- To see the Mishkaat TV board locally: start API + TV and open `http://localhost:5174/display/masjid-al-noor` (Al-Noor seeds to Mishkaat; Al-Jabal shows Sakeenah). Ceremony states to watch: adhaan/iqaamah-countdown at each prayer, night calm ~90 min after Isha iqaamah (20% veil, times stay readable)
- Maktab form embed URL: `http://localhost:5175/masjid-al-noor/maktab/enroll?embed=1`
- Maktab dev secrets (Square/Brevo) go in `apps/api/.dev.vars`; put real values there for live sandbox testing
- Debug endpoint: `GET /api/v1/debug` — public, no auth; returns DB connectivity, bcrypt test, admin info
- Status endpoint: `GET /api/v1/status` — public, no auth; returns worker health, env vars presence, D1 connectivity

## Multi-agent parallel work (worktrees)

Rules from the 2026-07-29 incident: maktab-export feature files were copied
into the main tree as uncommitted changes and got committed to master by
another agent working there. The branch was never merged — the content
arrived via a stray direct commit. Don't let that happen again.

1. **One agent per worktree, one branch per agent.**
   ```bash
   git worktree add ../masjid-<feature> -b <feature> master
   ```
   Tell each agent its worktree path and instruct it to NEVER read or write
   outside that directory.
2. **The main tree (`~/code/masjid`) is single-tenant.** Only one effort at
   a time. Never copy files between trees — integrate by merging the branch
   (`git merge <feature>`), not by duplicating content.
3. **Commit hygiene (every agent, every commit):** run `git status` and
   `git branch --show-current` first; stage files by explicit name (never
   `git add -A` in a tree anyone else might touch); verify with
   `git show --stat HEAD` after committing.
4. **Per-worktree setup:** each worktree needs its own `npm install` and its
   own dev DB (`npx tsx tooling/seed.ts` — `.masjid/local.db` resolves
   per-worktree).
5. **Ports are shared.** Dev servers bind fixed ports (API 5173, TV 5174,
   consumer 5175, admin 5176) — only ONE agent may run dev servers at a
   time. Other agents use `npm run test*` (no servers needed).
6. **Only the main tree deploys.** Feature agents never run wrangler or
    otherwise deploy. Deploys follow the branching model: merge to staging
    (auto-deploy + E2E), then manually trigger `Deploy to Cloudflare` from
    the Actions tab when staging is green.
7. **Keep branches short-lived** and rebase onto master before merging
    (`git rebase master`) so conflicts surface in the branch, not on master.
- Production status: `curl https://mapi.mr-thack.workers.dev/api/v1/status`
- Term `billing_months` column exists on `mkt_terms` — set it to charge fewer months than the term length (e.g. 8 for a 9-month Ramadan term)

## Production deployment lessons (2026-07-25)

This section documents every pitfall encountered during the first production deployment to Cloudflare
Workers + Pages. These are **hard-earned** — avoid repeating them.

### 1. `nodejs_compat` polyfills `process` globally

**Pitfall**: The `nodejs_compat` compatibility flag provides a `process` global in Workers.
This means `typeof process !== 'undefined'` returns `true` in Cloudflare Workers, making it
**unreliable** as a Node.js-vs-Worker detection mechanism.

**How we fixed it**: Use `typeof caches !== 'undefined' && typeof caches.default !== 'undefined'`
to detect the Worker runtime instead. The `caches` global with a `.default` property is specific
to Cloudflare Workers.

**Files affected**: `apps/api/src/lib/server/db/index.ts` (`getDb()`), three Maktab route
files that used `typeof process !== 'undefined' && process.env`.

### 2. `import.meta.dirname` is `undefined` in Workers

**Pitfall**: Cloudflare Workers don't have a filesystem, so `import.meta.dirname` is `undefined`.
Any code that does `path.resolve(import.meta.dirname, ...)` crashes with "The 'paths[0]' argument
must be of type string."

**How we fixed it**: Guard with `typeof import.meta.dirname !== 'undefined'` and fall back to
a dummy path (`'/dummy'`). The guarded code only executes in local Node.js dev.

**Files affected**: `apps/api/src/lib/server/db/index.ts` (`PROJECT_ROOT` constant).

### 3. Native modules (better-sqlite3) cannot be bundled into Workers

**Pitfall**: `better-sqlite3` is a native C++ addon. It cannot run in Workers even with
`nodejs_compat`. Static imports at the top of a file execute at module init time, crashing
the Worker even if the import is never used (because the code path that uses it is never
reached in production).

**How we fixed it**: Created a Vite plugin (`apps/api/vite.config.ts`) that stubs
`better-sqlite3` and `drizzle-orm/better-sqlite3` during `vite build` (not `vite dev`).
The plugin intercepts `resolveId` and returns virtual empty modules during build mode only.

**Files affected**: `apps/api/vite.config.ts` (the `stubNativeModules` plugin).

**Alternative that would also work**: Move all local-dev DB code into a separate file and
do a dynamic `await import('./local')` inside `getDb()` — the import only executes when
`getLocalDb()` is called, which never happens in production.

### 4. Square API uses snake_case everywhere

**Pitfall**: The Square REST API uses **snake_case** for ALL field names in both requests
and responses. The code had camelCase everywhere: `catalogObject`, `subscriptionPlanData`,
`idempotencyKey`, `recurringPriceMoney`, `priceMoney`, etc. Every single one was wrong.

**How we fixed it**: Converted every field in `square.ts` to snake_case:
- Requests: `idempotency_key`, `subscription_plan_data`, `subscription_plan_variations`,
  `subscription_plan_variation_data`, `recurring_price_money` → `pricing.price_money`,
  `given_name`, `email_address`, `phone_number`, `address_line_1`, `source_id`,
  `cardholder_name`, `billing_address`, `customer_id`, `location_id`,
  `plan_variation_id`, `start_date`, `card_id`
- Responses: `catalog_object`, `subscription_plan_data`,
  `subscription_plan_variations`, `subscription_plan_variation_data`

**Key lesson**: The unit tests mocked Square responses with camelCase to match the code.
When the code was "fixed" to snake_case, the tests still passed because both the mock
AND the code were wrong in the same way. Always verify mocks against the actual API spec.

**Files affected**: `apps/api/src/lib/server/maktab/square.ts`

### 5. Square API version matters

**Pitfall**: We were on Square-Version `2024-08-21` (2 years old). The latest is
`2026-07-15`. Older versions have different field requirements — e.g., `2024-08-21`
requires `pricing.price_money` instead of `recurring_price_money` for phase pricing.

**How we fixed it**: Bumped to `2026-07-15`. Keep the `Square-Version` header
up-to-date; check the Square docs changelog periodically.

### 6. Wrangler v4 requires explicit `--var` flags

**Pitfall**: Wrangler v3 auto-overrode `[vars]` values from OS environment variables.
Wrangler v4 **removed** this behavior. You must pass `--var NAME:VALUE` explicitly
for each variable you want to override at deploy time.

**How we fixed it**: The GitHub Actions workflow builds a bash array of `--var` flags
from non-empty environment variables:

```bash
VAR_ARGS=()
[ -n "$JWT_SECRET" ] && VAR_ARGS+=(--var "JWT_SECRET:$JWT_SECRET")
...
npx wrangler deploy --env production "${VAR_ARGS[@]}"
```

**Files affected**: `.github/workflows/deploy.yml` (deploy-worker step)

### 7. Wrangler v4 requires `[assets]` config for Workers Static Assets

**Pitfall**: The `@sveltejs/adapter-cloudflare` output uses Workers Static Assets
(`env.ASSETS.fetch(req)`). Without the `[assets]` config in `wrangler.toml`, the
ASSETS binding is undefined and the Worker crashes with error 1101. Additionally,
`[assets]` is NOT inherited by environments — it must be repeated in
`[env.production.assets]`.

**How we fixed it**: Added to both top-level and `[env.production]`:
```toml
[assets]
binding = "ASSETS"
directory = ".svelte-kit/cloudflare"

[env.production.assets]
binding = "ASSETS"
directory = ".svelte-kit/cloudflare"
```

**Files affected**: `apps/api/wrangler.toml`

### 8. Static Pages builds need VITE_API_URL at build time

**Pitfall**: The consumer and TV apps are static SPAs (`adapter-static`). They embed
`VITE_API_URL` at **build time** via `import.meta.env.VITE_API_URL`. If not set during
`vite build`, they fall back to relative paths and fetch from their own origin — which
returns HTML (SPA fallback) instead of JSON, crashing with a parse error.

**How we fixed it**: The CI workflow passes `VITE_API_URL` as an environment variable
during the build step. For local/manual deploys:
```bash
VITE_API_URL=https://mapi.mr-thack.workers.dev npm run build
```

**Files affected**: All consumer/TV page deploys, `.github/workflows/deploy.yml`

### 9. GitHub Actions matrix `include` variables are top-level

**Pitfall**: When using `matrix: include: ${{ fromJSON(...) }}`, each include entry's
properties become top-level matrix variables: `${{ matrix.workspace }}`, NOT
`${{ matrix.include.workspace }}`.

**How we fixed it**: Changed all `matrix.include.workspace` → `matrix.workspace`,
`matrix.include.name` → `matrix.name`, `matrix.include.dir` → `matrix.dir`.

### 10. GitHub Actions heredoc outputs can break `fromJSON`

**Pitfall**: Using heredoc syntax (`<<EOF`) in `$GITHUB_OUTPUT` can add trailing
whitespace or newlines that break `fromJSON()` parsing.

**How we fixed it**: Switched to simple `echo "key=$(jq -c ...)" >> $GITHUB_OUTPUT`
for single-line JSON values. No heredoc needed for compact JSON.

### 11. GitHub Environments need `environment:` declaration

**Pitfall**: Environment-specific secrets (Prod) are NOT accessible unless the job
declares `environment: Prod`. Without it, `${{ secrets.NAME }}` resolves to
repository-level secrets (which may be empty).

**How we fixed it**: Added `environment: Prod` to both `deploy-workers` and
`deploy-pages` jobs.

### 12. Cloudflare API token naming

**Pitfall**: Mixing `CF_API_TOKEN` and `CLOUDFLARE_API_TOKEN`. Wrangler ONLY recognizes
`CLOUDFLARE_API_TOKEN` as the auth env var. Using `CF_API_TOKEN` in the workflow env
block won't work unless explicitly mapped.

**How we fixed it**: Standardized on `CLOUDFLARE_API_TOKEN` everywhere:
GitHub Secrets, `.env.prod`, and `${{ secrets.CLOUDFLARE_API_TOKEN }}` in the workflow.

### 13. Cloudflare Account API tokens cannot call `/memberships`

**Pitfall**: Account-scoped API tokens (created via "Custom token" with account
permissions) cannot call the `/memberships` endpoint — error 9106. This endpoint
requires a user identity, which Account tokens don't have.

**How we fixed it**: Set `CLOUDFLARE_ACCOUNT_ID` explicitly in the workflow env so
Wrangler doesn't need to discover it via `/memberships`.

### 14. `check-changes` CI script handles single-commit repos

**Pitfall**: The `tooling/changed-packages.js` script used `git diff HEAD^ HEAD`
which fails on repos with only one commit (no parent to diff against).

**How we fixed it**: In CI mode (`CI=true`, set automatically by GitHub Actions),
the script force-deploys everything without checking git history. For local use,
added fallbacks through `HEAD~1` → empty tree hash diff.

### 15. `db.batch()` for atomic multi-table inserts

**Pitfall**: Three separate `await db.insert()` calls are NOT atomic in D1.
If the second insert succeeds but the third fails, you get partial state
(orphaned rows). This happened with registration — masjid was created but
admin insert failed, leaving an unreachable masjid.

**How we fixed it**: Wrapped multi-table inserts in `db.batch([...])` for
atomicity. All inserts succeed together or none do.

**Files affected**: `apps/api/src/routes/api/v1/auth/register/+server.ts`

### 16. `getDb()` must check local Node.js before D1 binding

**Pitfall**: In local dev, `@sveltejs/adapter-cloudflare` provides a mock D1
binding (`platform.env.DB`). If `getDb()` checks `d1` before checking
`typeof process`, it uses the mock D1 (which points to a different SQLite DB)
instead of the project's `.masjid/local.db`. Deleting/recreating the local DB
causes "no such table" errors because the mock D1's DB wasn't reseeded.

**How we fixed it**: Moved the `isWorker` / `typeof process` check BEFORE
the `d1` check in `getDb()`. In local Node.js, always use `getLocalDb()`.

**Files affected**: `apps/api/src/lib/server/db/index.ts`

### 17. Prayer engine `verifyComputedTimes` should warn, not crash

**Pitfall**: Masjid admins can enter wrong coordinates (e.g., lat=50, lon=50 in
America/New_York). The prayer engine computes astronomically correct times for
those coordinates, but converting to the mismatched timezone produces times in
the wrong order (Fajr at 18:53, Dhuhr at 04:47). The strict order check threw
an error, crashing the entire masjid page with 500.

**How we fixed it**: Changed `throw new Error()` to `console.warn()` for order
violations. The page renders with whatever times the engine computes — the admin
sees wrong times and fixes their coordinates. Only truly invalid states
(missing prayer, right_after_adhaan misuse) still throw.

**Files affected**: `apps/api/src/lib/server/prayer/engine.ts`

### 18. `schema.sql` and Drizzle schema must stay in sync

**Pitfall**: The Drizzle ORM schema (`apps/api/src/lib/server/db/schema.ts`) had
a `label_speech` column on `masjid_themes` that was missing from `schema.sql`.
New registrations failed with "table masjid_themes has no column named
label_speech" in production (D1).

**How we fixed it**: Added `label_speech TEXT NOT NULL DEFAULT 'Speech'` to
`schema.sql` and ran `ALTER TABLE` on the production D1 database. Added
`billing_months INTEGER` at the same time for the maktab terms feature.

**Lesson**: When adding a column to the Drizzle schema, always check if
`schema.sql` needs updating too. The two schemas are maintained independently
(Drizzle for local dev via `ensureTables()`, `schema.sql` for D1 production).

### 19. Square payment plan amounts must be integers

**Pitfall**: Square's `recurring_price_money.amount` field expects a **number**
(integer in cents), not a string. The code had `String(amount)` which sent
`"10000"` instead of `10000`, causing `EXPECTED_INTEGER` errors.

**How we fixed it**: Removed the `String()` wrapper. Pass the raw number.

### 20. Maktab term creation must be atomic (Square first, then DB)

**Pitfall**: The old term creation flow inserted the term into the DB FIRST
(with empty `paymentRefsJson`), then tried to create the Square plan. If
Square failed (which it always did due to the snake_case issues), the term
was left in the DB with no Square plan — unusable, and the response still
said 201 Created.

**How we fixed it**: Square API call FIRST, DB insert only if Square succeeds.
The `paymentRefsJson` is populated from the Square response during insert.
The error from Square is returned directly to the admin. Nothing is persisted
on failure.

### 21. Debug endpoint pattern

When debugging production issues, adding a public debug endpoint (like
`/api/v1/debug`) that returns internal state is invaluable. It bypasses
auth and lets you test DB connectivity, bcrypt, etc. without deploying
code changes. Remember to add it to `PUBLIC_PATTERNS` in hooks.server.ts.

### 22. Square sandbox integration tests

Live integration tests that hit the real Square sandbox API are invaluable.
They use `cnon:card-nonce-ok` as the test card source and postal code `94103`.
Tests auto-skip when `.env.dev` doesn't have Square credentials (CI-safe).

```bash
npx vitest run apps/api/src/__tests__/maktab/square.test.ts -t sandbox
```

### 23. Cloudflare Workers Observability

Add `[observability] enabled = true` to every worker's `wrangler.toml`.
This enables Workers Logs in the Cloudflare dashboard, letting you see
`console.error()` output from production without websocket tail sessions.

## Unified deployment lessons (2026-07-29)

Full detail in `docs/unified-deploy.md`. These came from consolidating the
3 Pages projects into one unified deployment on masjid-live.pages.dev.

### 24. Pages Functions `_redirects`/subrequests cannot route multiple SPAs — use Pages advanced mode (`_worker.js`)

**Pitfall**: Two obvious approaches both failed in production:
(a) a Pages Function doing `fetch(self)` to grab the right SPA fallback →
the subrequest re-entered the same Function → infinite loop;
(b) `_redirects` with 200 rewrites (`/display/* /__tv_spa.html 200`) →
Pages evaluates rewrites before static assets, trapping every path
(including real assets) at one fallback. And a standalone Worker can't be
used either: `*.pages.dev` hostnames belong to Pages projects and cannot
be attached to Workers.

**How we fixed it**: Pages "advanced mode" — the merged deploy output
contains a `_worker.js` (source: `workers/gateway/src/index.js`, copied by
`tooling/merge-pages.js`) that the masjid-live Pages project runs for every
request. It serves real assets via `env.ASSETS.fetch(request)` and maps
misses to `__consumer_spa.html` / `__tv_spa.html` / `__admin_spa.html` —
a direct manifest read, not an HTTP subrequest, so it cannot loop.

### 25. `_headers` rules COMBINE — Cache-Control only on narrow patterns

**Pitfall**: Cloudflare appends the values of *every* matching `_headers`
pattern. A `/*` catch-all with `Cache-Control: no-store` plus a
`/_app/immutable/*` rule with `immutable` produced
`no-cache, no-store, must-revalidate, public, max-age=31536000, immutable`
on every chunk — browsers honor the strictest directive, so immutable
caching was silently defeated.

**How we fixed it**: Security headers stay on `/*`; `Cache-Control` appears
only on `/_app/immutable/*` (immutable) and `/sw.js` (no-store). SPA
fallbacks get `no-store` from the gateway Worker code instead.

### 26. `wrangler deploy` does NOT build — you can deploy stale code

**Pitfall**: For `apps/api`, wrangler uploads the prebuilt
`.svelte-kit/cloudflare/_worker.js`. A CORS source edit "didn't work" in
production because the deploy uploaded the previous build.

**How we fixed it**: Always `npm run build --workspace=@masjid/api` before
`wrangler deploy` (CI already does this; manual deploys must too).

### 27. Manual API deploys: `--keep-vars` and loop-built `--var` args

**Pitfall**: (a) Wrangler v4 deletes dashboard-set vars not present in
config/`--var` (e.g. `LLM_API_KEY` is empty in `.env.prod` but set on the
deployed worker). (b) Building `--var` args with `&&` chains aborts the
whole chain silently when one var is empty (`[ -n "$X" ] && …` → exit 1).

**How we fixed it**: Deploy with `--keep-vars`; build args in a `for` loop
(see `docs/gateway-deploy.md` for the copy-paste block).

### 28. SPA verification requires hashes + a real browser, not curl content checks

**Pitfall**: All 3 apps are pure SPAs with no prerendering — page content
never appears in the served HTML, so `curl … | grep "some text"` always
fails even when everything works. Also, right after a Worker deploy,
different edge nodes serve old vs new versions for ~30s — two curls seconds
apart returned different SPA hashes.

**How we fixed it**: Verify route→SPA mapping by sha256-comparing served
bodies against local `.merged/__*_spa.html`; verify rendered content in a
real browser; retry with `?cb=N` cache-busters before debugging "broken"
deploys.

### 29. Root `/` must NOT redirect to a masjid

The consumer root page (`apps/consumer/src/routes/+page.svelte`) shows
"**Please Verify Your URL — You seem to have made a mistake.**" A previous
version redirected `/` → `/masjid-al-noor`, which confused users who
landed on the wrong masjid's page. Do not re-add a redirect.

### 30. Stale pages.dev CDN cache survives redeploys

**Pitfall**: The old consumer Pages deployment sent cacheable HTML; those
responses sat in the pages.dev shared CDN with `s-maxage=604800` (7 days).
After the unified deploy, plain-URL requests to `/`, `/masjid-al-noor`,
`/admin/*` kept serving the OLD consumer SPA from cache — while `?cb=1`
cache-busted requests proved the new deployment was correct. Neither
redeploying nor any API purge endpoint clears these entries (the Pages
purge API path returns `method_not_allowed`).

**How we fixed it**: No code fix possible — the entries expire on their
own; affected users hard-refresh (Ctrl+Shift+R sends `no-cache`, forcing
revalidation). The NEW deployment's `no-store` SPA responses can never be
poisoned this way. Lesson: always verify deploys with `?cb=N` before
concluding content is wrong, and never ship cacheable HTML for SPA routes.

### 31. D1 Drizzle column position mismatch scrambles query results (2026-08-05)

**Pitfall**: D1's Drizzle driver calls `.raw()` (returns arrays), and
`mapResultRow()` maps by **position**, not column name. When D1 table
columns are in a different order than the Drizzle schema (because
`ALTER TABLE ADD COLUMN` appends new columns to the end), every SELECT
silently returns scrambled data — each value shifted to the wrong field.

**How we fixed it**: `fetchThemeRow()` in `apps/api/src/lib/server/db/index.ts`
bypasses Drizzle entirely for `masjid_themes` queries. In production (Worker
runtime), it uses the raw D1 binding: `platform.env.DB.prepare(...).all()`
returns named objects. Locally falls back to Drizzle. The same fix was
applied to all 3 theme-consuming endpoints (public masjid, board, admin
profile). Also aligned Drizzle schema column order with `schema.sql` / D1
migration order.

**Key rule**: Never insert columns in the middle of a Drizzle schema table.
Always append them at the end (D1 can only do `ALTER TABLE ADD COLUMN` at
the end anyway). Keep Drizzle schema column order identical to `CREATE TABLE`
order in `schema.sql`.

### 32. `waitUntil: 'load'` fires before SPA hydration in static SvelteKit apps (2026-08-05)

**Pitfall**: `page.goto(url, { waitUntil: 'load' })` fires when the HTML shell
and scripts load. SvelteKit SPAs then asynchronously boot the router, run load
functions, and render components — a gap of 1-15s on slow CI runners. Using
`networkidle` as workaround fails for pages with persistent connections (Square
SDK, polling APIs).

**How we fixed it**: Each root layout sets
`document.documentElement.dataset.hydrated = 'true'` via `$effect()`, which
fires when SvelteKit first mounts. The `visitPage()` helper waits for
`html[data-hydrated="true"]` before checking `expectText`/`expectSelector`.
All `waitForFunction`/`waitForURL`/`waitForSelector` timeouts doubled to 30s.
`settleMs` increased to 3s.

### 33. `networkidle` fails for pages with persistent connections (2026-08-05)

**Pitfall**: `waitUntil: 'networkidle'` waits for 0 connections for 500ms.
Pages with Square Web Payments SDK or continuous API polling (e.g. unknown
slug TV display retrying 404) never reach idle state → 30s timeout.

**How we fixed it**: Never use `networkidle` by default. Stick with `'load'`
+ the `data-hydrated` signal. For pages that need `networkidle`, use the
`waitUntil` option on `visitPage`.

### 34. Gateway asset-miss 404 + canonical `/sw-kill` (2026-08-06)

**Pitfall**: (a) The gateway returned the SPA shell with 200 for ANY
unmatched path — including `/_app/immutable/chunks/<deleted>.js`. Stale HTML
referencing a gone chunk made the browser parse markup as JavaScript
(white-screen class). (b) App-level `/sw-kill` scripts were unreachable in
production: `/sw-kill` always routed to the consumer SPA fallback, so the
admin shell's kill script could never run, and the consumer shell's no
longer did anything.

**How we fixed it**: The gateway 404s asset-like misses (file extension in
the final segment, or under `/_app/`) with `no-store`, and serves a
permanent origin-wide `/sw-kill` recovery page before SPA routing. The
consumer SW was removed entirely (suicide worker kept at `/sw.js` to heal
old installs). Canonical caching headers live ONLY in
`tooling/merge-pages.js` → `.merged/_headers`; per-app `static/_headers`
files are non-authoritative (admin's was deleted).

**Key rule**: Cache-Control belongs on narrow patterns only; HTML is always
no-store; only content-hashed paths are immutable; unversioned statics get a
short bounded `max-age`; missing assets 404. See
`docs/consumer-service-worker.md` for the full caching table.

### 35. `schema.sql` ≠ the actual D1 databases — gate deploys with a live drift check (2026-08-06)

**Pitfall**: The post-engine's `posts` table existed in both `schema.sql` and
the Drizzle schema, so the CI "Schema drift check" passed — but the staging
D1 had never had `CREATE TABLE posts` applied, and every masjid endpoint
500'd after the staging deploy. The file-based checker
(`tooling/check-schema-drift.ts`) only compares the two repo files against
each other; real D1 instances only change when someone manually runs
`wrangler d1 execute`. Local dev never hits this because `ensureTables()`
auto-syncs `.masjid/local.db`. (Compounding factor: the staging DB had been
RECREATED the day before — database UUIDs go stale when a DB is recreated,
which is why the checker resolves names → UUIDs.)

**How we fixed it**: `tooling/check-d1-drift.ts` diffs `schema.sql` against
the LIVE target database via the Cloudflare REST API and fails on missing
tables/columns and type mismatches. Wired as a step in `deploy-staging.yml`
and as the `d1-drift-check` gate job in `deploy.yml` (`deploy-workers` needs
it). Column-order divergence is a WARNING, not a failure — verified safe on
prod: Drizzle lists columns explicitly in SELECTs and `masjid_themes` reads
use the raw-D1 bypass (lesson 31). Run manually:
`npx tsx tooling/check-d1-drift.ts masjid-db` (needs `CLOUDFLARE_ACCOUNT_ID`
+ `CLOUDFLARE_API_TOKEN` from `.env.prod` / `.env.staging`).

**Key rule**: there are THREE schemas — `schema.sql`, the Drizzle schema, and
each physical D1 database. `check-schema` covers the first two;
`check-d1-drift` covers the third. A deploy must pass both before it ships.

## Staging E2E testing lessons (2026-08-06/07)

These came from a week-long effort to make the staging E2E suite pass
deterministically. The failures were intermittent, seemingly random, and
resisted every obvious fix. The root cause turned out to be subtle.

### 36. Cloudflare Workers return 503 for ~30s after deploy

**Pitfall**: After a `wrangler deploy`, different Cloudflare edge nodes receive
the new worker code at different times. During the transition window (~30s),
requests to some nodes return 503 (Cloudflare's own error page, NOT the
worker's response — you can identify it by the IE conditional comments in the
HTML). This causes ANY test that hits the API to fail intermittently.

**How we fixed it**: Added retry logic to the API test helpers (`getJson` /
`postJson`): on 503, wait 5s and retry (up to 2×). Also serialized the E2E
workflow: `e2e-api` runs first (fast, ~15s), and all browser-based E2E jobs
(`consumer`, `tv`, `admin`, `deploy`) depend on it. This ensures the API is
probed and warmed before any browser tests start.

**Key rule**: Never trust the API to be ready immediately after deploy. Probe
it with retries. The `wait-for-deploy.js` script only checks Pages (build-id
in HTML meta) — it does NOT check the API worker.

**Files affected**: `tests/e2e/api.test.js`, `.github/workflows/deploy-staging.yml`

### 37. Parallel E2E jobs can burst the Cloudflare worker

**Pitfall**: All 5 E2E jobs (`api`, `deploy`, `consumer`, `tv`, `admin`) ran in
parallel with identical `needs` dependencies. The consumer pre-warm alone fired
16 rapid page loads (each triggering an API call). Combined with the API test's
50+ requests and the other suites' API calls, the staging worker was hit with
~100+ requests simultaneously — triggering Cloudflare's burst protection (503).

**How we fixed it**: Made all browser jobs depend on `e2e-api`. This
serializes: API tests warm the worker alone, then browser tests start.
Consumer/TV/Admin still run in parallel with each other, but the initial burst
is spread out.

**Files affected**: `.github/workflows/deploy-staging.yml`

### 38. Pre-warm: use `waitUntil: 'commit'`, not `'load'`

**Pitfall**: The pre-warm phase visits every test URL before the suite runs to
warm the CDN and API. Using `waitUntil: 'load'` caused it to take 165s for 16
URLs (~10s each) because it waited for ALL resources (scripts, images, Square
SDK iframes). Pages with third-party scripts (Square) can delay the `load`
event for 30s+. Using `waitUntil: 'commit'` (navigation committed — response
headers received) achieves the warming effect without the wait.

**How we fixed it**: Changed prewarm from `waitUntil: 'load'` (45s timeout) to
`waitUntil: 'commit'` (10s timeout). The HTTP request is fired, the SPA HTML is
received, the browser starts parsing, and the API call is triggered via the
layout `load()` — all without waiting for resources. Pre-warm dropped from 165s
to ~50s.

**Files affected**: `tests/e2e/helpers.js` (`prewarm()` function)

### 39. visitPage retry makes flaky suites WORSE

**Pitfall**: Adding a global retry to `visitPage()` (reload the page once if
text is missing) seemed like it would absorb CDN intermittent failures.
Instead, it doubled the time of EVERY failing test (15s first attempt + 30s
retry) because the retry created a new browser context and did a full page
load. The accumulated delays pushed the suite past the watchdog timeout.

**How we fixed it**: Removed the global retry. Instead, increased
`EXPECT_TIMEOUT` from 15s → 30s (with a warm API, content renders in <10s; 30s
covers cold starts). Individual tests that need retries (like the prayer page
with its 7 extra API calls) handle them locally via `data-table-ready` waits.

**Key rule**: Never add global retries to test infrastructure. They multiply
failure costs. If a test is genuinely timing-dependent, fix the test (add a
specific signal or wait), don't retry the whole page load.

**Files affected**: `tests/e2e/helpers.js` (reverted), `tests/e2e/consumer.test.js`

### 40. Square SDK pages need `waitUntil: 'domcontentloaded'`

**Pitfall**: The Square Web Payments SDK (`web.squarecdn.com/v1/square.js`)
creates iframes that keep persistent connections open. `page.goto()` with
`waitUntil: 'load'` can hang indefinitely because the browser's `load` event
never fires while Square's iframes are loading. The 30s `page.goto()` timeout
should catch this, but on CI networks, the Square CDN can be slow enough to
cause individual test timeouts that cascade into watchdog kills.

**How we fixed it**: Changed enrollment page tests (CON-35, CON-46) to use
`waitUntil: 'domcontentloaded'`. The SPA hydration signal (`data-hydrated`) is
the real readiness indicator, not the browser `load` event.

**Key rule**: Any page that loads third-party scripts with persistent
connections (Square, Stripe, WebSocket) should use `waitUntil: 'domcontentloaded'`.

**Files affected**: `tests/e2e/consumer.test.js`

### 41. `data-content-ready` signals can fire before page content renders

**Pitfall**: We added `data-content-ready` attributes to layout root `<div>`s,
set reactively when `$page.data.masjid != null` (layout `load()` completed).
The idea was that `visitPage()` could wait for this signal instead of racing
against the API with body-text timeouts. But Svelte renders parent templates
BEFORE child components: the layout's `<div data-content-ready>` attribute
appears in the DOM a microtask before the page component (`{@render children()}`)
renders its content. `waitForSelector('[data-content-ready]')` resolved, but
the page's text (like "Why Give?") wasn't in the DOM yet.

**How we fixed it**: Removed the `[data-content-ready]` wait from `visitPage()`.
The pre-warm handles API/D1 warming, and the 30s `EXPECT_TIMEOUT` covers
rendering latency. The attributes stay in the app layouts (harmless), and the
prayer page's `data-table-ready` signal is still used by CON-04/26/45 (it's on
the page component's OWN root element, so there's no parent-before-child race).

**Key rule**: If you set readiness signals in a PARENT component, they fire
before child content renders. Signals must be on the component that owns the
async data loading, not a parent.

**Files affected**: `tests/e2e/helpers.js`, `apps/*/src/routes/**/+layout.svelte` (kept, harmless), `apps/consumer/src/routes/[masjid_slug]/prayer/+page.svelte` (kept, used by tests)

### 42. Prayer page fetches 7 days of data outside the layout `load()`

**Pitfall**: The consumer prayer page (`/[slug]/prayer`) has its own
`loadWeek()` function in `$effect()` that makes 7 sequential API calls (one per
day of the week). This happens AFTER the layout `load()` completes. Any test
that visits `/prayer` and only waits for layout data will race against
`loadWeek()`. The loading spinner is shown during the fetch, and the weekly
table only renders when all 7 calls complete.

**How we fixed it**: Added `data-table-ready` attribute to the prayer page's
root div, set reactively when `!loading` (after `loadWeek()` completes). Tests
CON-04, CON-26, and CON-45 use `gotoPage` + `waitForSelector('[data-table-ready]')`
before checking table content. The signal is on the PAGE's own root element, so
there's no parent-before-child race.

**Files affected**: `apps/consumer/src/routes/[masjid_slug]/prayer/+page.svelte`, `tests/e2e/consumer.test.js`

### 43. `collectPage()` does not create `b.missing` — only `visitPage()` does

**Pitfall**: `collectPage(page, cfg)` creates the buckets object with
`pageErrors`, `consoleErrors`, `failedRequests`, etc. But `b.missing` (the
array of missing text/selector expectations) is only initialized by
`visitPage()`. When a test uses `gotoPage()` + manual checks and tries to
`.push()` onto `b.missing`, it crashes with "Cannot read properties of
undefined (reading 'push')".

**How we fixed it**: Initialize `b.missing = []` before using it, or use
`visitPage()` which sets it up automatically. In practice, the prayer page
tests (CON-04, CON-26, CON-45) no longer use `b.missing` — they just check
`pageErrors` and `failedRequests`.

**Files affected**: `tests/e2e/helpers.js`, `tests/e2e/consumer.test.js`

### 44. `gotoPage` swallows `expectText` failures silently

**Pitfall**: `gotoPage()`'s `expectText` and `expectSelector` checks use
`.catch(() => {})` — failures are silently swallowed. The function always
returns successfully, even if the expected text never appears. The caller must
separately check the page state afterwards. This caused confusing failures
where `gotoPage` "succeeded" but subsequent `page.evaluate()` calls found an
empty body (the page never actually loaded).

**How we fixed it**: Don't rely on `gotoPage`'s optional expectations as the
sole verification. Use `visitPage()` for one-shot page checks (it returns
`r.ok`), or follow `gotoPage()` with explicit content waits like
`waitForSelector('[data-table-ready]')`.

**Key rule**: `gotoPage`'s `expectText`/`expectSelector` are best-effort
convenience, not assertions. They're useful for speeding up the common case
(exit early when content appears), but the caller must always verify the page
state separately.

**Files affected**: `tests/e2e/helpers.js` (`gotoPage` implementation)

### 45. The SPA `data-hydrated` signal fires before layout `load()` completes

**Pitfall**: `visitPage()` waits for `data-hydrated` (set by the root layout's
`$effect()` when the SPA boots). But layout `load()` (which fetches API data)
runs AFTER hydration, in the SvelteKit client-side navigation lifecycle. The
text checks in `visitPage()` run concurrently with `load()`. This is why tests
worked with longer timeouts — the text checks just waited for `load()` to
complete, and the timeout needed to be long enough.

**How we fixed it**: The pre-warm (lesson 38) ensures the API is fast, and the
30s `EXPECT_TIMEOUT` provides enough margin for `load()` to complete even on
a cold start. The pre-warm visits all test URLs before the suite runs, so
layout `load()` API calls hit a warm worker.

**Key rule**: In static SPA mode, `load()` is a CLIENT-SIDE function that runs
after hydration. Any test that checks page content must account for `load()`
latency. Pre-warming the API is more effective than adding arbitrary delays.

### 46. Suite retry in `run.js` only helps CDN chunk-404 issues

**Pitfall**: `run.js` retries the entire suite once on failure. This was meant
to absorb CDN edge inconsistencies (stale chunk 404s). But it also retried
tests that failed for real reasons (API 503, slow `load()`), wasting CI time
and making debugging harder — a real failure takes 2× as long to surface.

**How we fixed it**: Kept the suite retry (it's useful for genuine CDN edge
issues), but made individual tests self-healing where possible:
- API tests retry on 503 (lesson 36)
- Prayer page tests wait for `data-table-ready` (lesson 42)
- Pre-warm warms the API before tests (lesson 38)
- `EXPECT_TIMEOUT` at 30s (lesson 39)

This means the suite retry only triggers for actual CDN edge inconsistency,
not for timing issues.

**Files affected**: `tests/e2e/run.js`

### 47. Parallel E2E jobs race on shared mutable state — and best-effort restores make it PERMANENT (2026-08-09)

**Pitfall**: `e2e-consumer` and `e2e-admin` run in parallel against the same
staging DB. ADM-21 toggled `enrollment_open` off on `masjid-al-noor` while
CON-46 needed it open (Square iframes assertion) — the ~4–6-min windows
overlapped routinely. Worse, the restore was UI-driven: `saveIfEnabled`
silently skipped when the save button was `disabled={saving}` (in-flight PUT),
so one slow request left `enrollment_open=false` in the never-reseeded staging
DB — and the NEXT run "restored" to its own observed (flipped) state.
Self-perpetuating: CON-46 failed on every run until a manual reseed.

**How we fixed it**: (a) restores/cleanup moved to direct API calls in
`finally` blocks (`tests/e2e/api-client.js`) — they run even when the test
body throws and never depend on button state; (b) the staging DB is reseeded
on every deploy (`tooling/dump-seed-sql.ts` → `wrangler d1 execute --file`);
(c) CON-46 asserts the enrollment-open precondition via the public API and
fails fast with a drift diagnosis; (d) transient gateway codes
(502/503/520-524) became warnings, not case failures.

**Key rule**: UI is for proving the mutation works; the API is for restoring
state. Never restore through the same fragile UI path you just tested.

### 48. A gated mutation test that can't find its form is a DEAD test (2026-08-09)

**Pitfall**: ADM-18/ADM-19 looked for create forms that only render AFTER
clicking "Add Rule"/"Add Session" — the tests never clicked, so they silently
no-op'd for weeks while claiming coverage. Same for ADM-17: the theme page's
time-format buttons changed text ("12h" → "12-hour (1:30 PM)"), and the
`if (has12 || has24)` guard turned the staleness invisible. CON-19 kept
expecting "Contact & Location" after the info page redesign (8f18085 fixed
CON-09's copy but missed the SLUG_B twin).

**How we fixed it**: mutation tests now assert their preconditions (form
opened, button found) as FAIL-worthy conditions, and read-back assertions via
API prove the save persisted. If you guard a test body with `isVisible()`,
also assert the guard was true — otherwise you're running a skip disguised as
a pass.

**Files affected**: `tests/e2e/admin.test.js`, `tests/e2e/consumer.test.js`

### 49. Admin forms rendered saveable defaults when the initial GET failed (2026-08-09)

**Pitfall**: The profile and theme settings pages caught a load error into
`error` but STILL rendered the form with default values (empty name, zero
coordinates, default Sakeenah theme). A save in that state would clobber real
data — and a mutation test running during an API hiccup would "restore"
garbage over the seed row.

**How we fixed it**: load errors go to a separate `loadError` state that
renders an error card with Retry instead of the form. Save errors keep using
`error`. The maktab settings page already had this guard (`if (!settings)
return` + ErrorCard) — profile/theme now match.

### 50. `$state` writes inside module-level getters consumed by `$derived` → `state_unsafe_mutation` in prod builds (2026-08-09)

**Pitfall**: A `.svelte.ts` rune module exported a getter-based API:

```ts
let _pref = $state<DevicePreference>('auto');
function load() { _pref = localStorage.getItem(KEY); } // writes $state
export const deviceThemePref = {
  get current() { load(); return _pref; },  // getter calls load()
};
```

The layout consumed the getter inside `$derived`:
```svelte
let devicePref = $derived(deviceThemePref.current);
```

This worked in local dev but threw `state_unsafe_mutation` in production
builds. The production signal implementation enforces that `$state` must
not be written during `$derived` computation — the getter's internal
`load()` call writes to `_pref` while Svelte is tracking the `$derived`.

**How we fixed it**: Call the side-effect function eagerly at module-init
time, not lazily inside the getter:

```ts
function load() { /* ... */ }
load(); // runs before any component mounts — no $derived context exists yet

export const deviceThemePref = {
  get current() { return _pref; }, // read-only now
};
```

**Key rule**: A getter consumed inside `$derived` must be a pure read.
Never write to `$state` (or call a function that does) from inside a
getter that will be read from a `$derived` expression. If you need
lazy initialization, do it at module-init time or in `$effect`.

**Files affected**: `apps/consumer/src/lib/theme/device-pref.svelte.ts`

### 51. Diagnosing production-only Svelte 5 runtime errors without a browser (2026-08-09)

**When you have**: a production-only Svelte 5 runtime error (e.g. `state_unsafe_mutation`,
`state_referenced_locally`, `effect_update_depth_exceeded`) that cannot be
reproduced locally.

**Step-by-step diagnosis**:

1. **Map the minified chunk back to source**. The stack trace contains chunk
   names like `2.DL87jp6e.js`. In the `merge-pages.js` build output (or CI
   build log), the Vite manifest names the chunks. Cross-reference with the
   server build output — e.g. `_masjid_slug_/_page.svelte.js` (30.23 kB) in
   the consumer SSR output maps to client chunk `nodes/2`. This tells you
   which `.svelte` file the error originates from.

2. **Read the error URL**. Svelte 5 errors include a URL like
   `https://svelte.dev/e/state_unsafe_mutation`. This IS the canonical
   documentation — open it.

3. **Search imports of the suspect file**. The error may originate from a file
   *imported by* the chunk, not the chunk itself. Grep all imports from the
   suspect page/layout. In this case, `+layout.svelte` imported
   `device-pref.svelte.ts` — the bug lived there.

4. **Understand why prod-only**. The local dev build uses Proxy-based
   reactivity; the production build uses compiled signals. The prod build
   enforces rules that dev proxies are lenient about. Pair with what the
   error means (`state_unsafe_mutation` = `$state` write during
   `$derived`/template effect) and scan every `$state` in the
   import chain for writes in reactive contexts.

5. **Test fix locally, verify with staging**. After fixing, push to master
   and trigger the `deploy-staging-only.yml` workflow (no E2E) to verify
   the fix on real infrastructure. E2E tests run separately from the full
   `deploy-staging.yml` on push to `staging`.

6. **For future debugging**: if you have the Browsermcp tool, you can
   navigate to the staging URL, open the browser console, and capture the
   full error. Otherwise, reproduce by building locally
   (`npm run build --workspace=@masjid/consumer`) and serving the static
   output — the production build will surface the same error.

### 52. Zod `discriminatedUnion` rejects partial updates without the discriminator (2026-08-09)

**Pitfall**: `UpdateNavItemSchema` was defined as `z.discriminatedUnion('kind', [...])`.
A discriminated union requires the discriminator field (`kind`) in **every** request
to determine which variant to validate. The admin frontend sent partial updates
without `kind` — `{ label: 'New Label' }`, `{ show_on_desktop_header: false }`,
`{ is_highlighted: true }`. Every update request failed with a `ZodError` (400),
showing a toast error but never actually mutating data. The API integration tests
passed only because they happened to include `kind` in every test payload. The
admin frontend tests passed because they mocked the API calls.

**How we fixed it**: Changed the schema from `z.discriminatedUnion('kind', [...])`
to a flat `z.object({ kind: NavItemKind.optional(), ... })` where ALL fields are
optional. Removed the `kind`-dependent gating in the PUT handler
(`if (body.kind === 'route' && ...)`) — any provided field is applied directly.

**Key rule**: Never use `z.discriminatedUnion` for PATCH/update schemas. Use a
flat partial object instead. Discriminated unions are for creation where the
discriminator is always known. Tests that mock API calls cannot detect Zod
validation failures — write integration tests that actually parse the schema.

**Files affected**: `packages/schemas/src/nav.ts`, `apps/api/src/routes/api/v1/admin/masjids/[id]/nav/[itemId]/+server.ts`

### 53. Consumer frontend never fetched nav items from the API (2026-08-09)

**Pitfall**: The admin navigation settings page, API CRUD endpoints, Zod schemas,
and DB schema were all complete and working. But the consumer frontend
(`apps/consumer/src/routes/[masjid_slug]/+layout.svelte`) had a hardcoded
`navItems` array. The pre-built components (`Header.svelte`, `MobileBottomNav.svelte`,
`MobileTopBar.svelte`, `NavDrawer.svelte`) that could consume API-fetched nav
items existed but were never imported or wired up. Admin changes appeared to
"not work" because the consumer — the only place users see the results — ignored
the API entirely.

**How we fixed it**: Added `NavItem` type + `fetchNavItems()` to `apps/consumer/src/lib/api.ts`,
added `nav_items` to the layout `load()` function (with graceful fallback — nav
endpoint failure doesn't crash the page), and replaced the hardcoded `navItems`
array with a `$derived.by()` block that maps API items to the layout's render format,
including an icon-name→SVG-path map for all 9 icon names. Desktop/mobile visibility
toggles (`show_on_desktop_header`, `show_on_mobile_bottom`) are now respected.
Updated `app.d.ts` and `PagePayload` to include `nav_items` and missing masjid
fields (`about_html`, `about_markdown`, `donation_links`, `show_donate_qr`,
`asr_madhab`, `external_donation_url`).

**Key rule**: When building a feature across layers (admin UI → API → consumer),
verify the **final consumer** reads from the API. A feature is not complete until
the end user sees the result. Pre-built components that were "ready for integration"
but were never wired up are a red flag — either wire them in or delete them.
Also: type declarations (`app.d.ts`) must stay in sync with actual API response
shapes; stale types cause cascading TS errors that obscure real issues.

**Files affected**: `apps/consumer/src/lib/api.ts`, `apps/consumer/src/routes/[masjid_slug]/+layout.ts`, `apps/consumer/src/routes/[masjid_slug]/+layout.svelte`, `apps/consumer/src/app.d.ts`

### 54. Cloudflare error 1042: same-zone Worker→Worker fetches are blocked (2026-08-10)

**Pitfall**: The admin agent chat worked locally but failed in production on EVERY
message (even "hi!") with `SyntaxError: Unexpected token 'e', "error code: 1042 "
is not valid JSON`. The chat route set `apiUrl: url.origin` (the worker's own
`mapi.mr-thack.workers.dev`) and `@masjid/agent`'s api-client called it with
global `fetch` — a Worker fetching a Worker on the same zone. Cloudflare blocks
that with **error 1042** ("Worker tried to fetch from another Worker on the same
zone") and resolves the subrequest with a plain-text `error code: 1042` body.
`getMasjidProfile()` then did a blind `res.json()` → SyntaxError. Two earlier
"fix" commits hardened the LLM-response parsing instead — wrong spot: the raw
SyntaxError (no `[v2]` prefix, while the deployed build HAD that hardening) was
the tell that the parse failure lived in the unguarded api-client. Dev never hit
it because `url.origin` is `http://localhost:5173` — no Cloudflare edge.

**How we fixed it**: (1) `ApiClientConfig` gained an optional `fetcher` — the
chat route passes SvelteKit's `event.fetch`, so same-origin API calls route
through the SvelteKit server internally with NO network hop (also skips the JWT
round-trip latency). (2) Every api-client function now goes through `apiJson()`,
which checks `res.ok`, reads text first, and throws descriptive errors
(`Admin API GET ... returned non-JSON response (HTTP 200): error code: 1042`)
instead of raw SyntaxErrors. (3) The WhatsApp worker's `wrangler.toml` gained
`compatibility_flags = ["global_fetch_strictly_public"]` — the documented escape
hatch that lets its cross-worker call to `mapi` use the public fetch path when
it is eventually deployed.

**Key rule**: A Worker must never call its own (or a same-zone sibling's) public
URL with global `fetch`. Inside the API app, inject `event.fetch`; across
workers, use `global_fetch_strictly_public` or a Service Binding. And never
`.json()` a fetch response without checking `res.ok`/content first — edge
infrastructure returns plain-text error bodies.

**Files affected**: `packages/agent/src/api-client.ts`, `packages/agent/src/types.ts`, `apps/api/src/routes/api/v1/admin/masjids/[id]/agent/chat/+server.ts`, `workers/whatsapp/wrangler.toml`
