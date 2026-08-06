# Integration & browser smoke testing

**Status**: LIVE (2026-08-01). All 6 suites implemented and green locally:
`api` (15 cases, 45 assertions), `worker` (5 cases, 11 assertions),
`deploy` (6 cases, remote-only), `consumer` (28 cases, 57 assertions),
`tv` (6 cases, 9 assertions), `admin` (12 cases, 41 assertions). CI workflows exist
(`deploy-staging.yml`, `e2e-prod` job in `deploy.yml`). Only WP7
(human-with-creds rollout checklist) remains.

Read `docs/unified-deploy.md` and the AGENTS.md "Production deployment
lessons" before touching any of this.

## 1. Why this exists

Our unit tests (470 API + 210 TV + 83 consumer + 115 admin + …) all pass, yet
the consumer and admin pages have crashed in production multiple times. Every
one of those incidents falls into a class that **unit tests cannot catch by
construction**:

| # | Failure class | Past incident | Why unit tests miss it |
|---|---|---|---|
| C1 | **Build-time misconfiguration** — `VITE_API_URL` unset/wrong at `vite build` → SPA fetches its own origin → gets HTML → JSON.parse crash | Lesson 8 (AGENTS.md) | jsdom tests mock `fetch`; the bug only exists in the built bundle |
| C2 | **Deploy pipeline drift** — `wrangler deploy` uploads a stale build; merge tolerates a failed app build | Lessons 1, 26 | Tests never touch what was actually deployed |
| C3 | **Edge/runtime-only behavior** — Workers `nodejs_compat`, `import.meta.dirname` undefined, native modules | Lessons 1–3 | Tests run in Node, not workerd |
| C4 | **Header/cache interactions** — `_headers` rules combine; stale CDN cache poisons SPA HTML | Lessons 2, 8, 30 | No browser, no cache semantics in jsdom |
| C5 | **SPA routing on the unified Pages deploy** — wrong SPA served for a path, infinite loops | Lesson 24 | Route→SPA mapping only exists in the merged deploy artifact |
| C6 | **Real-render crashes** — hydration errors, undefined data shapes from the live API, CSS/JS chunk 404s | "consumer page returning 500" incidents | Nothing is prerendered; jsdom ≠ Chromium |
| C7 | **CORS/origin mismatches** — new origin not in `ALLOWED_ORIGINS` | cutover history | API unit tests don't enforce browser origins |

**The fix is one browser-based smoke suite that visits every page in a real
Chromium, fails on ANY uncaught exception / console error / failed request,
and can be pointed at three targets: local dev servers, a staging deployment,
and production.**

The generic error collector (`tests/e2e/helpers.js`) is the heart of the
design. It converts "unforeseen circumstances" into test failures: you don't
need to predict the crash — any page that throws, logs an error, or hits a
4xx/5xx while loading fails the suite.

## 2. Environments and topology

Three targets, one suite, selected by `E2E_ENV` (see `tests/e2e/targets.js`):

| Target | Consumer | TV | Admin | API | Writes? |
|---|---|---|---|---|---|
| `local` (default) | http://localhost:5175 | http://localhost:5174 | http://localhost:5176 | http://localhost:5173 | yes |
| `staging` | https://masjid-staging.pages.dev | same origin, `/display/*` | same origin, `/admin/*` | **https://mapi-staging.mr-thack.workers.dev** | **yes** (disposable DB) |
| `prod` | https://masjid-live.pages.dev | same origin, `/display/*` | same origin, `/admin/*` | https://mapi.mr-thack.workers.dev | no |

Locally the apps are four separate origins (dev servers). Remotely the page
apps share ONE origin with path namespaces (see `docs/unified-deploy.md`).
The target resolver hides this difference. Per-app overrides:
`E2E_CONSUMER_URL`, `E2E_TV_URL`, `E2E_ADMIN_URL`, `E2E_API_URL`.

### 2.1 Staging = full mirror (decided 2026-08-01)

Staging replicates ALL of production, fully isolated:

