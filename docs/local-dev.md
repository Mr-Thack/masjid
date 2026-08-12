# How Local Development Works

## The four servers

Running `npm run dev` in each workspace starts 4 independent Vite dev servers:

| App | Port | Command | What it serves |
|---|---|---|---|
| API | 5173 | `npm run dev --workspace=@masjid/api` | SvelteKit server (routes, SSR, API endpoints) |
| TV | 5174 | `npm run dev --workspace=@masjid/tv` | Static TV display app |
| Consumer | 5175 | `npm run dev --workspace=@masjid/consumer` | Static consumer SPA |
| Admin | 5176 | `npm run dev --workspace=@masjid/admin` | Static admin SPA |

Each is its own `vite dev` process. They don't know about each other directly.

## API access: the proxy

Consumer, TV, and Admin are **static SPAs** — they have no `+server.ts` files. Yet they need to call the API. That's handled by a Vite proxy configured in each app's `vite.config.ts`:

```
Browser                    Vite dev server              API
   │                            │                        │
   │  GET /api/v1/masjids/foo   │                        │
   │ ─────────────────────────► │                        │
   │                            │  GET /api/v1/masjids/foo (forwarded)
   │                            │ ──────────────────────► │
   │                            │                        │
   │                            │  ← JSON response ────── │
   │  ← JSON response ──────── │                        │
```

From the browser's perspective, it makes a relative request to its own origin (`/api/v1/...`) and gets JSON back. The browser never talks to port 5173 directly.

In production builds, the apps embed `VITE_API_URL` at build time (e.g., `https://mapi.mr-thack.workers.dev`) and fetch that absolute URL instead. The proxy is **dev-only**.

## The database: where data lives

### Local dev — `better-sqlite3` at `.masjid/local.db`

```bash
# Creates the DB and populates with seed data (Al-Noor + Al-Jabal)
npx tsx tooling/seed.ts
# DB lives here (repo root):
# .masjid/local.db
```

The `getDb()` function in `apps/api/src/lib/server/db/index.ts` detects it's running in Node.js (not a Worker) and returns a `better-sqlite3` connection. Tables are auto-created by `ensureTables()` on first connection — no migration needed locally.

### Production — D1 (Cloudflare's serverless SQLite)

In production (Cloudflare Workers), `getDb()` returns the D1 binding (`platform.env.DB`). The `schema.sql` file is the canonical schema for D1. New tables and columns must be applied via `wrangler d1 execute`.

### Per-worktree databases

Each `git worktree` is a separate directory with its own `.masjid/local.db`. Running `npx tsx tooling/seed.ts` inside each worktree creates its own isolated DB.

## Secrets: `.env.dev`

The repo includes a committed `.env.dev` at the root with all dev secrets (Square sandbox keys, Brevo API key, LLM API key). Every worktree and clone gets it automatically.

In local `vite dev`, the API reads secrets from `process.env` — NOT from `.env.dev` automatically. For most work (prayer engine, UI, tests), you don't need these. To use Maktab/Square enrollment locally, source `.env.dev` into your shell first:

```bash
set -a && source .env.dev && set +a
npm run dev --workspace=@masjid/api
```

In production (Cloudflare Workers), secrets come from `platform.env` — configured via `wrangler.toml` `[vars]` + `--var` flags at deploy time, or via the Cloudflare dashboard.

The Maktab routes read from `process.env` in dev, and `platform.env` in prod:
```ts
const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN || platform?.env?.SQUARE_ACCESS_TOKEN;
```

## How a page load works (consumer example)

```
1. Browser navigates to http://localhost:5175/masjid-al-noor
2. Vite serves the SPA HTML shell with a <script> tag
3. SvelteKit boots, reads the URL, runs +layout.ts load()
4. +layout.ts calls fetch('/api/v1/masjids/masjid-al-noor')
5. Vite proxy forwards to localhost:5173
6. API server hits .masjid/local.db, returns JSON
7. +layout.svelte renders with the payload
8. Page component renders (PrayerTable, hero, etc.)
```

## Key files involved

| File | Role |
|---|---|
| `apps/api/src/lib/server/db/index.ts` | `getDb()` — dispatches to better-sqlite3 (dev) or D1 (prod) |
| `apps/api/src/hooks.server.ts` | JWT auth middleware, CORS, public path whitelist |
| `tooling/seed.ts` | Creates `.masjid/local.db` and populates seed data |
| `apps/api/.dev.vars` | Local dev secrets (Square, Brevo) |
| `apps/consumer/vite.config.ts` | Proxy config + SvelteKit plugin |
| `schema.sql` | Canonical D1 schema — source of truth for production |
| `apps/api/src/lib/server/db/schema.ts` | Drizzle ORM schema — must match `schema.sql` |

## Common tasks

```bash
# Reset the database (start fresh)
rm .masjid/local.db && npx tsx tooling/seed.ts

# Regenerate SvelteKit types (needed after route changes)
npx --workspace=@masjid/consumer svelte-kit sync
npx --workspace=@masjid/tv svelte-kit sync
npx --workspace=@masjid/admin svelte-kit sync

# Check API health
curl http://localhost:5173/api/v1/status
curl http://localhost:5173/api/v1/masjids/masjid-al-noor

# See what the consumer page returns (SSR)
curl http://localhost:5175/masjid-al-noor
```

## What breaks when

| Symptom | Likely cause |
|---|---|
| Consumer/Admin pages show "Please Verify Your URL" | API server (5173) is down or DB is empty |
| API returns 500 | DB not seeded — run `seed.ts` |
| Maktab enrollment fails | `.env.dev` not sourced into shell |
| Consumer/TV/Admin tests fail with module errors | `.svelte-kit/` missing — run `svelte-kit sync` |
| Port already in use | Another dev server (or worktree) is running on that port |
| `npm run test:all` passes but `test:e2e` fails | Dev servers not running on 5173-5176 |