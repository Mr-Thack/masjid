# Regression-Prevention Testing ("Dumb Tests")

Every rule in this document comes from a real bug in this repo's git history
(commit hashes cited as evidence). It complements the other testing docs:

| Doc | Answers |
|---|---|
| `docs/testing.md` | What suites exist and how to run them |
| `docs/integration-testing.md` | How to write deterministic E2E tests |
| `docs/e2e-determinism.md` | Root causes of E2E flakes |
| `docs/deploy-lessons.md` | Production/CI incidents (numbered lessons) |
| **This doc** | **What dumb thing to test so stupid bugs never reach the suite** |

## The meta-lesson: tests that can't fail

The worst escapes in this repo shared one root cause — **the suite was green
while the coverage was fictional**:

- The integrations write path had **zero tests**; the feature shipped in one
  905-line commit (`875602b`) whose only test changes were read-path fixtures.
- ADM-18/19 "tested" create forms that only render after clicking
  "Add Rule"/"Add Session" — silently no-op'd for weeks (lesson 48).
- ADM-33 clicked a "Delete" button whose ConfirmDialog says "Confirm" — the
  item was never deleted, and a fixed 2s sleep masked it (`29c68d2`).
- Square unit tests mocked responses in camelCase to match the wrong code —
  both wrong the same way, all green (lesson 4).

Before writing any test, ask: **"What code change would make this fail?"** If
the answer is "nothing realistic," delete it or rewrite it.

## Case study: how the integrations bug passed 682 tests

Bug: `upsertIntegrationValue()` (`apps/api/src/lib/server/db/index.ts`) UPDATE
filters only by `masjidId` — missing `provider` + `keyName`. Every save
overwrites **all** integration rows for the masjid with the value of the last
key written, so `location_id` lands in `app_id` and `access_token`.

Why the suite didn't catch it:

1. **Write path has zero coverage.** No unit test calls
   `upsertIntegrationValue`; no route test exercises the integrations PUT. The
   ~5 maktab tests that touch the table insert rows directly through Drizzle,
   bypassing the buggy helper.
2. **The read path is correct**, so all read-only tests pass. Corruption only
   appears after a write.
3. **The bug is invisible on first save.** The INSERT branch is fine. A
   hypothetical "PUT once → GET" smoke test would have *passed* — corruption
   requires a second save (the UPDATE branch).

The three tests that would have caught it (each fails deterministically
against the current code):

1. Seed 3 square + 3 brevo rows; call
   `upsertIntegrationValue(db, id, 'square', 'access_token', 'NEW')`; assert
   every other row is byte-identical.
2. Route test: PUT square keys → PUT again with one rotated key → GET → assert
   the other keys survived.
3. Cross-provider isolation: PUT brevo keys only → assert square rows survive.

---

## The bug patterns (from git history)

### 1. Missing WHERE conditions — the blast-radius bug

The integrations bug above. Sibling example: `9ba4854` — prayer-rules reorder
used chained `.where().where()` on a Drizzle UPDATE, which silently matched
**zero** rows (returned 200, changed nothing). Fix: `and(eq(...), eq(...))`
inside a single `.where()`.

### 2. Partial update wipes unrelated fields

The single most repeated product bug — fixed at least 4 times:

| Commit | What happened |
|---|---|
| `a24a4a7` | Maktab settings PUT used `body.x ?? <default>` for every field. Agent sent `{status_message}` only → wiped the active term, closed enrollment, cleared program info + assistance code. |
| `6d4dda5` | `.default()` on ThemeSchema meant `safeParse().partial()` filled defaults into profile saves, overwriting theme data. Also `latitude`/`longitude` missing from `UpdateMasjidSchema` (silently dropped from saves). +30 regression tests added. |
| `b38ae69` | `donateAppeal: z.string().min(1)` rejected the empty string the admin form sends; invalid theme input silently ignored (200, unchanged) instead of 400. |
| `7f937e9` | **Reintroduction of the same class** — `photoUrl`/`logoUrl` had `.min(1)`, breaking "Use default image". |