| Resource | Production | Staging |
|---|---|---|
| API worker | `mapi` → mapi.mr-thack.workers.dev | **`mapi-staging`** → mapi-staging.mr-thack.workers.dev |
| D1 database | `masjid-db` | **`masjid-db-staging`** (separate, disposable) |
| Pages project | `masjid-live` → masjid-live.pages.dev | **`masjid-staging`** → masjid-staging.pages.dev |
| Git branch | `master` | `staging` |
| GitHub environment | `Prod` | `Staging` (+ `CLOUDFLARE_D1_STAGING_ID`) |

Staging pages are built with `VITE_API_URL=https://mapi-staging.mr-thack.workers.dev`.

**Why the API must be in staging too** (this reversed an earlier
pages-only design): a pages-only staging cannot catch the class of
production incident where the API itself broke only in the real runtime:

| API-side incident | Why Node unit tests missed it |
|---|---|
| Workerd-only crashes: `nodejs_compat` polyfills `process`, `import.meta.dirname` undefined, native `better-sqlite3` bundled (lessons 1–3) | Tests run in Node, never in workerd |
| `[assets]` binding missing / not inherited per env → ASSETS undefined → error 1101 (lesson 7) | wrangler.toml is never exercised |
| `db.batch()` atomicity bugs → orphaned rows (lessons 15, 20) | Local dev uses better-sqlite3 transactions, not D1 batch |
| **Schema drift**: Drizzle had `label_speech`, `schema.sql`/D1 didn't → registration 500 in prod (lesson 18) | Local DB comes from `ensureTables()`, prod D1 from `schema.sql` — two sources of truth |
| `--keep-vars`/var handling wiping `LLM_API_KEY` (lesson 27) | Deploy-time behavior |

Consequences (binding):

1. **Staging writes are allowed.** `masjid-db-staging` is disposable:
   mutation cases (WRK-03 registration, admin flows) run on local +
   staging. **Prod stays read-only** (`writes: false`).
2. **The staging D1 is seeded from the local seed dump**, so
   `admin@masjid-alnoor.org` / `password123`, both masjid slugs, and both
   style systems exist there (see §4 for the exact commands).
3. **Square stays in sandbox mode on staging** — never point staging at
   live Square credentials. Brevo/email: staging secrets optional; features
   degrade gracefully without them.
4. **WRK-01 pins `ENVIRONMENT` per target** (`dev`/`staging`/`production`)
   so a misconfigured deploy (or tests accidentally pointed at the wrong
   worker) fails immediately.
5. The WhatsApp/push workers remain OUT OF SCOPE for staging v1.


## 3. Branch & promotion flow

```
feature branches ──merge──▶ staging ────merge (fast-forward)──▶ master
     │                        │                                  │
     │                   CI: check-schema gate               CI: check-schema gate
     │                   deploy mapi-staging +             deploy workers + pages
     │                   masjid-staging pages                   │
     │                        │                                  │
     │                   GATE: test:e2e:staging              POST: test:e2e:prod
     │                   (browser+API, WRITES ok)            (browser+API, READ-ONLY)
     ▼
  local: npm run test:e2e (dev servers) — run before pushing anything
```

Rules:

1. **Nothing merges to `master` unless staging CI is green** on that exact
   commit. Merge staging → master fast-forward where possible so the tested
   commit IS the deployed commit.
2. `e2e-staging` runs AFTER the staging deploy in the same workflow
   (`sleep 30` first — edge propagation, unified-deploy lesson 7). A red
   gate = investigate before promoting; the harness already cache-busts
   (`?cb=`), so two consecutive reds is a real failure.
3. `e2e-prod` runs after the prod deploy as a final job in `deploy.yml`.
   The deploy is already live — a red result pages a human, it does not
   roll back.
4. Agents never deploy (AGENTS.md multi-agent rule 6). Only CI deploys.
5. The whatsapp/agent vitest suites are intentionally NOT in any workflow
   (currently red — missing tokens; tracked separately).

## 4. Rollout checklist (one-time, needs Cloudflare/GitHub creds)

Code-side pieces are DONE (✅): CORS origin added, `[env.staging]` wrangler
block, `deploy-staging.yml` (worker + pages + schema gate), `e2e-prod` job in
`deploy.yml`, `tests/e2e/` harness with API, worker (WRK), and consumer
reference suites green locally.

Remaining infra steps (human with credentials, in order):

