# AGENTS.md

## Current state (2026-08-13)
The project is a fully implemented monorepo with:
- **Working API** (SvelteKit + D1, 673 tests)
- **Working TV frontend** (SvelteKit static, 266 tests — no Tailwind, hand-written CSS)
- **Working consumer frontend** (SvelteKit static/SPA, 165 tests)
- **WhatsApp worker — NOT fully implemented / not working correctly** (Stages 1-4 complete — webhook + session + LLM agent + vision + dry-run + rollback + RTL, 231 tests — but the end-to-end WhatsApp flow is not yet working right; see the "WhatsApp Zero-UI worker" section below)
- **Working @masjid/agent** (shared bot logic extracted from WhatsApp worker — 47 tools, runner, prompts, api-client, session, media)
- **Admin app** (SvelteKit static/SPA on port 5176 — auth, dashboard, 11 settings pages, bot chat panel — 230 tests)
- **Tooling tests** (23 tests covering merge-pages, build integrity, schema drift)
- **Runtime D1 schema checks removed (2026-08-13)**: `ensureD1Columns`, `waitForD1Migrations`, `COLUMN_MIGRATIONS`, and all runtime `ALTER TABLE` logic removed from the Worker (see "Schema management" below). The isolated D1 binding hang that caused intermittent staging E2E failures (consumer suite bucket-clean missing-text with zero CPU, §deploy-lessons-55) is eliminated — the Worker no longer awaits D1 calls before routing requests. Schema correctness is enforced entirely by the CI pipeline: `check-schema` (static) + `check-d1-drift` (live D1) + staging reseed — the Worker is a pure consumer, never a schema manager.
- **Mishkaat style system shipped (Phases 0-3, 2026-07-29)** — `style_system`/`style_options` columns, Mishkaat preset (espresso/gold), RTL TV layout, Amiri headings, star-and-octagon band (default motif; honeycomb opt-in), arch clock-niche + rosette ornaments, classic clock, server-time sync, soul-column frames (hadith/jumu'ah/announcements/donate appeal + QR as two slides), schedule changes rolling through the prayer board (45s/15s cycle, adhaan→iqaamah+5min holdoff), ceremony states (adhaan → countdown → in-progress → quiet → night calm: 20% veil, board stays readable), Friday/Ramadan/Eid modes, ambient palette. Sakeenah unchanged. New registrations default to Mishkaat. See `docs/design-language.md`.
- **Prayer tables shipped (2026-07-30)** — the homepage prayer section is the classic masjid timetable (`PrayerTable`: one row per prayer, adhaan/iqaamah columns, sunrise row, current-row highlight + rosette, next chip, right-after-adhaan and dual-Asr notes) and the Times tab is the weekly timetable (`WeeklyPrayerTable`: days × prayers, iqaamah over adhaan per cell, today row, cross-week change accents, styled legend) — BOTH style systems, replacing the card grid and the stacked day cards. `PrayerCard`/`PrayerList`/`SkeletonPrayerCard` deleted.
- **Mishkaat consumer adaptation shipped (§7.11, 2026-07-30)** — the soul comes to the mobile main page when Mishkaat is selected: mihrab hero niche (shared arch geometry), star band + rosette header glyph, Hadith of the Day card, adhaan/iqaamah hero moments (shared `computeCeremony`), mild ambient background, current-prayer rosette marker. Ceremony overlays/rotation/board roll deliberately stay TV-only. Shared ornaments/state machine now live in `@masjid/ui-utils` (`components/`, `arch.ts`, `ceremony.ts`).
- **Everything runs locally** — API on 5173, TV on 5174, consumer on 5175, admin on 5176
- **Production deployed** — API on mapi.mr-thack.workers.dev; ALL 3 page apps (consumer + TV + admin) unified on **masjid-live.pages.dev** via Pages advanced mode (`_worker.js` router in the merged deploy)
- **Unified deploy live (2026-07-29)** — one domain for everything. **Read `docs/unified-deploy.md` before touching deployment.** Old `masjid-live-tv`/`masjid-live-admin` Pages projects deleted; cutover complete.
- **Branching model (2026-08-05)**: `master` = dev (commit freely), `staging` = release gate (auto-deploy + E2E on push), production = manual `workflow_dispatch` only. **Only push to staging when you are preparing a production release.** Development happens on master; when enough changes are ready, merge master → staging, let E2E run, then manually trigger `Deploy to Cloudflare` to push to prod. Staging is NOT for everyday testing — it's the final gate before prod.
- **Build ID (2026-08-05)**: every frontend app injects `<meta name="build-id" content="<git-hash>">` via `hooks.server.ts` `transformPageChunk`. The API `/status` endpoint also returns `build_id`. Check from any device: View Source or `curl /api/v1/status | jq .build_id`.
- **E2E hydration signal (2026-08-05)**: each root layout sets `document.documentElement.dataset.hydrated="true"` in `$effect()`. The `visitPage()` helper waits for `html[data-hydrated]` before checking `expectText`/`expectSelector`. Tests use `waitUntil: 'load'` (never `networkidle` — breaks on Square SDK/polling pages).
- **E2E determinism rework (2026-08-05)**: the harness (`tests/e2e/helpers.js`) is condition-based, not sleep-based. Key rules: (1) every case runs inside `testCase(t, id, fn)` — a thrown timeout becomes a FAIL line, never a process-killing uncaught exception; (2) `loginAdmin()` logs in ONCE per admin run (hydration awaited before touching the form — a pre-hydration submit click triggers a NATIVE form submit, which was the `waitForURL('**/admin/**')` CI flake — and `waitForURL` is registered before the click); the navigation is raced against the app's error banner so a 500ing login API fails FAST with the real message; later authed cases reuse `context.storageState()` (JWT lives in localStorage); (3) fixed `waitForTimeout` only for stress pacing, never readiness — use `gotoPage`/`settlePage` (adaptive network-quiet settle); (4) ceilings: nav 30s, expectation 15s, login 45s, settle ≤2s; visitPage expectations run concurrently; (5) suite watchdog `E2E_SUITE_WATCHDOG_MS` (default 8min) aborts stuck suites with the in-flight case name; (6) all non-browser fetches use `AbortSignal.timeout` and return `status: 0` on failure; (7) `run.js` honors multiple `--suite=` flags and prints per-suite timings; (8) CI browser/deploy jobs run `tests/e2e/wait-for-deploy.js <app>` first — a readiness probe that polls until the edge serves the fresh deploy (build-id meta == `GITHUB_SHA`, chunks are real assets) and warms it, replacing the blind `sleep 30` (mixed-version edge serving flaked consumer/tv for minutes post-deploy, 2026-08-06). Full local run ≈ 3.5 min; CI splits suites across parallel jobs. See `docs/integration-testing.md` §5.2.
- **D1 column-order fix (2026-08-05)**: `fetchThemeRow()` in `apps/api/src/lib/server/db/index.ts` bypasses Drizzle's position-based `.raw()` mapping by using raw D1 binding (`.all()` → named objects) in production, falling back to Drizzle locally. The Drizzle schema column order now matches `schema.sql` creation order. Do NOT insert new columns in the middle of tables — always append them.
- **E2E determinism restructure (2026-08-09)**: the post-lessons-36-46 flakes were shared-STATE races, not readiness. Fixes (full rationale: `docs/e2e-determinism.md`): (1) transient gateway codes 502/503/520-524 from our origins are `warnings`, not `failedRequests` — a 503 that breaks a page still fails via missing expectations; (2) mutation tests are hermetic — one `testCase` per mutation, unique per-run entity names, UI creates but **API restores/cleanup in `finally`** via `tests/e2e/api-client.js` (`snapshotProfileFields`/`restoreProfileFields`, `restoreEnrollmentOpen`, `delete*ByPrefix`); ADM-16..22 are separate cases, ADM-18/19 now really open the create forms (they were silently dead); (3) **staging D1 is reseeded on every staging deploy** (`tooling/dump-seed-sql.ts` → `wrangler d1 execute --file`) — no run inherits drift; (4) `wait-for-deploy.js api` mode gates the `e2e-api` job and checks the worker's `build_id` == `GITHUB_SHA` (a 200 from a mid-propagation old worker is not readiness); (5) ALL `/maktab/enroll` loads use `waitUntil: 'domcontentloaded'` (Square iframes stall `load`); CON-46 asserts the enrollment-open precondition via API first; (6) `loginAdminWithRetry` retries once (cold bcrypt) — attach request listeners at CONTEXT level so they survive the retry. Two latent app bugs found and fixed along the way: admin profile/theme pages rendered saveable default forms when the initial GET failed (now a load-error state), and `ensureTables` still created the dropped `external_donation_url` column locally. Note: the announcement DELETE endpoint ARCHIVES (soft delete) — API cleanup means "archived", residue rows are wiped by the staging reseed.

## First-time setup (fresh clone or worktree)

Every fresh checkout — whether `git clone` or `git worktree add` — needs these steps before anything else will work:

```bash
# 1. One-shot setup (install + sync + seed + dev secrets)
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

> **Secrets**: `.env.dev` is committed to git (Square/Brevo/LLM keys for dev), so every worktree gets it automatically. In production, secrets come from the Cloudflare Worker runtime (`platform.env`). In local dev with `vite dev`, the API reads from `process.env` — nothing loads `.env.dev` automatically. Most local work (prayer engine, UI, tests) doesn't need these secrets. For Maktab/Square enrollment in local dev, source them into your shell: `set -a && source .env.dev && set +a` before starting the API server. Tests that need Square credentials auto-skip when they're missing.

> **Per-worktree note**: each `git worktree` is a separate directory with its own `.masjid/local.db` and `node_modules`. You must `npm install` and seed inside each worktree. See "Branching model & parallel work" below.
>
> **If admin/consumer/TV tests fail with `Cannot find module './.svelte-kit/tsconfig.json'`**, the `.svelte-kit/` output is missing — re-run step 2 above (`svelte-kit sync`).

## How to start everything
```bash
# One command — finds 4 open ports, starts all servers, prints URLs
npm run dev:all

# Or start individual servers (each reads PORT env var, defaults to canonical port):
npm run dev --workspace=@masjid/api          # default port 5173
npm run dev --workspace=@masjid/tv           # default port 5174
npm run dev --workspace=@masjid/consumer     # default port 5175
npm run dev --workspace=@masjid/admin        # default port 5176

# When running in a worktree (ports 5173-5176 likely occupied):
BASE_PORT=5180 npm run dev:all   # finds 5180-5183 or next available block
PORT=5190 npm run dev --workspace=@masjid/api  # single server on custom port
```

`npm run dev:all` uses `tooling/dev.js` which scans for 4 consecutive free ports starting at `BASE_PORT` (default 5173), jumps by 10 if any are occupied, and passes them to each app via the `PORT` env var. Frontend proxy targets automatically point at the API port via `API_PORT`.

## How to test
```bash
npm run test             # API unit tests, 673 (no server needed)
npm run test:integration  # API integration tests, 7 (requires API server on 5173)
npm run test:tv          # TV frontend, 266 tests (jsdom + testing-library)
npm run test:consumer    # Consumer frontend, 165 tests (jsdom + testing-library)
npm run test:whatsapp    # WhatsApp worker, 231 tests (node, mocked D1 + fetch)
npm run test:sw          # Service worker removal tests, 12 (Playwright, requires dev servers)
npm run test:agent       # Agent package tests, 40 tests (node)
npm run test:admin       # Admin app tests, 230 tests (jsdom + testing-library)
npm run test:tooling     # Tooling tests (merge-pages, build integrity — 23 tests)
npm run test:e2e         # Browser E2E smoke vs local dev servers
npm run test:e2e:staging # Browser E2E vs staging
npm run test:e2e:prod    # Browser E2E vs prod, read-only
npm run test:all         # Everything (vitest suites + SW + integration — needs servers)
npm run test:all:ci      # All vitest suites + schema check (no servers needed)
```

Full testing reference: `docs/testing.md`.

### Before committing — minimum bar

```bash
npm run test:all:ci      # all vitest suites + schema check (must be green)
npm run typecheck        # or: npm run check --workspaces --if-present
```

> **Known irrelevant TS warning**: raw `tsc --noEmit` (not the project's gate) reports
> `Module '"*.svelte"' has no exported member 'WeekDay'` in
> `apps/consumer/src/__tests__/components/WeeklyPrayerTable.test.ts:8`. It's a false
> positive — `WeekDay` is legitimately exported from `<script module lang="ts">` in
> `WeeklyPrayerTable.svelte`, but plain `tsc` only sees Svelte's ambient `*.svelte`
> shim (default export only). `svelte-check` (what `npm run typecheck` actually runs)
> resolves it correctly with 0 errors. Ignore it; no fix needed unless raw-`tsc` ever
> becomes a CI gate.

**Before writing or modifying ANY E2E test, first read:**
- **`docs/integration-testing.md`** — the determinism rules (§5.2), conventions (§7), and incident regression map (§9)
- **`docs/e2e-determinism.md`** — root causes, plan, and handoff lessons

These docs contain hard-earned lessons (condition-based waits, `expectText`
before form interaction, public-API polling after entity creation, storageState
patterns, etc.) that will prevent flakes and staging failures.  Every rule
there was learned from a production or staging incident.

Also:
- `git status` — only stage intended files, never `git add -A`
- No `console.log`, `debugger`, or commented-out code unless intentional
- Schema changes: update `schema.sql` AND `schema.ts` together, then run `npm run check-schema`. The CI pipeline enforces zero drift at deploy time (`check-schema` + `check-d1-drift`). There is NO runtime schema migration — see "Schema management" below.
- New columns on Drizzle tables? **Append at the end** of the `CREATE TABLE` and Drizzle column list, never insert in the middle
- New API route? Check `docs/adding-api-routes.md` for the checklist

## Seed data

### Masjid Al-Noor (Chicago, IL)
- Team: `admin@masjid-alnoor.org` / `password123`
- Who slug: `masjid-al-noor` (note dashes, not underscores)
- WhatsApp: `+15551230001` (Zero-UI admin)
- Style system: **Mishkaat** (gold, `layout_preset='mishkaat'`, Amiri headings) — the flagship seed
- `style_options`: `photoUrl` (the bundled **default image** — `apps/consumer/static/uploads/default-hero.svg`, shared constant `DEFAULT_HERO_URL` from `@masjid/ui-utils`) + `logoUrl` (`apps/consumer/static/uploads/seed/noor-logo.svg`), `whatsappGroupUrl`, `donateReasons` — exercises the photo hero, header logo, WhatsApp link, and custom donate cards
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
- `style_options`: `whatsappGroupUrl` + `donateReasons` only — `photoUrl`/`logoUrl` deliberately unset so the fallback hero and letter-avatar header stay covered
- Also seeds: a homepage post ("A Note from the Imam", `content_type='post'`, `show_on_homepage=true`), a Resources custom page (`/masjid-al-jabal/pages/resources`), and a full nav item set (Info is desktop-header-only) — when any nav items exist the consumer layout replaces its fallback defaults entirely
- DB file: `.masjid/local.db` (SQLite via better-sqlite3 in dev mode)

## Monorepo structure
```
masjid/
  packages/schemas/          — Shared Zod types (Theme, Announcement, Jumuah, etc.)
  packages/ui-utils/         — Shared UI helpers: theme presets, applyTheme, prayer-change utilities, Mishkaat shared modules (components/Rosette + StarBand, arch.ts geometry, ceremony.ts state machine, hadith.ts collection)
  packages/agent/            — Shared bot logic: LLM runner, 43 MCP tools, prompts, api-client, session, media
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
  vitest.whatsapp.config.ts  — WhatsApp worker vitest (node)
  vitest.admin.config.ts     — Admin app vitest (jsdom, svelte plugin)
  vitest.tooling.config.ts   — Tooling vitest (node)
  vitest.integration.config.ts — API integration tests (node)
```

## Key architectural decisions
- **Local dev DB**: `better-sqlite3` at repo-root `.masjid/local.db`, NOT the wrangler D1 miniflare DB
- **`getDb()`** resolves DB path from `import.meta.dirname` → `apps/api/.masjid/local.db` in dev, D1 binding in production
- **API proxy**: TV, consumer, and admin have Vite proxy configs: `/api` → `localhost:5173`
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
- **Mishkaat consumer adaptation (§7.11)**: `style_system` flows through the page payload; pages branch via `resolveStyleSystem(theme)`. Hero mihrab niche (`HeroNiche`), header star band + rosette glyph, `HadithCard`, adhaan/iqaamah hero moments, ambient background via `src/lib/ambient.ts` (`data-ambient-phase` on the app root), `rosetteMarker` on the prayer table's current row. All Mishkaat CSS keys off `html[data-style-system='mishkaat']` or renders only under the branch. (2026-08-13: homepage Jumu'ah pinning Thu–Fri removed — the prayer table always sits above Jumu'ah; the TV soul column still pins Jumu'ah frames.)
- **`src/lib/theme/context.svelte.ts`**: Thin re-export of `applyTheme` from `@masjid/ui-utils` for consumer-specific import paths.
- **`style_options.hideHomeNav` (2026-08-13)**: boolean — hides the Home tab (desktop header + mobile bottom nav) because the header logo/name already links home. Admin toggle lives in Theme → Images ("Hide the Home tab"). Default `false`. See `docs/nav-config.md` §2.5.
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
| `+layout.svelte` | Shell: sticky header, top nav on desktop/bottom nav on mobile, theme application, nav transitions |
| `+layout.ts` | Load function — fetches page payload, returns masjid/theme/prayer_times/jumuah/announcements/nav_items |
| `+page.svelte` | Home: two-column layout — left = announcement + homepage post + donate CTA, right = hero (or full-width photo hero above when `photoUrl` set) + prayer table + jumu'ah |
| `+error.svelte` | Error boundary fallback |
| `prayer/+page.svelte` | Weekly prayer times viewer (prev/next week navigation, `WeeklyPrayerTable`) |
| `jumuah/+page.svelte` | Jumu'ah sessions list with session cards (sessions also show on homepage; location shown once when shared) |
| `announcements/+page.svelte` | Announcements feed |
| `news/+page.svelte` | Tabbed Posts + Announcements feed |
| `donate/+page.svelte` | Donation page with CTA and "Why Give" section |
| `info/+page.svelte` | Masjid contact info, address, and social links |
| `maktab/+page.svelte` | Minimal term/pricing card with **Enroll Now** CTA |
| `maktab/enroll/+page.svelte` | Square Web Payments SDK enrollment form (parent, address, children, card) |
| `pages/[page_slug]/` | Dynamic custom page (admin-created via Content, rendered by slug) |
| `posts/[post_slug]/` | Single post page (renders compiled HTML body) |

### Other known items
- **The `minimal-light` preset exists** but has no light-mode `.glass`/`.glass-card` equivalents — would need light variants for a true light theme.
- **Only 1 admin per masjid** — the `admins` table has a UNIQUE FK on `masjid_id`.
- **Admin app is fully built** — 15 pages (login, register, dashboard, bot chat, 11 settings pages). See `docs/admin-manual-settings.md` and `docs/admin-ai-capabilities.md`.
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
- **Style systems**: `masjid_themes.style_system` ('sakeenah' default, 'mishkaat' flagship) + `style_options` JSON column (metal/motif/arch/numerals/density/ambient/quietHours/frames/emblem/donateAppeal; unknown keys ignored, missing keys → defaults). Synced across `schema.sql` and Drizzle schema.
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

## Reference docs — what to read for what

**⚠️ Before writing or changing ANY E2E test, read `docs/integration-testing.md` §5.2 and `docs/e2e-determinism.md`. Every rule there was learned from a staging or production incident.**

| Task | Read |
|---|---|
| **Any UI/design work** | `docs/design-language.md` — canonical naming, style systems, terminology |
| **Adding/editing API endpoints** | `docs/adding-api-routes.md` — full recipe with checklist |
| **Understanding local dev** | `docs/local-dev.md` — servers, proxy, database, secrets |
| **Running/changing tests** | `docs/testing.md` — suite descriptions, when to run what, common issues |
| **Deploying** | `docs/unified-deploy.md` — merge pipeline, deploy runbook, headers |
| **Debugging a deploy or CI** | `docs/deploy-lessons.md` — 54 hard-earned production incidents |
| **Prayer rules / engine** | `docs/rules-engine.md` + `docs/new-rules-spec.md` |
| **TV display / kiosk** | `docs/tv-display.md` (Sakeenah era; Mishkaat in this AGENTS.md) |
| **Admin UI settings** | `docs/admin-manual-settings.md` — page-by-page reference |
| **Admin AI bot** | `docs/admin-ai-capabilities.md` — DiffReceiptCard, SSE, vision |
| **WhatsApp Zero-UI** | `docs/whatsapp-zero-ui.md` + `docs/zero-ui.md` |
| **Bot abstraction / MCP** | `docs/bot-abstraction.md` + `docs/mcp-integration.md` |
| **E2E testing harness** | `docs/integration-testing.md` + `docs/integration-test-cases.md` |
| **E2E determinism issues** | `docs/e2e-determinism.md` |
| **Maktab / enrollment** | `docs/maktab-integration.md` |
| **Posts / custom pages / nav** | `docs/post-engine.md` + `docs/nav-config.md` |
| **Service worker / caching** | `docs/consumer-service-worker.md` + `docs/admin-cache-poisoning.md` |
| **API schema** | `schema.sql` — canonical D1 schema (18 tables) |
| **Original vision** | `Background.md` |
| **File tree** | `STRUCTURE.md` |

## WhatsApp Zero-UI worker (`workers/whatsapp/`)

> **NOT DEPLOYED (2026-08-06)**: WhatsApp/push workers are disabled until launch and have never been deployed (the account runs `mapi` + `mapi-staging` only). The prod deploy matrix in `deploy.yml` skips them — their entries are commented out with re-add instructions (no-op `build` scripts already in place; wrangler compiles TS at deploy time, no build step needed). `wrangler.toml` carries `global_fetch_strictly_public` so its calls to `mapi`'s public URL won't hit CF error 1042 when re-enabled (lesson 54).

> **NOT FULLY IMPLEMENTED (2026-08-13)**: the end-to-end WhatsApp flow is not yet
> working correctly despite Stages 1-4 (and 231 tests) being complete. Do not treat
> this worker as production-ready; the tests cover the individual stages, not the
> full working WhatsApp loop.

Stages 1-3 are complete. The worker handles Meta webhook verification, inbound message parsing,
phone-to-tenant resolution, branch lifecycle (OPEN/MERGED/ABANDONED), media file handling,
and LLM-powered configuration via OpenAI-compatible API.

### Architecture
- Worker receives WhatsApp webhooks from Meta, resolves tenant by `admins.whatsapp_phone`
- All admin mutations are staged in `config_branches` → `config_mutations` (git-style branches)
- Worker calls the *existing* SvelteKit admin API via JWT proxy (no business logic duplication)
- Stage 3: LLM agent interprets messages, calls 43 MCP-style tools (theme, profile, prayer rules, jumu'ah, announcements, content, nav, maktab, rollback, rules, timetable, web), stores mutations, presents diff receipt, confirms on `/confirm`
- Stage 4 (completed): Vision LLM for timetable photos, time-travel rollback, RTL handling

### Agent module (`src/agent/`)
| File | Purpose |
|------|---------|
| `tools.ts` | Thin re-export from `@masjid/agent` |
| `prompt.ts` | Thin wrapper converting `Env` → `BotContext`, delegates to `@masjid/agent` |
| `runner.ts` | Wrapper converting `Env` → `BotContext`, formats structured diff receipt as WhatsApp markdown |
| `format.ts` | WhatsApp markdown renderer on top of `@masjid/agent` structured diff data |

### Agent tools (47 total)
| Domain | Tools |
|--------|-------|
| THEME | `theme_get`, `theme_update` |
| PROFILE | `profile_get`, `profile_update`, `prayer_config_get`, `prayer_config_update` |
| PRAYER_RULES | `prayer_rules_list`, `prayer_rules_create`, `prayer_rules_update`, `prayer_rules_delete`, `prayer_rules_reorder` |
| JUMUAH | `jumuah_list`, `jumuah_create`, `jumuah_update`, `jumuah_delete` |
| ANNOUNCEMENTS | `announcements_list`, `announcements_create`, `announcements_update`, `announcements_delete`, `announcements_pin` |
| CONTENT | `content_list`, `content_create`, `content_update`, `content_delete`, `content_pin_homepage`, `content_pin_info` |
| NAV | `nav_list`, `nav_create`, `nav_update`, `nav_delete`, `nav_reorder` |
| MAKTAB | `maktab_get`, `maktab_update`, `maktab_terms_list`, `maktab_term_activate` |
| ROLLBACK | `rollback_list_snapshots`, `rollback_restore` |
| RULES | `rules_explain`, `rules_validate` |
| TIMETABLE | `timetable_preview`, `timetable_import` |
| WEB | `web_search`, `web_fetch` |

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
| `getToolDefinitions()` | 43 MCP tool definitions (theme, profile, prayer rules, jumu'ah, announcements, content, nav, maktab, rollback, rules, timetable, web) |
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
| `/register` | New masjid registration (creates masjid + admin account) |
| `/admin/[slug]` | Dashboard (stats, status, quick actions) |
| `/admin/[slug]/settings/profile` | Masjid profile (18 fields) |
| `/admin/[slug]/settings/theme` | Theme settings (presets, colors, fonts, labels, style system) |
| `/admin/[slug]/settings/prayer` | Prayer rules table + dry-run simulator |
| `/admin/[slug]/settings/jumuah` | Jumu'ah sessions management |
| `/admin/[slug]/settings/maktab` | Maktab term/pricing management + registrations |
| `/admin/[slug]/settings/announcements` | Announcements with markdown editor |
| `/admin/[slug]/settings/content` | Unified content management (posts + pages) with markdown editor, homepage/info pins, type badges |
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
- **673 API tests** total; 69 of those cover Maktab (public info, auth, validation, admin CRUD, Square enrollment, term activation, manual registration, registrations, and helper units for Square/email/money/schemas).
- **Enrollment form errors (2026-08-10)**: client validation lives in `apps/consumer/src/lib/maktab-validation.ts` (pure, unit-tested) and mirrors `SquareEnrollmentSchema` — keep the two in sync when rules change. The enroll page shows a `role="alert"` summary panel at the top on submit (scrolled into view + focused) plus per-field inline errors with `aria-invalid`; inline errors also appear on blur pre-submit (the summary panel stays submit-only) and clear on input. Required fields carry accent asterisks + `aria-required`; server Zod failures return readable sentences, not the raw Zod JSON blob.
- **Square is the only payment provider**; Stripe support was removed because account verification could not be completed in time.
- **No migration from `suffah-old`** — only new enrollments are tracked.
- **Embed mode** for the enrollment form: `?embed=1` (or `?embed=true`) hides the consumer header and bottom navigation so the form can be dropped into an existing masjid website via iframe.
- **Local dev secrets** live in `.env.dev` at the repo root — this file is committed and contains Square/Brevo/LLM keys for local development. The API reads from `process.env` in `vite dev` — to use Maktab/Square features, source `.env.dev` into your shell first.

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
| `POST /api/v1/admin/masjids/:id/maktab/registrations` | JWT | Create manual (offline-payment) registration with custom monthly amount |

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
- Maktab/Square enrollment in local dev: source `.env.dev` into your shell (`set -a && source .env.dev && set +a`) before starting API. Tests auto-skip when keys are missing.
- Debug endpoint: `GET /api/v1/debug` — public, no auth; returns DB connectivity, bcrypt test, admin info
- Status endpoint: `GET /api/v1/status` — public, no auth; returns worker health, env vars presence, D1 connectivity
- Production status: `curl https://mapi.mr-thack.workers.dev/api/v1/status`
- Term `billing_months` column exists on `mkt_terms` — set it to charge fewer months than the term length (e.g. 8 for a 9-month Ramadan term)

## Branching model & parallel work

### The branch flow

```
master (dev) ──merge──▶ staging (gate) ──manual trigger──▶ production
```

- **`master`** — where development happens. Commit freely here.
- **`staging`** — release gate. Pushing to staging triggers auto-deploy + E2E suite. Only push to staging when you're preparing a production release.
- **Production** — manual `workflow_dispatch` from the Actions tab. Only trigger when staging E2E is green.

**Staging is NOT for everyday testing** — it's the final gate before prod. Run E2E locally (`npm run test:e2e`) during development.

### Running E2E tests

```bash
npm run test:e2e         # Local — against dev servers on current ports
npm run test:e2e:staging # Staging — against masjid-staging.pages.dev (writes OK, disposable DB)
npm run test:e2e:prod    # Production — read-only alarm
```

### Git worktrees (parallel agents)

Multiple agents can work simultaneously using `git worktree`. Each worktree is a separate directory with its own `node_modules` and database.

**Rules** (from a 2026-07-29 incident where uncommitted files leaked into master):

1. **One agent per worktree, one branch per agent.**
   ```bash
   git worktree add ../masjid-<feature> -b <feature> master
   ```
   Each agent is told their worktree path (e.g. `~/code/masjid-<feature>`) and must
   **never** read or write outside that directory. The main tree (`~/code/masjid`) stays
   single-tenant — only one agent touches it at a time.

2. **Write ONLY to your worktree.** An agent working on `~/code/masjid-nav-fix` must
   NOT write to `~/code/masjid`. Changes integrate by merging the branch back into
   master, not by copying files between directories.

3. **Per-worktree setup** — each new worktree needs:
   ```bash
   cd ~/code/masjid-<feature>
   npm run setup    # install + svelte-kit sync + seed DB
   ```
   Each worktree gets its own `.masjid/local.db`.

4. **Dev servers on dynamic ports** — worktrees can run simultaneously:
   ```bash
   # Main tree (default ports):
   npm run dev:all
   # Worktree (next available block):
   BASE_PORT=5180 npm run dev:all
   ```

5. **Only the main tree deploys.** Feature agents never run wrangler or deploy.
   Deployment flow: merge to staging → E2E passes → manual prod deploy from Actions.

6. **Commit hygiene** — before every commit:
   ```bash
   git status && git branch --show-current
   git add <specific-files>    # never git add -A
   git show --stat HEAD        # verify after committing
   ```

7. **Keep branches short-lived** — rebase onto master before merging:
   ```bash
   git rebase master
   ```
   This surfaces conflicts in the branch, not on master.


## Hard-earned lessons (deployment & testing)

54 lessons documented in **`docs/deploy-lessons.md`** covering:
- Production deployment pitfalls (lessons 1-23): Workers runtime, Square API, Wrangler v4, CI config, DB atomicity
- Unified deployment pitfalls (lessons 24-35): Pages advanced mode, headers, cache, schema drift
- Staging E2E testing (lessons 36-46): worker warmup, pre-warming, hydration signals, timeout strategy
- Determinism restructure (lessons 47-54): shared-state races, mutation hermeticity, Zod gotchas, Cloudflare error 1042

Every one of these was a production incident. Read the relevant section before touching
deploy scripts, CI workflows, E2E tests, or the API worker.

## Schema management

**The Worker is a pure consumer, never a schema manager.** There is NO runtime
`ALTER TABLE` or column-migration code in the application. Schema correctness is
enforced entirely by the CI pipeline, which has three layers:

| Layer | What it checks | Where it runs | Blocks deploy? |
|---|---|---|---|
| `check-schema` | `schema.sql` ↔ Drizzle `schema.ts` agree | CI (`npm run check-schema`) + deploy workflows | Yes (both staging and prod) |
| `check-d1-drift` | `schema.sql` ↔ the LIVE D1 database | Deploy workflows (`deploy-staging.yml`, `deploy.yml`) | Yes (both staging and prod) |
| Staging reseed | Wipes + rebuilds staging D1 from `schema.sql` via `tooling/dump-seed-sql.ts` | Deploy workflow (staging only) | Runs after deploy, guarantees hermetic state |

**The invariant**: by the time the Worker receives its first request, the D1
database matches `schema.sql` exactly. A worker can never encounter a database
that is missing tables or columns — if one did, the deploy would have been
blocked.

**History**: this replaced a previous design where the Worker ran `ALTER TABLE
ADD COLUMN` at runtime via `ensureD1Columns`/`waitForD1Migrations`. That
approach caused intermittent E2E failures when D1 binding calls hung at
cold-start (2026-08-09 and 2026-08-13). See `docs/deploy-lessons.md` lesson 55.

### How to add a new column

1. Add the column to `schema.sql` at the end of the `CREATE TABLE` statement
2. Add the column to `schema.ts` (Drizzle schema) — append to the column list
3. Run `npm run check-schema` — must pass locally
4. Run `npx tsx tooling/check-d1-drift.ts masjid-db-staging` — live D1 check against staging
5. For local dev: delete `.masjid/local.db` and re-run `npm run seed`
6. For production: the column is added by `wrangler d1 execute schema.sql` — run this BEFORE the worker deploy

### Three authoritative files

| File | Role |
|---|---|
| `schema.sql` | Canonical DDL — the single source of truth for D1 and local SQLite (18 tables) |
| `apps/api/src/lib/server/db/schema.ts` | Drizzle ORM schema — must match `schema.sql` exactly |

Local dev reads and executes `schema.sql` directly at startup (`getLocalDb()`). No more hand-maintained embedded DDL. `check-schema` CI enforces that these two files never drift.
