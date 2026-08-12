# Project Structure

```
masjid/
├── .env.dev / .env.staging / .env.prod  # Environment configs
├── package.json                          # npm workspaces root
├── tsconfig.base.json                    # shared TS compiler options
├── eslint.config.js                      # shared lint rules
├── schema.sql                            # CANONICAL D1 schema (19 tables) — source of truth for production
├── AGENTS.md                             # Primary developer onboarding & architecture doc
├── Background.md                         # Original vision/spec
├── .masjid/                              # local dev DB (per-worktree)
├── .merged/                              # unified Pages build output (merge-pages.js)
│
├── docs/                                 # 31 design/architecture documents
│   ├── api.md
│   ├── testing.md                        # Complete testing guide
│   ├── local-dev.md                      # How local development works
│   ├── adding-api-routes.md              # Recipe for new endpoints
│   ├── deploy-lessons.md                 # 54 hard-earned production lessons
│   ├── design-language.md                # Canonical naming + Sakeenah/Mishkaat spec
│   ├── rules-engine.md
│   ├── tv-display.md
│   ├── unified-deploy.md                 # Deployment runbook
│   ├── integration-testing.md / integration-test-cases.md
│   ├── e2e-determinism.md
│   ├── admin-manual-settings.md / admin-ai-capabilities.md / admin-tests.md
│   ├── bot-abstraction.md / zero-ui.md / whatsapp-zero-ui.md
│   ├── consumer-service-worker.md / admin-cache-poisoning.md
│   ├── maktab-integration.md
│   ├── mcp-integration.md
│   ├── post-engine.md / nav-config.md
│   └── ... (adhan-js-migration, code-quality-audit, llm-ux-improvements, etc.)
│
├── packages/
│   ├── schemas/                          # @masjid/schemas — shared Zod types (masjid, prayer, theme, announcements, jumuah, nav, posts, pages, maktab, common)
│   ├── ui-utils/                         # @masjid/ui-utils — theme presets, applyTheme, Mishkaat modules (Rosette.svelte, StarBand.svelte, arch.ts, ceremony.ts, hadith.ts)
│   └── agent/                            # @masjid/agent — shared bot logic: 47 MCP tools, LLM runner, prompts, api-client, session, media
│
├── apps/
│   ├── api/                              # @masjid/api — SvelteKit API (Cloudflare Workers + D1 + Drizzle ORM + Prayer engine)
│   │   ├── svelte.config.js              # adapter-cloudflare
│   │   ├── vite.config.ts
│   │   ├── wrangler.toml                 # D1 bindings, R2, env vars
│   │   └── src/
│   │       ├── hooks.server.ts           # JWT auth middleware, CORS
│   │       ├── routes/
│   │       │   ├── api/v1/
│   │       │   │   ├── auth/             # register, login, me
│   │       │   │   ├── debug/            # public debug endpoint
│   │       │   │   ├── status/           # public status endpoint
│   │       │   │   ├── masjids/[slug]/   # public: profile, board, prayer, jumuah, announcements, posts, pages, nav, maktab
│   │       │   │   └── admin/masjids/[id]/  # JWT: profile, prayer, jumuah, announcements, posts, pages, nav, maktab, domains, agent, branches, rollback
│   │       │   └── webhooks/stripe/      # Stripe webhook handler
│   │       └── lib/server/
│   │           ├── db/                   # D1 client, Drizzle schema, ensureTables
│   │           ├── auth/                 # JWT sign/verify, bcrypt, middleware
│   │           ├── prayer/               # adhaan calc, rules engine, hijri
│   │           └── maktab/               # Square API, enrollment, email
│   │
│   ├── tv/                               # @masjid/tv — static SvelteKit kiosk (port 5174)
│   │   ├── svelte.config.js              # adapter-static
│   │   └── src/                          # (hand-written CSS, NO Tailwind)
│   │       ├── routes/display/[masjid_slug]/
│   │       └── lib/                      # components (PrayerBoard, AnalogClock, SoulColumn, etc.), server-clock, frames, board-cycle, ceremony
│   │
│   ├── consumer/                         # @masjid/consumer — static SvelteKit SPA (port 5175)
│   │   ├── svelte.config.js              # adapter-static
│   │   ├── static/                       # manifest.json, icons, sw.js (suicide worker)
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── +page.svelte          # root: "Please Verify Your URL"
│   │       │   ├── [masjid_slug]/        # home, prayer, jumuah, announcements, donate, info, news, pages/[page_slug], posts/[post_slug], maktab
│   │       │   └── +error.svelte
│   │       └── lib/                      # components (PrayerTable, WeeklyPrayerTable, HeroNiche, etc.), api.ts, time.ts, maktab-validation.ts
│   │
│   └── admin/                            # @masjid/admin — static SvelteKit SPA (port 5176)
│       ├── svelte.config.js              # adapter-static
│       └── src/
│           ├── routes/
│           │   ├── login/                # admin login
│           │   ├── register/             # masjid registration
│           │   └── admin/[slug]/         # dashboard, bot, settings/{profile,theme,prayer,jumuah,announcements,posts,maktab,navigation,domain,snapshots,account}
│           └── lib/                      # components (AdminShell, BotChat, DiffReceiptCard, etc.), auth.svelte.ts, api.ts
│
├── workers/
│   ├── gateway/                          # @masjid/gateway — SPA router (_worker.js in merged Pages deploy)
│   ├── whatsapp/                         # @masjid/worker-whatsapp — WhatsApp Zero-UI admin (NOT DEPLOYED)
│   └── push/                             # @masjid/worker-push — push notifications (skeleton, NOT DEPLOYED)
│
├── tooling/
│   ├── setup.js                          # One-shot npm install + svelte-kit sync + seed
│   ├── seed.ts                           # DB seed (Al-Noor + Al-Jabal)
│   ├── merge-pages.js                    # Merge consumer+TV+admin builds → .merged/ for unified deploy
│   ├── deploy-all.js / deploy-pages.js / deploy-workers.js
│   ├── check-schema-drift.ts             # Diff schema.sql vs Drizzle schema (CI gate)
│   ├── check-d1-drift.ts                 # Diff schema.sql vs LIVE D1 database (CI gate)
│   ├── dump-seed-sql.ts                  # Dump seed data as SQL for staging D1 reseed
│   └── schema-parse.ts                   # Schema parsing utility
│
├── vitest.config.ts                      # API unit tests (node)
├── vitest.integration.config.ts          # API integration tests
├── vitest.tv.config.ts                   # TV frontend (jsdom + svelte)
├── vitest.consumer.config.ts             # Consumer frontend (jsdom + svelte)
├── vitest.admin.config.ts                # Admin app (jsdom + svelte)
├── vitest.agent.config.ts                # Agent package (node)
├── vitest.whatsapp.config.ts             # WhatsApp worker (node)
├── vitest.tooling.config.ts              # Tooling scripts (node)
│
├── tests/
│   └── e2e/                              # Playwright browser E2E (helpers.js, run.js, api-client.js, wait-for-deploy.js, *.test.js)
│
└── .github/workflows/                    # CI/CD: deploy.yml, deploy-staging.yml, deploy-staging-only.yml
```