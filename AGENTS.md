# AGENTS.md

## Current state (2026-07-24)
The project is a fully implemented monorepo with:
- **Working API** (SvelteKit + D1, 408 tests)
- **Working TV frontend** (SvelteKit static, 28 tests — no Tailwind, hand-written CSS ~6 KB)
- **Working consumer frontend** (SvelteKit static/SPA, 47 tests, 1 pre-existing Jumuah homepage failure)
- **Working WhatsApp worker** (Stages 1-4 complete — webhook + session + LLM agent + vision + dry-run + rollback + RTL, 215 tests)
- **Working @masjid/agent** (shared bot logic extracted from WhatsApp worker — tools, runner, prompts, format, api-client, session, media)
- **Admin app scaffolded** (SvelteKit static/SPA on port 5176 — auth, dashboard, 9 settings pages, bot chat panel — tests pending)
- **670+ tests passing** (408 API + 215 WhatsApp + 47 consumer)
- **Everything runs locally** — API on 5173, TV on 5174, consumer on 5175, admin on 5176

## How to start everything
```bash
# Terminal 1 — seed DB + start API
npx tsx tooling/seed.ts   # only needed first time or after DB loss
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
npm run test          # API tests, 408 (no external deps)
npm run test:tv       # TV frontend, 28 tests (jsdom + testing-library)
npm run test:consumer # Consumer frontend, 47 tests (jsdom + testing-library; 1 pre-existing Jumuah homepage failure)
npm run test:whatsapp # WhatsApp worker, 215 tests (node, mocked D1 + fetch)
npm run test:sw       # Service worker integration, 26 tests (Playwright, requires running dev servers)
npm run test:agent    # Agent package tests (pending: ~175 expected)
npm run test:admin    # Admin app tests (pending: ~202 expected)
npm run test:all      # everything (excluding test:sw and test:admin since they need servers running)
```

## Seed data

### Masjid Al-Noor (Chicago, IL)
- Team: `admin@masjid-alnoor.org` / `password123`
- Who slug: `masjid-al-noor` (note dashes, not underscores)
- WhatsApp: `+15551230001` (Zero-UI admin)
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
- Notes: Hanafi / Indo-Pak congregation; uses `minimal-light` theme, `12h` time format, ISNA calculation method, and Indo-Pak transliterations (`Azaan`, `Iqamah`, `Zuhr`, `Jummah`).
- DB file: `.masjid/local.db` (SQLite via better-sqlite3 in dev mode)

## Monorepo structure
```
masjid/
  packages/schemas/          — Shared Zod types (Theme, Announcement, Jumuah, etc.)
  packages/ui-utils/         — Shared UI helpers: theme presets, applyTheme, prayer-change utilities
  packages/agent/            — Shared bot logic: LLM runner, 22 MCP tools, prompts, api-client, session, media
  apps/api/                  — SvelteKit API + Drizzle ORM + Prayer engine
  apps/tv/                   — SvelteKit static, display-only (kiosk/TV)
  apps/consumer/              — SvelteKit static/SPA, PWA (user-facing)
  apps/admin/                — SvelteKit static/SPA, admin dashboard (settings + AI bot chat)
  workers/push/              — Cloudflare Worker for push notifications (skeleton)
  workers/whatsapp/          — Cloudflare Worker for WhatsApp Zero-UI (imports bot logic from @masjid/agent)
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

## Consumer service worker (`static/sw.js`)

Hardened after the July 2026 hydration bug (see `docs/consumer-service-worker.md`).

### Key hardening features
- **Versioned cache**: `CACHE_NAME = 'masjid-consumer-__BUILD_HASH__'` replaced at build time via Vite plugin (dev) or `scripts/sw-hash.js` postbuild script
- **Scheme guard**: Early return for non-`http:`/`https:` URLs (prevents `chrome-extension://` crash)
- **Method guard**: Only intercepts `GET` requests
- **Navigation guard**: Skips `navigate` mode requests (prevents index.html caching)
- **Origin guard**: Only caches same-origin assets (no third-party CDN pollution)
- **Opaque guard**: Skips opaque responses (status 0, can't be cached)
- **Cache limit**: Trims to MAX_CACHE_ENTRIES (100) to prevent unbounded growth
- **`/sw-kill` self-destruct**: `fetch('/sw-kill')` unregisters SW and clears all caches
- **Error surfacing**: Cache failures are `postMessage`d to controlled clients
- **Health check**: Page can send `{ type: 'health-check' }` to get cache stats
- **Update detection**: `app.html` listens for new SW version via `updatefound` event
- **SW bypass on kill path**: `app.html` skips registration when URL contains `/sw-kill`

### Build pipeline
- **Dev**: Vite plugin middleware intercepts `/sw.js`, replaces `__BUILD_HASH__` with random string
- **Build**: `closeBundle` hook replaces hash in `build/sw.js`, then `postbuild` script (`scripts/sw-hash.js`) does it again as a safety net
- **Integration tests**: `apps/consumer/tests/sw-integration.test.js` (Playwright, 26 tests)

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
| `+layout.svelte` | Shell: sticky header, top nav on desktop/bottom nav on mobile (Home | Prayer | News | Info | Maktab), theme application, nav transitions |
| `+layout.ts` | Load function — fetches page payload, returns masjid/theme/prayer_times/jumuah/announcements |
| `+page.svelte` | Home: hero + countdown, prayer cards grid, jumuah today, pinned announcement, donate CTA |
| `+error.svelte` | Error boundary fallback |
| `prayer/+page.svelte` | Weekly prayer times viewer (prev/next week navigation) |
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
- `docs/bot-abstraction.md` — How to extract core agent logic from WhatsApp worker into `@masjid/agent`
- `docs/admin-manual-settings.md` — Admin microservice manual settings UI (profile, theme, prayer rules, jumu'ah, announcements, domains, snapshots, account)
- `docs/admin-ai-capabilities.md` — Admin AI bot chat panel design (DiffReceiptCard, vision, SSE streaming)
- `docs/admin-tests.md` — Admin app test strategy (~202 tests: unit + integration + E2E)

## WhatsApp Zero-UI worker (`workers/whatsapp/`)

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
| `api-client.ts` | 18 JWT-authenticated API proxy functions |
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
- **No service worker** — browser cache is sufficient

## Maktab Registration (`apps/api`)

Maktab enrollment lives inside the main `@masjid/api` monolith, using the same D1/SQLite database as the rest of the platform.

### State
- **408 API tests** total; 56 of those cover Maktab (public info, auth, validation, admin CRUD, Square enrollment, term activation, registrations, and helper units for Square/email/money/schemas).
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
- Maktab form embed URL: `http://localhost:5175/masjid-al-noor/maktab/enroll?embed=1`
- Maktab dev secrets (Square/Brevo) go in `apps/api/.dev.vars`; put real values there for live sandbox testing
