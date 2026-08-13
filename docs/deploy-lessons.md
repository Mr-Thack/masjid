# Production Deployment Lessons

54 hard-earned lessons from live production incidents on Cloudflare Workers + Pages.
Every one was a real outage or near-miss. Read the relevant section before touching
deploy scripts, CI workflows, E2E tests, or the API worker.

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
(see `docs/unified-deploy.md` § "API worker manual deploy" for the copy-paste block).

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

**Pitfall**: The post-engine's `content` table existed in both `schema.sql` and
the Drizzle schema, so the CI "Schema drift check" passed — but the staging
D1 had never had `CREATE TABLE content` applied, and every masjid endpoint
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