1. `npx wrangler d1 create masjid-db-staging` → record the database_id.
2. GitHub: create a **`Staging`** environment with: `CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_STAGING_ID` (from step 1),
   `JWT_SECRET` (a staging-specific value), `SQUARE_ACCESS_TOKEN` /
   `SQUARE_APP_ID` / `SQUARE_LOCATION_ID` (**sandbox** values),
   `BREVO_API_KEY` + `LLM_API_KEY` (optional). `E2E_ADMIN_*` NOT needed —
   staging uses the seeded admin (step 4).
3. GitHub: create `staging` branch from `master` and push — the workflow
   deploys the worker (first run creates `mapi-staging`) and the pages
   project (first run creates `masjid-staging`).
4. Seed the staging D1 (canonical D1 schema FIRST, then data — do NOT
   import the local dev schema; lesson 18 is about exactly that drift):
   ```bash
   npm run setup                                    # fresh seeded .masjid/local.db
   npx wrangler d1 execute masjid-db-staging --remote --file=schema.sql
   sqlite3 .masjid/local.db .dump | grep '^INSERT INTO' > /tmp/masjid-seed-data.sql
   npx wrangler d1 execute masjid-db-staging --remote --file=/tmp/masjid-seed-data.sql
   ```
   Verify: `curl https://mapi-staging.mr-thack.workers.dev/api/v1/masjids/masjid-al-noor`
   returns prayer times, and WRK-04's seeded login works.
5. Verify staging like prod (`docs/unified-deploy.md` §Verification):
   route→SPA hashes, cache headers, CORS from the staging origin, rendered
   content in a real browser.
6. Re-seed policy: whenever staging data gets messy (each e2e run leaves an
   `e2e-smoke-*` masjid), re-run step 4 on a fresh database:
   `npx wrangler d1 delete masjid-db-staging` is NOT required — instead
   `npx wrangler d1 execute masjid-db-staging --remote --command="DELETE FROM masjids WHERE slug LIKE 'e2e-smoke-%'"`.
7. Known data difference: prod's `masjid-al-noor` is Sakeenah (local/staging
   seed is Mishkaat). Cases must assert environment-agnostic contracts
   remotely (the catalog marks these).

## 5. Test suite architecture (implemented)

### 5.1 Layout

```
tests/e2e/
  targets.js          — E2E_ENV resolution, slugs, credentials guard, allowedApiOrigins,
                        expectedEnvironment (dev/staging/production)
  helpers.js          — reporter, launchBrowser, collectPage, visitPage, explain
  api.test.js         — API-01..15 (no browser) — 45 assertions, green
  worker.test.js      — WRK-01..05: runtime health, registration smoke, login
                        round-trip, schema-drift guard — 11 assertions, green
  consumer.test.js    — CON-01..28 — 57 assertions, green
  deploy.test.js      — DEP-01..06 (remote only) — 0 assertions (remote-only), green
  tv.test.js          — TV-01..06 — 9 assertions, green
  admin.test.js       — ADM-01..12 — 41 assertions, green
  run.js              — runs existing suites in order api→worker→deploy→consumer→tv→admin,
                        --suite=<name> flag, exit code
```

Plain Node + Playwright, same style as the existing
`apps/consumer/tests/sw-integration.test.js` (chromium.launch, hand-rolled
assert, PASS/FAIL output, exit code). **Do NOT adopt @playwright/test.**
Playwright is a hoisted devDependency, importable from the repo root.

Root scripts (already in `package.json`):

```json
"test:e2e": "node tests/e2e/run.js",
"test:e2e:staging": "E2E_ENV=staging node tests/e2e/run.js",
"test:e2e:prod": "E2E_ENV=prod node tests/e2e/run.js"
```

### 5.2 Harness contract (`helpers.js`)

Every page visit goes through `visitPage` (one-shot) or `collectPage`
(multi-step). Buckets, all of which must be empty for `r.ok`:

| Bucket | What it catches | Class |
|---|---|---|
| `pageErrors` | uncaught exceptions (`pageerror` event) — THE crash detector | C6 |
| `consoleErrors` | `console.error` (incl. resource-load failures with URLs) | C1, C6 |
| `failedRequests` | same-origin/API responses ≥ 400 | C1, C6 |
| `missing` | expected text/selector never appeared | C6 |
| `badApiOrigins` | `/api/*` requests to an origin other than the API (locally: API or page proxy origin) — the VITE_API_URL-misbuild detector | C1 |

