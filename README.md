# Masjid Platform

A multi-tenant, serverless SaaS platform for Islamic community centers (*masaajid*). Provides a complete digital presence — consumer website, prayer-hall TV display, admin dashboard, and WhatsApp-based configuration — all running on Cloudflare's edge network.

## What's in the box

| App | Port | Audience | Tech |
|---|---|---|---|
| **API** | 5173 | Backend | SvelteKit + D1 + Drizzle ORM |
| **Consumer** | 5175 | Congregants (public) | SvelteKit static SPA, Tailwind v4 |
| **TV Display** | 5174 | Prayer hall kiosk/TV | SvelteKit static, hand-written CSS |
| **Admin** | 5176 | Masjid administrators | SvelteKit static SPA, Tailwind v4 |
| **WhatsApp Worker** | — | Admins via WhatsApp | Cloudflare Worker + LLM agent |
| **@masjid/agent** | — | Shared bot logic | TypeScript package (47 MCP tools) |

**Production**: API at `mapi.mr-thack.workers.dev`; all frontends unified on `masjid-live.pages.dev`.

## Quick start

```bash
# One command — installs, syncs SvelteKit types, and seeds the local DB
npm run setup

# Start everything (4 terminals):
npm run dev --workspace=@masjid/api      # port 5173
npm run dev --workspace=@masjid/tv       # port 5174
npm run dev --workspace=@masjid/consumer # port 5175
npm run dev --workspace=@masjid/admin    # port 5176
```

Then open:
- **Consumer**: http://localhost:5175/masjid-al-noor
- **TV**: http://localhost:5174/display/masjid-al-noor
- **Admin**: http://localhost:5176/admin/masjid-al-noor (login: `admin@masjid-alnoor.org` / `password123`)

## How to test

```bash
npm run test             # API unit tests (673, no server needed)
npm run test:all:ci      # ALL vitest suites + schema check (no servers needed)
npm run test:all         # EVERYTHING — vitests + SW + integration (needs servers running)
npm run test:e2e         # Browser E2E smoke (needs dev servers running locally)
npm run test:e2e:staging # Browser E2E against staging deployment
```

See `docs/testing.md` for the full testing guide.

## Where to look

| If you want to... | Read this |
|---|---|
| Understand the architecture and conventions | `AGENTS.md` |
| See all API endpoints | `docs/api.md` |
| Understand the style systems (Sakeenah/Mishkaat) | `docs/design-language.md` |
| Deploy something | `docs/unified-deploy.md` |
| Understand deployment lessons learned | `docs/deploy-lessons.md` (54 lessons) |
| See the branching model | `AGENTS.md` § "Current state" |
| Review the original vision | `Background.md` |
| See the full file tree | `STRUCTURE.md` |

## Seed masjids

### Masjid Al-Noor (Chicago, IL)
- **Style**: Mishkaat (gold, Amiri headings)
- **Login**: `admin@masjid-alnoor.org` / `password123`
- **Slug**: `masjid-al-noor`

### Masjid Al-Jabal (Kennesaw, GA)
- **Style**: Sakeenah (minimal-light)
- **Login**: `admin@masjid-aljabal.org` / `password123`
- **Slug**: `masjid-al-jabal`

## Key design decisions

- **Square (not Stripe)** for payments — Stripe account verification couldn't be completed
- **No Tailwind on TV** — Tailwind v4 failed to emit CSS in the static build; hand-written CSS (~950 lines) instead
- **Static SPAs** — Consumer, TV, and Admin use `adapter-static` for maximum reliability at the edge
- **D1 + Drizzle** — Cloudflare's serverless SQLite; schema drift is gated in CI with live D1 checks
- **Single API call for TV** — The `board` endpoint returns 8 days of data in one request
- **47 MCP tools** — Agent handles 13 domains from prayer rules to navigation to timetable import
- **Two style systems** — Sakeenah (minimal glass-dark/light) and Mishkaat (ornate soul-forward with ceremony states)