### 3. Schema drift across three copies of the schema

Always three schemas: `schema.sql`, Drizzle `schema.ts`, and each physical
database.

- Lesson 18: `label_speech` in Drizzle but not `schema.sql` → prod registration 500s.
- Lesson 35: `content` table in both files but never applied to staging D1 → every masjid endpoint 500'd post-deploy.
- Lesson 31 / `efa9ab5`: D1 `.raw()` returns values in **table column order**; Drizzle maps **by position**. Columns added via `ALTER TABLE` land at the end → theme SELECTs silently returned scrambled data.
- `aff0260`: two parallel branches each added `fajr_angle`/`isha_angle` → duplicate columns; `IF NOT EXISTS` made it dormant on existing DBs, so CI was green while fresh worktrees broke.
- `b0df1e6`: the *third* copy (`ensureTables()` embedded DDL) drifted both ways; later eliminated entirely (`d100e56`).
- `a3ad3f3`: `external_donation_url` dropped from schema but left in `schema.sql` **and** the rollback route still writes it.

### 4. Svelte 5 reactivity traps (production-only failures)

Dev's Proxy-based reactivity is lenient; the prod build's compiled signals are
not. These bugs never reproduced locally:

- `31a75ee`: `form = {...}` wholesale reassignment replaced the `$state` proxy → getters returned **property names as values** — the API received the literal strings `"asr_madhab"` and `"high_latitude_rule"`.
- `2b7b035`: `$derived(() => () => {...})` held a function, not the theme → silently fell back to Sakeenah defaults.
- `9d9cd29`: module-level getter consumed by `$derived` wrote `$state` during derivation → `state_unsafe_mutation` in prod only.
- `26d8870` / `13235c7`: `$derived.by()` bodies writing state → same error.
- `be65b16` / `78bda10`: closures capturing variables from two nested `{#each}` scopes never fired as event handlers (reorder buttons dead).
- `4ffb0a7` / `9883ff6`: `checkAuth()` mutated `$state` synchronously before its awaited fetch resolved → infinite loading.

### 5. Dead tests: skips disguised as passes

- Lesson 48: ADM-18/19 looked for create forms that render only after clicking "Add Rule"/"Add Session" — silently no-op'd for weeks.
- `ff008ac`: ADM-20 filled an announcement form without clicking "New" first.
- `29c68d2`: ADM-33 clicked `button:has-text("Delete")` but the dialog says "Confirm" — never deleted.
- `8f18085`: CON-09's expectation updated for a redesign; CON-19 (its SLUG_B twin) missed — stale copy.
- Lesson 4: Square mocks and code both wrong in the same way.
- Lesson 52: API tests passed a discriminatedUnion schema only because they happened to include `kind`; the real frontend's partial updates all 400'd.

### 6. Shared mutable state between tests / cross-job races

From `docs/e2e-determinism.md` + lesson 47:

- ADM-21 ↔ CON-46 raced on `enrollment_open` in parallel CI jobs against the same staging DB.
- UI-driven restores (`saveIfEnabled` silently skipped when `disabled={saving}`) let drift self-perpetuate — one slow request left flipped state, the next run "restored" to the flipped state.
- Suite retry duplicated mutations (double Square subscriptions, UNIQUE-slug 500s).
- Seven mutations shared one `testCase()` — one throw abandoned six in-flight restores.

### 7. Silent failure paths (200s that did nothing)

- `9ba4854`: UPDATE matched zero rows, returned 200.
- `b38ae69`: invalid theme input skipped silently instead of 400.
- Lesson 44: `gotoPage()`'s `expectText` used `.catch(() => {})` — always "succeeded"; the body was empty.
- `2fdaa65`: DB insert succeeded, Square call failed, response still said **201 Created** with an unusable term.
- Lesson 47: `saveIfEnabled` silently skipped when `disabled={saving}`.