Encoded rules: remote URLs get an automatic `?cb=` cache-buster; noise
allowlist (favicon, Vite dev chatter, Square SDK CSP font noise) lives ONLY
in `helpers.js`; third-party ≥400s are warnings, not failures;
`allowFailures: [RegExp]` per test marks expected failures (e.g. the
deliberate unknown-masjid 404); `expectTextCI` exists for CSS-uppercased
text.

**Determinism contract (2026-08-05 rework).** The suite previously relied on
fixed `waitForTimeout` sleeps (too long on the happy path, too short on a
loaded CI runner) and let any thrown timeout kill the whole suite process
with a bare stack trace. The reworked rules:

1. **`testCase(t, id, fn)` wraps EVERY case.** A thrown timeout/error becomes
   a FAIL line (with the Playwright "waiting for" detail) and the rest of the
   suite keeps running. Stray `unhandledRejection`s also become FAIL lines.
2. **Condition-based waits only.** `waitForHydration(page)` (the apps set
   `html[data-hydrated]` on first mount), `waitForContent(page)` (`<main>`
   children or any body text — admin /login has no `<main>`),
   `settlePage(page, buckets, maxMs)` (adaptive: exits after 500ms of network/
   console/error silence, capped at maxMs, default 2s), and `gotoPage(...)`
   (goto + hydration + optional expectation + settle) for multi-step flows.
   Fixed sleeps are allowed ONLY as stress pacing (rapid-nav cadence, typing
   debounce), never as readiness guesses.
3. **Timeout ceilings**: navigation 30s, hydration 30s, expectation 15s,
   login navigation 45s, adaptive settle ≤2s. `visitPage` runs all text/
   selector expectations CONCURRENTLY (a missing N expectations cost one
   15s ceiling, not N × 15s). visitPage's own pacing waits are short
   (12s/5s, swallowed) because known-blank error pages never hydrate.
4. **One real login per admin run** (`loginAdmin(page, cfg)`): hydration is
   awaited BEFORE touching the form (a pre-hydration click triggers a NATIVE
   form submit — that was the `waitForURL('**/admin/**')` CI flake), and
   `waitForURL(..., { waitUntil: 'commit' })` is registered BEFORE the submit
   click. ADM-03 captures `context.storageState()` (the JWT lives in
   localStorage, which storageState preserves); every later authed case opens
   `newContext(browser, { storageState })` — no re-login races or bcrypt
   latency per case.
5. **Suite watchdog**: `E2E_SUITE_WATCHDOG_MS` (default 8 min) aborts a stuck
   suite with the in-flight case name — a suite can never hang a CI job
   silently. All non-browser fetches use `AbortSignal.timeout` and return
   `status: 0` on failure (a hung API = FAIL line, not a hang).
6. **Per-suite + per-case timing** is printed in every summary (slowest 3
   cases), and `run.js` prints a suite-timings rollup. Multiple
   `--suite=<name>` flags are honored (CI splits suites across parallel jobs).

## 6. Test catalog

**`docs/integration-test-cases.md` is the authoritative list**: ~50 cases
(API-01..08, WRK-01..05, DEP-01..06, CON-01..16, TV-01..04 + meta,
ADM-01..08 + meta), each with exact steps, exact verified assertion strings,
env guards, priority, failure class, and status (IMPLEMENTED/PENDING). It
also contains the two copy-paste code shapes and the binding rules.
Implement cases exactly as specced there; update statuses as they land.

## 7. Conventions for every agent

1. **Read first**: this file, `docs/integration-test-cases.md`,
   `docs/unified-deploy.md`, AGENTS.md (deployment lessons + multi-agent
   worktree rules), and the reference suites `tests/e2e/api.test.js` /
   `consumer.test.js`.
2. **One worktree, one branch per agent** (AGENTS.md §Multi-agent). Merge
   via branch, never copy files.
3. **All page visits through the shared harness.** Extend `helpers.js`
   rather than bypassing it — error-collection logic must not fork.
