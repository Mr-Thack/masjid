# AGENTS.md

## Current state (2026-07-20)
The project is a fully implemented monorepo with:
- **Working API** (SvelteKit + D1, 268 tests)
- **Working TV frontend** (SvelteKit static, 25 tests — no Tailwind, hand-written CSS ~6 KB)
- **Working consumer frontend** (SvelteKit static/SPA, 36 tests — 1 date-dependent failure)
- **Working WhatsApp worker** (Stages 1-3 complete — webhook + session + LLM agent, 179 tests)
- **472 tests passing** (268 API + 25 TV + 179 WhatsApp; 1 pre-existing consumer failure: heading label mismatch)
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
npm run test          # API-only, 268 tests (no external deps)
npm run test:tv       # TV frontend, 25 tests (jsdom + testing-library)
npm run test:consumer # Consumer frontend, 36 tests (jsdom + testing-library)
npm run test:whatsapp # WhatsApp worker, 179 tests (node, mocked D1 + fetch)
npm run test:all      # everything
```

## Seed data

### Masjid Al-Noor (Chicago, IL)
- Team: `admin@masjid-alnoor.org` / `password123`
- Who slug: `masjid-al-noor` (note dashes, not underscores)
- WhatsApp: `+15551230001` (Zero-UI admin)
- API endpoint: `http://localhost:5173/api/v1/masjids/masjid-al-noor`
- Consumer page: `http://localhost:5175/masjid-al-noor`
- TV page: `http://localhost:5174/display/masjid-al-noor`

### Masjid Al-Jabal (Kennesaw, GA)
- Team: `admin@masjid-aljabal.org` / `password123`
- Who slug: `masjid-al-jabal`
- WhatsApp: `+15551230002` (Zero-UI admin)
- API endpoint: `http://localhost:5173/api/v1/masjids/masjid-al-jabal`
- Consumer page: `http://localhost:5175/masjid-al-jabal`
- TV page: `http://localhost:5174/display/masjid-al-jabal`
- Notes: Hanafi / Indo-Pak congregation; uses `minimal-light` theme, `12h` time format, ISNA calculation method, and Indo-Pak transliterations (`Azaan`, `Iqamah`, `Zuhr`, `Jummah`).
- DB file: `.masjid/local.db` (SQLite via better-sqlite3 in dev mode)

## Monorepo structure
```
masjid/
  packages/schemas/          — Shared Zod types (Theme, Announcement, Jumuah, etc.)
  packages/ui-utils/         — Shared UI helpers: theme presets, applyTheme, prayer-change utilities
  apps/api/                  — SvelteKit API + Drizzle ORM + Prayer engine
  apps/tv/                   — SvelteKit static, display-only (kiosk/TV)
  apps/consumer/              — SvelteKit static/SPA, PWA (user-facing)
  workers/push/              — Cloudflare Worker for push notifications (skeleton)
  workers/whatsapp/          — Cloudflare Worker for WhatsApp Zero-UI (Stages 1-2 complete)
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
- **Tailwind v4**: Used in consumer app only (via `@tailwindcss/vite` plugin, CSS-first config, `@theme` block in `app.css`). TV app uses hand-written CSS (~300 lines, 6 KB gzipped) — Tailwind v4 was removed because it failed to output CSS in the static build.
- **Svelte `class:` directive bug**: Svelte 5 parser chokes on `class:` with Tailwind classes containing `/` (e.g., `class:bg-gray-900/80`). Must use inline `{cond ? 'class' : 'class'}` instead.
- **Admin routes**: Moved under `admin/masjids/[id]/...` to avoid route conflict with public `masjids/[slug]`.
- **Board endpoint**: `GET /api/v1/masjids/{slug}/board` returns today + 7 upcoming days of prayer times, theme, jumuah, and announcements in a single request. The TV frontend uses this instead of 8 separate API calls.

## Consumer frontend architecture (Phase 2 complete)

### Theme & display settings (extensible, per-masjid)
- **`@masjid/ui-utils`**: Shared `presetTokens` and `applyTheme(theme)` used by both consumer and TV.
- **`src/lib/theme/context.svelte.ts`**: Thin re-export of `applyTheme` from `@masjid/ui-utils` for consumer-specific import paths.
- **`layout_preset` field** in `masjid_themes` table switches presets. Current seed uses `"modern_minimal"` which falls through to `glass-dark` default.
- **`masjid_themes` also stores display vocabulary**: `time_format` (`12h`/`24h`) and custom labels for `adhaan`, `iqaamah`, `jumuah`, `sunrise`, and each prayer name (`fajr`, `dhuhr`, `asr`, `maghrib`, `isha`). These flow through the public API and are consumed by `PrayerCard`, `PrayerList`, and the weekly prayer view.
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
| `PrayerCard` | Single prayer time card (adhaan + iqaamah, sunrise line for Fajr, current/next badges, optional right-after-adhaan collapse) |
| `PrayerList` | Wrapping grid of PrayerCards with current + next prayer index logic |
| `AnnouncementCard` | Expandable announcement (title, date, compiled_html, pin badge) |
| `DonateButton` | External donation link CTA (heart + external link icons) |
| `LoadingSpinner` | Centered spinning loader |
| `ErrorState` | Error message card with warning icon |
| `EmptyState` | Empty state card with icon, title, and message |
| `SkeletonPrayerCard` | Shimmer placeholder for prayer card loading |

### Pages (under `/[masjid_slug]/`)
| Route | Description |
|---|---|
| `+layout.svelte` | Shell: sticky header, top nav on desktop/bottom nav on mobile (Home | Prayer | News | Info), theme application, nav transitions |
| `+layout.ts` | Load function — fetches page payload, returns masjid/theme/prayer_times/jumuah/announcements |
| `+page.svelte` | Home: hero + countdown, prayer cards grid, jumuah today, pinned announcement, donate CTA |
| `+error.svelte` | Error boundary fallback |
| `prayer/+page.svelte` | Weekly prayer times viewer (prev/next week navigation) |
| `jumuah/+page.svelte` | Jumu'ah sessions list with session cards (sessions now also show on homepage; location shown once when shared) |
| `announcements/+page.svelte` | Announcements feed |
| `donate/+page.svelte` | Donation page with CTA and "Why Give" section |
| `info/+page.svelte` | Masjid contact info, address, and social links |

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
| `AnalogClock` | SVG analog clock (hour/minute/second hands, accent-colored second hand) |
| `PrayerBoard` | 6-column CSS grid table (label + 5 prayers) with adhaan/iqamah/sunrise rows, current prayer highlight, sharp flash pulse |
| `Countdown` | Compact `<span>` showing "6h 07m" or "04:32" until next iqaamah |
| `JumuahNotice` | One-liner: `* Jumu'ah: 1:30 PM (Eng) · 2:30 PM (Arb)` |
| `AnnouncementBanner` | Marquee banner at page bottom |

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