### 8. Falsy-value & sentinel traps

- `ec5725c`: `if (!app || !APP_PATHS[app])` rejected the `'api'` probe mode because its sentinel value (`null`) is falsy.
- `a24a4a7`: `?? default` conflating "not provided" with "provide the zero value".
- `cd075dc`: `res.json()` called unconditionally; DELETE returns 204 → parse crash.
- Lesson 54: blind `res.json()` on a Cloudflare plain-text error body → `SyntaxError: Unexpected token 'e'`. Two earlier fixes hardened the wrong layer because the raw SyntaxError was misattributed.

### 9. Cache poisoning / stale caches

- Lesson 25: `_headers` rules **combine** — catch-all `no-store` + `immutable` merged; browsers honored the strictest → immutable caching defeated.
- Lesson 30: cacheable HTML (`s-maxage=604800`) → CDN served the OLD SPA for days after cutover.
- Lesson 34: gateway served SPA shell with 200 for missing JS chunks → browsers parsed HTML as JavaScript → white-screen.
- `admin-cache-poisoning.md`: admin's `static/_headers` had `/*.js immutable` — deleted; canonical headers live only in `tooling/merge-pages.js`.

### 10. Race conditions / time-window bugs in product code

- `fbb2090`: `right_after_adhaan` prayers made the iqaamah-countdown window zero/negative, wrapping into an inverted window covering the entire day ("Maghrib Iqama always showing").
- Soul-column rotation: interval watching `framesList`, which recomputed every second — the effect reset its own timer continuously.
- Lesson 17 / `1eb4eb5` / `407a6b5`: strict prayer-order validation threw a 500 for bad coordinates; NaN times rendered `--:--` at extreme latitudes.

### 11. Environment/runtime detection & build-time constants

- Lesson 1: `typeof process !== 'undefined'` is true in Workers (`nodejs_compat`) — useless as a Node detector.
- Lesson 2: `import.meta.dirname` is `undefined` in Workers → crash.
- Lesson 3: static `import 'better-sqlite3'` executed at module init crashed the Worker even on paths that never used it.
- Lesson 16 / `571b055`: `getDb()` checked the D1 binding before checking Node → local dev silently used mock D1 (a different SQLite file).
- Lesson 8: static SPAs embed `VITE_API_URL` at build time; missing → fetches hit own origin → SPA HTML parsed as JSON.
- `ee08fa7`: one route fetched `/api/v1` relatively, bypassing `VITE_API_URL`; worked locally (Vite proxy), 500'd in prod.
- Lesson 54: Worker fetching its own zone's public URL → Cloudflare error 1042.

### 12. Third-party API contract drift (Square)

Eight commits in one day (`8d5a0b3`, `7f86655`, `8b2f1f6`, `8cdac02`, `9fe6986`,
`203509c`, `2fdaa65`, `f304213`…): camelCase vs snake_case everywhere;
`String(amount)` vs integer cents; `phases` vs `subscription_plan_variations`;
stale API version header; and `203509c` — a **debug token truncation**
(`Bearer ${TOKEN?.slice(0,6)}...`) was left in the actual Authorization
header, so every call 401'd.

### 13. Feature incomplete at the final layer ("wired to nowhere")

- Lesson 53: nav items — admin UI ✓, API ✓, schemas ✓, DB ✓ — **consumer had a hardcoded array**; the pre-built Header/MobileBottomNav were never imported.
- `a1c56db`: agent chat UI shipped without the API routes.
- `efbe02e`: default nav items seeded **on admin page visit** (a side-effecting read!) instead of at registration.
- `08f77c7`: `data.masjidSlug` → `masjidSlug` ('data' is not defined crash) + staging reseed omitted the new `masjid_integrations` table.
- `912f6be`: parallel agents left orphaned code/extra closing braces after a merge.
- `d14865d` / `9947250`: orphaned api-client code + stale E2E paths after renames.