4. **Determinism**: no wall-clock-dependent assertions; fixed sleeps only as
   stress pacing (never as readiness waits — use the condition-based helpers
   in §5.2); remote URLs are cache-busted by the harness.
5. **No remote writes**: anything that submits/creates/updates is guarded
   by `cfg.writes` (local only). Anything needing auth is guarded by
   `cfg.adminEmail`.
6. **Verify before asserting**: run the page, confirm the expected
   text/selector, THEN write the assertion. Never assert from imagination.
7. **Done means green twice**: suite green locally AND
   `node tests/e2e/run.js` green overall; statuses updated in the catalog.
8. **Ports are shared** (AGENTS.md rule 5): stagger dev-server usage
   between agents. `api.test.js` and `deploy.test.js` can run against
   staging without any local servers.
9. **Update the docs** when you find drift (renamed text, new routes, new
   noise). The catalog is the swarm's contract.

## 8. Swarm work packages (updated post-implementation)

| WP | Scope | Status |
|---|---|---|
| WP0 | CORS origin, wrangler `[env.staging]`, workflows (worker+pages+schema gate), harness, targets, runner, npm scripts | ✅ DONE (2026-08-01) |
| WP1 | `api.test.js` (API-01..15) | ✅ DONE — 45 assertions green locally |
| WP1b | `worker.test.js` (WRK-01..05) | ✅ DONE — 11 assertions green locally |
| WP2 | `consumer.test.js` CON-01..28 | ✅ DONE — 57 assertions green locally |
| WP3 | `deploy.test.js` (DEP-01..06) | ✅ DONE — 6 cases, remote-only, self-skips locally |
| WP4 | `consumer.test.js` CON-17..28 (extended coverage) | ✅ DONE — 57 assertions total green locally |
| WP5 | `tv.test.js` (TV-01..06) | ✅ DONE — 9 assertions green locally |
| WP6 | `admin.test.js` (ADM-01..12) | ✅ DONE — 41 assertions green locally |
| WP7 | Rollout checklist §4 (D1 create/seed, GitHub env, staging branch — human with creds), then flip catalog/doc statuses | PENDING |

WP3–WP6 can run in parallel worktrees (disjoint files; WP4/WP2 same file
so sequence those). Merge order: WP4 before/after WP3–6 in any order.

## 9. Appendix — incident → test mapping (regression proof)

| Historical incident | Now caught by |
|---|---|
| VITE_API_URL unset → consumer crash (lesson 8) | DEP-05 + `badApiOrigins` on every browser case |
| Stale build deployed (lessons 1, 26) | DEP-02 |
| `_headers` combine defeats immutable caching (lesson 2, 25) | DEP-03 exact-match |
| SPA HTML cached at CDN for 7 days (lesson 30) | DEP-01 `no-store` assertion + harness `?cb=` |
| Wrong SPA for a path after unified cutover (lesson 24) | DEP-01/DEP-06 + per-app render cases |
| SW cache poisoning / stale consumer shell | CON-16 (ported SW suite) + DEP-04 |
| Admin page crash post-deploy (cache poisoning doc) | ADM-04 full settings sweep under the zero-error harness |
| **Workerd-only crash (nodejs_compat / import.meta.dirname / native modules, lessons 1–3)** | **WRK-01/02 against the real staging worker** |
| **wrangler.toml env misconfig (assets binding not inherited, lesson 7)** | **WRK-01 + first staging deploy (real config exercised)** |
| **db.batch atomicity / orphaned rows (lessons 15, 20)** | **WRK-03 registration smoke on real D1** |
| **Schema drift → registration 500 in prod D1 (lesson 18)** | **WRK-03 (runtime) + WRK-05 + `check-schema` CI gate in BOTH workflows** |
| **Var wiping at deploy (`--keep-vars`, lesson 27)** | **WRK-01 ENVIRONMENT pin + staging deploy using the same loop-built `--var` pattern** |
| Worker-only crash detected via pages | TV/consumer cases against the real worker |
| New origin breaks CORS (staging project) | API-07/08 + staging browser cases running cross-origin for real |
| Unknown masjid white-screens | CON-05, TV-04 |
