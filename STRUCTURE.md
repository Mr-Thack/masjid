masjid/
├── .gitignore
├── .prettierrc
├── AGENTS.md
├── Background.md
├── README.md
├── package.json                          # npm workspaces root
├── tsconfig.base.json                    # shared TS compiler options
├── eslint.config.js                      # shared lint rules
├── schema.sql                            # D1 schema (reference only)
│
├── docs/
│   ├── api.md
│   ├── rules-engine.md
│   └── mcp-integration.md
│
├── packages/
│   └── schemas/                          # shared Zod + TS types (consumed by all workspaces)
│       ├── package.json                  # name: @masjid/schemas
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                  # barrel re-export
│           ├── masjid.ts                 # masjid profile, settings
│           ├── prayer.ts                 # prayer-time config, rules
│           ├── announcement.ts           # announcements
│           ├── jumuah.ts                 # jumuah sessions
│           ├── admin.ts                  # admin auth (login, register)
│           ├── domain.ts                 # custom_domains
│           ├── common.ts                 # pagination, error shape, shared helpers
│           └── generated.ts              # (future) generated from MCP introspection
│
├── apps/
│   ├── api/                              # SvelteKit → Cloudflare Workers (API engine)
│   │   ├── package.json                  # name: @masjid/api
│   │   ├── tsconfig.json
│   │   ├── svelte.config.js
│   │   ├── vite.config.ts
│   │   ├── wrangler.toml                 # D1 bindings, KV bindings, env vars
│   │   ├── drizzle.config.ts             # Drizzle ORM config
│   │   └── src/
│   │       ├── app.d.ts                  # SvelteKit app types
│   │       ├── hooks.server.ts           # JWT auth middleware, CORS
│   │       ├── routes/
│   │       │   ├── api/
│   │       │   │   └── v1/
│   │       │   │       ├── masjids/
│   │       │   │       │   ├── [id]/                         # admin (JWT required)
│   │       │   │       │   │   ├── +server.ts                # GET/PATCH masjid profile
│   │       │   │       │   │   ├── admin/
│   │       │   │       │   │   │   └── +server.ts            # PUT admin password
│   │       │   │       │   │   ├── prayer/
│   │       │   │       │   │   │   ├── +server.ts            # GET/PATCH prayer config
│   │       │   │       │   │   │   └── rules/
│   │       │   │       │   │   │       ├── +server.ts        # GET all rules / POST new rule
│   │       │   │       │   │   │       └── [rule_id]/
│   │       │   │       │   │   │           └── +server.ts    # PATCH / DELETE rule
│   │       │   │       │   │   ├── jumuah/
│   │       │   │       │   │   │   └── +server.ts            # GET all / POST new
│   │       │   │       │   │   │   └── [session_id]/
│   │       │   │       │   │   │       └── +server.ts        # PATCH / DELETE session
│   │       │   │       │   │   ├── announcements/
│   │       │   │       │   │   │   └── +server.ts            # GET all / POST new
│   │       │   │       │   │   │   └── [announcement_id]/
│   │       │   │       │   │   │       └── +server.ts        # PATCH / archive / pin
│   │       │   │       │   │   └── domains/
│   │       │   │       │   │       └── +server.ts            # GET all / POST new
│   │       │   │       │   │       └── [domain_id]/
│   │       │   │       │   │           └── +server.ts        # DELETE / verify
│   │       │   │       │   └── [slug]/                        # public (no auth, KV-cached)
│   │       │   │       │       ├── +server.ts                # GET masjid public profile
│   │       │   │       │       ├── prayer/
│   │       │   │       │       │   └── +server.ts            # GET daily/weekly prayer times
│   │       │   │       │       ├── jumuah/
│   │       │   │       │       │   └── +server.ts            # GET upcoming jumuah
│   │       │   │       │       └── announcements/
│   │       │   │       │           └── +server.ts            # GET feed + pinned
│   │       │   │       └── auth/
│   │       │   │           ├── register/
│   │       │   │           │   └── +server.ts                # POST register (create masjid + admin)
│   │       │   │           └── login/
│   │       │   │               └── +server.ts                # POST login → JWT
│   │       │   └── webhooks/
│   │       │       └── stripe/
│   │       │           └── +server.ts                        # POST Stripe webhook
│   │       └── lib/
│   │           ├── server/
│   │           │   ├── db/
│   │           │   │   ├── index.ts          # D1 client init
│   │           │   │   ├── schema.ts         # Drizzle schema definitions
│   │           │   │   └── migrations/       # Drizzle-generated SQL migrations
│   │           │   ├── auth/
│   │           │   │   ├── jwt.ts            # sign / verify JWT
│   │           │   │   ├── password.ts       # bcrypt hash / compare
│   │           │   │   └── middleware.ts     # extract + validate JWT from request
│   │           │   ├── prayer/
│   │           │   │   ├── adhaan.ts         # astronomical calculation
│   │           │   │   ├── engine.ts         # rules evaluator (sequential apply)
│   │           │   │   ├── hijri.ts          # Gregorian → Hijri conversion
│   │           │   │   └── cache.ts          # KV cache helpers (read/write/invalidate)
│   │           │   ├── cache.ts              # generic KV cache helpers
│   │           │   └── stripe.ts             # Stripe webhook handler
│   │           └── shared/                   # re-exports from @masjid/schemas
│   │               └── index.ts
│   │
│   ├── tv/                                  # SvelteKit → Cloudflare Pages (static TV display)
│   │   ├── package.json                     # name: @masjid/tv
│   │   ├── tsconfig.json
│   │   ├── svelte.config.js                 # adapter-static
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── app.css
│   │   ├── app.html
│   │   └── src/
│   │       ├── app.d.ts
│   │       ├── routes/
│   │       │   └── display/
│   │       │       └── [masjid_slug]/
│   │       │           ├── +page.svelte      # full-screen prayer board
│   │       │           └── +page.ts          # load() → fetch public API
│   │       └── lib/
│   │           ├── components/
│   │           │   ├── PrayerBoard.svelte    # main prayer times grid
│   │           │   ├── Announcement.svelte   # pinned announcement banner
│   │           │   ├── Countdown.svelte      # next-prayer countdown
│   │           │   └── JumuahNotice.svelte   # Friday jumu'ah info
│   │           └── api.ts                    # typed fetch wrapper for public API
│   │
│   └── consumer/                            # SvelteKit → Cloudflare Pages (PWA for users)
│       ├── package.json                     # name: @masjid/consumer
│       ├── tsconfig.json
│       ├── svelte.config.js                 # adapter-static + adapter-cloudflare hybrid
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── app.css
│       ├── app.html
│       ├── static/
│       │   ├── manifest.json                # PWA manifest
│       │   ├── icon-192.png
│       │   └── sw.js                        # service worker (push notifications)
│       └── src/
│           ├── app.d.ts
│           ├── routes/
│           │   └── [masjid_slug]/
│           │       ├── +layout.svelte       # masjid-branded shell (colors, logo)
│           │       ├── +layout.ts           # load masjid profile + theme tokens
│           │       ├── +page.svelte          # home: today's prayer times
│           │       ├── +page.ts
│           │       ├── prayer/
│           │       │   └── +page.svelte      # weekly/monthly timetable
│           │       ├── announcements/
│           │       │   └── +page.svelte      # announcement feed
│           │       ├── jumuah/
│           │       │   └── +page.svelte      # upcoming jumu'ah sessions
│           │       └── donate/
│           │           └── +page.svelte      # Stripe-hosted donation flow
│           └── lib/
│               ├── components/
│               │   ├── MasjidShell.svelte    # branded header/footer
│               │   ├── PrayerCard.svelte     # single prayer time card
│               │   ├── PrayerList.svelte     # list of today's prayers
│               │   ├── AnnouncementCard.svelte
│               │   └── DonateButton.svelte
│               └── api.ts                    # typed fetch wrapper for public API
│
├── workers/
│   └── push/                                # standalone Cloudflare Worker (push notifications)
│       ├── package.json                     # name: @masjid/worker-push
│       ├── tsconfig.json
│       ├── wrangler.toml                    # cron trigger, D1 bindings, web-push secrets
│       └── src/
│           ├── index.ts                     # scheduled() handler (fetch + push)
│           └── notify.ts                    # web-push send logic
│
└── tooling/                                 # (optional) scripts, seed data, etc.
    ├── seed.ts                              # seed D1 with test data
    └── sync-schemas.ts                      # (future) generate MCP tool defs from Zod