### 14. E2E harness self-inflicted wounds

- Lesson 33/40: `networkidle` on pages with Square SDK → infinite hangs.
- Lesson 41: readiness signals on a **parent** component fire before child content renders.
- Lesson 39: global page-load retries doubled every failure's cost; reverted (`4553370`).
- `f95a287`: `collectPage()` didn't initialize `b.missing` → `.push()` on undefined.
- Pre-hydration form clicks trigger **native** form submits (the `waitForURL` CI flake).
- Fixed `sleep 30` post-deploy replaced by the build-id probe (`8a9d2f8`).

### 15. Dev/prod divergence at the data layer (local mocks that swallow errors)

- The local D1 shim (`getD1Shim` in `apps/api/src/lib/server/db/index.ts`) wrapped every SQL operation in try/catch — `first()` returned `null`, `all()` returned `[]`, `run()` returned `{success: false}`, all without throwing.
- The WhatsApp agent flows use this shim in local dev. Every failed INSERT (missing table, constraint violation) silently no-op'd — the chat flow proceeded, mutations were never stored, confirm reported "0 changes" success. Production D1 throws on SQL errors, so this failure mode was **invisible until deploy**.
- Root cause: the shim was written for the happy path (bridge better-sqlite3 ↔ D1) but copied the *type signatures* without preserving the *error semantics*. A local mock that changes the contract in error paths makes the local loop useless for finding bugs.

**Dumb test**: every local mock/shim for a remote service must preserve error semantics. If the real service throws on invalid SQL, the shim must throw. Add a test that sends deliberately bad SQL and asserts the shim throws (not returns null).

### 16. Stale numeric/format expectations (the "green test, wrong answer")

- The WhatsApp tool count test asserted `toHaveLength(32)`. The tool set grew to 43 (matching AGENTS.md) but the assertion was never updated. Four runner tests asserted the exact string `'Something went wrong'` — commit `29ab505` deliberately changed the error text to `'Error: ${errMsg}'` (more informative), but the tests stayed on the old copy. The suite was documented as "broken" so nobody noticed.
- This is Pattern 5 (dead tests) but with a different failure mode: the assertions are **present and active**, not skipped by a guard, but they assert a value nobody remembers to keep in sync. Exact counts and exact-format strings are the most drift-prone.

**Dumb test**: every exact-count or exact-string assertion should include a comment pointing to the canonical source (e.g., `// AGENTS.md documents 43 MCP tools`). When the source changes, the comment tells you to update the test. Better: assert a floor + specific entries (e.g., `expect(tools.length).toBeGreaterThan(40); expect(tools.find(t => t.name === 'theme_get')).toBeDefined()`).

### 17. Tests that pass for the wrong reason (unscoped queries)

- The merged-branch confirm/cancel tests did `db.select().from(configBranches).where(eq(configBranches.status, 'MERGED')).get()` — no `masjidId` filter. The query picked up a MERGED branch from a **different test masjid** (created by earlier test runs), so the route's ownership check correctly returned 403 instead of the expected 409. The test passed — it got an error — but for the wrong reason (cross-masjid rejection rather than the status check it intended to cover).
- Lesson: when a test asserts an error code from a route that has **multiple rejection checks** (NOT_FOUND → FORBIDDEN → CONFLICT), a query scoped to "any row matching a condition" can silently select a row from the wrong entity, hitting an earlier check and masking the failure. Same bug bit both confirm and cancel tests identically.

**Dumb test**: every test that queries for test fixtures must scope its queries to the entity it created (by ID, masjidId, or other owner column), never by global filter alone. A `get()` without the entity's own PK in the WHERE clause is a red flag.

---

## The dumb-test checklist (prioritized by bug frequency)