## Design documents (always useful)
- `Background.md` — original vision/spec
- `schema.sql` — complete D1 schema (9 tables + indexes)
- `docs/api.md` — API route reference (including board endpoint)
- `docs/tv-display.md` — TV display architecture & design decisions
- `docs/rules-engine.md` — prayer rules engine spec
- `docs/mcp-integration.md` — MCP/Zod strategy
- `docs/zero-ui.md` — Native MCP / Agentic config setup for admins strategy
- `docs/whatsapp-zero-ui.md` — Implementation plan + architecture for WhatsApp worker

## WhatsApp Zero-UI worker (`workers/whatsapp/`)

Stages 1-3 are complete. The worker handles Meta webhook verification, inbound message parsing,
phone-to-tenant resolution, branch lifecycle (OPEN/MERGED/ABANDONED), media file handling,
and LLM-powered configuration via OpenAI-compatible API.

### Architecture
- Worker receives WhatsApp webhooks from Meta, resolves tenant by `admins.whatsapp_phone`
- All admin mutations are staged in `config_branches` → `config_mutations` (git-style branches)
- Worker calls the *existing* SvelteKit admin API via JWT proxy (no business logic duplication)
- Stage 3: LLM agent interprets messages, calls 20 MCP-style tools (theme, profile, prayer rules, jumu'ah, announcements), stores mutations, presents diff receipt, confirms on `/confirm`
- Stage 4 (future): Vision LLM for timetable photos, time-travel rollback, RTL handling

### Agent module (`src/agent/`)
| File | Purpose |
|------|---------|
| `tools.ts` | 20 MCP-style tool definitions with JSON Schema parameters + API proxy handlers |
| `prompt.ts` | System prompt builder with tenant context, domain guides, and examples |
| `runner.ts` | LLM agent loop: send message → call LLM → execute tool calls → repeat → diff receipt |
| `format.ts` | Human-readable diff receipt formatting for WhatsApp (grouped by domain) |

### Agent tools (20 total)
| Domain | Tools |
|--------|-------|
| THEME | `theme_get`, `theme_update` |
| PROFILE | `profile_get`, `profile_update`, `prayer_config_get`, `prayer_config_update` |
| PRAYER_RULES | `prayer_rules_list`, `prayer_rules_create`, `prayer_rules_update`, `prayer_rules_delete`, `prayer_rules_reorder` |
| JUMUAH | `jumuah_list`, `jumuah_create`, `jumuah_update`, `jumuah_delete` |
| ANNOUNCEMENTS | `announcements_list`, `announcements_create`, `announcements_update`, `announcements_delete`, `announcements_pin` |

### LLM configuration
Uses OpenAI-compatible chat completions API. Configurable via env vars:
- `LLM_API_URL` — defaults to `https://api.openai.com/v1` (can use OpenRouter, Groq, etc.)
- `LLM_API_KEY` — required; if not set, falls back to text-only acknowledgment mode
- `LLM_MODEL` — defaults to `gpt-4o-mini`

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

## Quick dev tips
- DB goes missing? Re-run `npx tsx tooling/seed.ts`
- Consumer page returning 500? API might be down or DB empty — check `curl http://localhost:5173/api/v1/masjids/masjid-al-noor`
- Frontend tests fail? Make sure `conditions: ['browser']` is in the vitest config — this is required for `@testing-library/svelte` to work with Svelte 5
- Need to inspect the running page? `curl http://localhost:5175/masjid-al-noor` gives the SSR output
- The CSS is served at `http://localhost:5175/src/app.css` — contains the full compiled Tailwind v4 output
