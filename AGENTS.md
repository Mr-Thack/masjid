# AGENTS.md

## Repo state
No code exists yet. This is a pre-implementation design repo. The primary design docs are `Background.md` (vision/spec) and the files below.

## Key documentation files
- `Background.md` — original project blueprint and motivation
- `schema.sql` — complete D1 schema (9 tables, all indexes, final)
- `docs/api.md` — full API endpoint reference (24 routes)
- `docs/rules-engine.md` — condition/action types, execution algorithm, validation rules
- `docs/mcp-integration.md` — Zod schema strategy, MCP tool generation, agent workflow

## Decisions made (supersedes Background.md where they conflict)
- Adhaan is **calculated astronomically** (immutable) — only `calculation_method` on masjid controls it
- Iqaamah is **configured via sequential rules** with conditions (AND) and actions — see `docs/rules-engine.md`
- Conditions: `always`, `day_of_week`, `month` (Gregorian), `hijri_month` (e.g. Ramadan=9), `date_range`
- Actions: `add_minutes`, `round_up`, `round_down`, `round_nearest`, `set_fixed_time` — `add_minutes` does NOT accept negatives
- Multiple conditions per rule = AND logic. OR logic = separate rules
- `set_fixed_time` chains through (subsequent rules can still modify the time)
- Hijri date computed from Gregorian midnight date (civil boundary, not Maghrib boundary)
- Timezone stored per-masjid, set manually (no geocoding auto-resolve)
- No factory default rules on masjid creation — empty slate
- Only 1 pinned announcement at a time (toggle auto-unpins others)
- Announcements soft-delete (status='archived') not hard delete
- Admin auth via password + JWT (email-based ingestion is separate Zero-UI path)
- 1 admin per masjid for now (FK enforces this implicitly)

## Intended tech stack (from spec)
- **Platform:** Cloudflare Workers, Cloudflare Pages, Cloudflare D1 (SQLite), Cloudflare KV
- **Framework:** SvelteKit
- **CSS:** Tailwind CSS
- **Auth:** bcrypt passwords + self-contained JWTs (no server-side sessions)
- **Validation:** Zod schemas shared between API and MCP server
- **AI:** MCP (Model Context Protocol) for agentic ingestion
- **Payments:** Stripe (Checkout + webhooks)
- **Tooling:** not yet configured (no package.json, no tsconfig, no build/lint/test setup)

## Architecture (monorepo packages per spec)
- `masjid-api-core` — Cloudflare Workers / SvelteKit API engine
- `masjid-ui-tv` — Cloudflare Pages at `/display` (static HTML for TV displays)
- `masjid-ui-consumer` — Cloudflare Pages at `/[masjid_slug]` (PWA for users)
- `masjid-worker-push` — Background worker for push notifications
- `packages/schemas` — Shared Zod types for API + MCP server (to be created)

## Key design constraints
- Public-facing endpoints use **write-time static compilation**, not live DB reads
- Public prayer times and page payloads served from **KV cache** — DB only hit on writes
- Payment handling is **offloaded to Stripe** (no card data touches the platform)
- UI themes driven by **database design tokens** mapped to Tailwind CSS custom properties
- Custom domain support via **Cloudflare for SaaS Custom Hostnames**
- Widget embeds restricted to an **explicit destination whitelist** with sandboxed iframes

## API baseline (see docs/api.md for full reference)
- All admin routes under `/api/v1/masjids/:id/...` require JWT
- Public routes under `/api/v1/masjids/:slug/...` are unauthenticated, KV-cached
- Error shape: `{ error: { code: string, message: string } }`