| # | Test | Kills patterns |
|---|---|---|
| 1 | **Sibling-rows-unchanged**: after every UPDATE/DELETE helper, seed 3+ rows and assert non-target rows are byte-identical | 1, 2 |
| 2 | **Partial-PUT round-trip**: PUT one field, GET, assert every unmentioned field unchanged | 2 |
| 3 | **Empty-string acceptance**: `parse({field: ''})` must not throw for every optional UI-backed string field | 2, 8 |
| 4 | **Fresh-DB boot**: build a brand-new DB from `schema.sql`, insert one row per table | 3 |
| 5 | **Save-payload assertion**: assert enum fields never equal their own property names; assert request bodies contain valid values | 4 |
| 6 | **Precondition-as-assertion**: no `if (isVisible())` guard without `expect(guard).toBe(true)` | 5 |
| 7 | **Effect-not-status**: after every mutation assert the effect (row count/value changed), never just the status code | 7 |
| 8 | **Atomicity**: mock-fail the external call in a multi-step write, assert NOTHING was persisted | 7 |
| 9 | **Twice-in-a-row**: suite passes identically on rerun without reseed; survives a mid-test kill | 6 |
| 10 | **Built-artifact smoke**: serve `vite build` output, hit one page per app | 4, 11 |
| 11 | **Live sandbox** per external provider (auto-skip without credentials) + diff mocks vs the real API spec | 5, 12 |
| 12 | **Consumer-visible**: every admin setting has one public-page assertion ("does the user see it") | 13 |
| 13 | **404-not-SPA**: missing asset chunk → 404 + no-store, never 200 HTML; SPA HTML → no-store; exactly one cache directive per asset class | 9 |
| 14 | **Degenerate-config property tests**: state machines get iqaamah==adhaan, polar latitudes, NaN times — no negative durations, no 500s | 10 |
| 15 | **204/non-JSON/non-ok**: test all three cases for every HTTP client wrapper | 8 |
| 16 | **Shim/mock error semantics**: every local mock of a remote service must preserve error semantics — deliberately send bad SQL and assert the shim throws, not returns null | 15 |
| 17 | **Query-scoped test fixtures**: every test query that fetches a fixture must filter by the entity's owner column (not just by global status like `status='MERGED'`) — unscoped `.get()` hits the wrong entity | 17 |

## Per-artifact rules (what to write when you write code)

**DB helper (UPDATE/DELETE):** test #1 is mandatory. Every helper in this
codebase that mutates rows gets a test seeding sibling rows + a second
masjid's rows, then asserting untouched.

**Admin PUT endpoint:** tests #2 and #3. Read the current row, apply only
`!== undefined` fields — never `?? default`. Round-trip every field the UI
can send.

**Zod schema:** test #3 plus a diff-test: `UpdateXSchema` keys must cover
every writable column of table X (lat/lng was silently dropped for months).

**Svelte 5 form:** test #5. Mutate `$state` properties in place, never
reassign the proxy. Assert the request body enum values are real values, not
property names.

**Schema change:** run `check-schema` + `check-d1-drift`, and grep the whole
repo (including rollback/snapshot code) for the column name.

**Settings form → consumer feature:** test #12, or the feature is incomplete
by definition.

**E2E mutation:** one `testCase` per mutation, unique per-run names, UI
creates but **API restores in `finally`**. Precondition via API first.
Tests must scope fixture queries by entity owner column — never global
status/type filters that pick up rows from other test entities (#17).

**Local mock/shim:** must preserve the remote service's error semantics
(#16). If production throws on SQL errors, the shim must throw. Test with
deliberately bad input.

**Exact-count or exact-string assertion:** include a comment pointing to
the canonical source. When the source changes, the comment tells you the
test must change too.

**External API integration:** one live sandbox test per provider.

**HTTP client wrapper:** test #15.

## Bottom line

The repo's worst escapes shared one root cause — tests that couldn't fail.
Every high-value test above is deliberately "dumb": it asserts an invariant
so obvious nobody writes it down — until an `UPDATE` without a full WHERE
clause overwrites every integration key in the database.
