# E2E Determinism Restructure Plan

> Status: **implemented & locally verified (2026-08-09)** — full local E2E run
> green on first pass (consumer 82/82, admin 75/75, api/worker/tv/deploy green);
> unit suites green (API 670, admin 230, tooling 23). Staging validation
> happens on the next staging deploy (remote-only paths: probe, 503 windows,
> reseed step).

## 1. Root causes (what the investigation found)

The flakiness is a *system*, not a single bug:

1. **Cross-job state race.** `e2e-consumer` and `e2e-admin` run in parallel CI jobs
   against the same staging DB. **ADM-21** toggles `enrollment_open` off on
   `masjid-al-noor` while **CON-46** needs it open (Square iframes assertion).
   Windows overlap ~4–6 min into both jobs.
2. **Self-perpetuating drift.** ADM-21's restore is best-effort UI clicking
   (`saveIfEnabled` silently skips when the button is `disabled={saving}`). One
   missed restore leaves `enrollment_open=false` in the never-reseeded staging
   DB; the next run "restores" to its own observed (flipped) state. CON-46 then
   fails on *every* run until a manual reseed.
3. **Missing 503 handling in the worker suite.** `api.test.js` retries 503s;
   `worker.test.js`'s `req()` does not — and the `e2e-api` job is the only job
   with no `wait-for-deploy` gate, so it runs inside the post-deploy 503
   propagation window (lesson 36).
4. **Square SDK vs `waitUntil: 'load'` race** in ~14 enroll-page tests (only
   CON-35/46 use `domcontentloaded`).
5. **Transient-5xx sensitivity.** `bust()` cache-busts every remote page load,
   so 3 parallel jobs × prewarms burst one worker; any single ≥400 in a case
   window fails that case (the "random test every run" class).
6. **Whole-suite retry duplicates mutations** (`run.js`): double Square
   subscriptions (CON-46), UNIQUE-slug 500s (ADM-20's fixed title), smoke-masjid
   accumulation (WRK-03).
7. **Seven mutations share one `testCase()`** (ADM-16..22): one throw fails all
   seven and abandons in-flight restores. ADM-18/19 are dead tests (forms never
   opened) whose cleanup paths have never executed.
8. **Admin forms render saveable defaults when the initial GET fails** — a 503
   during ADM-16/17/22's page load means "restore" writes empty/zero values over
   seed data.
9. **Probe gap:** `wait-for-deploy.js` checks the Pages build-id but never the
   API worker's (`/api/v1/status` returns `build_id`; a 200 from a
   mid-propagation *old* worker passes the probe).
10. Minor: `summary` job references nonexistent `needs.e2e-staging`; DEP-02
    self-skips in CI (dead coverage, left as-is).

Ruled out (verified): wall-clock-dependent UI (ceremony overlays, board roll,
hadith rotation, Jumu'ah pinning) — current assertions are presence-based and
safe; seed data has no date-driven state flips.

## 2. Design decisions

- **Mutations become hermetic and self-healing:**
  - Every created entity gets a **unique per-run name** (`E2E ${rand}`) — no
    UNIQUE-slug collisions, no false-positive "already exists" passes.
  - **Creation stays through the UI** (that is what these tests exist to prove),
    but **cleanup/restore moves to direct API calls in `finally` blocks** —
    deterministic, unaffected by DOM flakiness, and runs even when the test body
    throws.
  - Restores read the original value **via API before touching the UI**, then
    PUT it back via API in `finally`.
- **Transient gateway codes are infra noise, not product failures:** response
  statuses `502, 503, 520, 521, 522, 523, 524` from our origins are collected as
  **warnings**, not `failedRequests`. A 503 that actually breaks a page still
  fails via missing expectations; 500/404/4xx remain hard failures (real bugs:
  lesson-35 500s, lesson-34 404s).
- **The staging DB is reseeded on every staging deploy** (structural fix for the
  entire drift/residue class). Local behavior unchanged.
- **No cross-job coordination, no global page-load retries** (both were tried
  and made things worse — lessons 39/history). The race window is closed by fast
  API restores + reseed + a precondition fast-fail, not by serialization.

## 3. Work plan

### P1 — Harness foundations
| Change | File |
|---|---|
| `req()` gets the same 503-retry (×2, 5s) as api.test.js | `tests/e2e/worker.test.js` |
| Transient statuses (502/503/520–524) → `warnings`, not `failedRequests` | `tests/e2e/helpers.js` (`collectPage`) |
| `loginAdmin()` retries once on failure (cold-worker bcrypt) | `tests/e2e/helpers.js` |
| New shared `tests/e2e/api-client.js`: cached `apiLogin()`, `apiGet/Put/Post/Delete` with 503 retry — used by test setup/cleanup | new |
| Probe gains an `api` mode: poll `/api/v1/status` for 200 **and `build_id` match** with `GITHUB_SHA` (when set); also check `build_id` in the existing page probes | `tests/e2e/wait-for-deploy.js` |
| Gate `e2e-api` job with the api-mode probe; fix `summary` job's `needs` | `.github/workflows/deploy-staging.yml` |

### P2 — Consumer suite
| Change | File |
|---|---|
| All `/maktab/enroll` page loads → `waitUntil: 'domcontentloaded'` (CON-06, 12, 13, 22, 31–34, 36–39, 47, 48) | `tests/e2e/consumer.test.js` |
| CON-46 precondition: via API client, assert `enrollment_open` before starting; fail fast with a diagnostic ("staging drift — reseed") instead of the cryptic `total frames: 1` | `tests/e2e/consumer.test.js` |

### P3 — Admin suite restructure
| Change | File |
|---|---|
| Split the single `ADM-16..22` `testCase()` into seven independent `testCase()`s, each with its own context and `try/finally` | `tests/e2e/admin.test.js` |
| ADM-16 (city), ADM-17 (time_format), ADM-22 (label_sunrise): read original via API, restore via API in `finally` | same |
| ADM-21 (enrollment_open): toggle via UI (the thing under test), restore via API `PUT .../maktab/settings` in `finally` | same |
| ADM-20: unique title per run; create via UI; delete by ID via API in `finally` | same |
| ADM-18 / ADM-19: make them real — actually open the create form ("Add Rule" / "Add Session"), unique names, API cleanup in `finally`. If the RuleForm UI flow proves brittle locally, fall back to an explicit `t.skip` with the reason documented (honest, not silently dead) | same |

### P4 — App hardening (admin)
Profile / theme / maktab settings pages currently render a saveable form with
default values when the initial GET fails. Change to: load error → error state,
no saveable form (or save disabled). Prevents the "restore writes zeros over
seed data" catastrophic path. Files: `apps/admin/src/routes/admin/[slug]/settings/{profile,theme,maktab}/+page.svelte`.

### P5 — Staging reseed per deploy
- `tooling/seed.ts` gains a `--sql <file>` mode: seeds a throwaway SQLite DB,
  then emits `DELETE FROM …` (FK-safe order) + `INSERT` statements for every
  seeded table. Idempotent by construction.
- `deploy-staging.yml`: after the worker deploy, run
  `npx tsx tooling/seed.ts --sql … && npx wrangler d1 execute masjid-db-staging --remote --file …`.
  Resets `enrollment_open`, clears `e2e-smoke-*` residue, makes every staging
  E2E run start from identical state.

### P6 — Verification & docs
- `npm run test` (API unit) + `npm run test:admin` + `npm run test:consumer` stay green.
- Full local E2E (`npm run test:e2e`) against dev servers — validates the
  restructured suites end-to-end (remote-only paths: probe/503 handling are
  exercised on the next staging push).
- Update `docs/integration-testing.md` §5.2 (transient-5xx rule, mutation
  discipline, reseed step, api-mode probe) and the AGENTS.md E2E bullet + add
  the cross-job-race lesson.

## 4. Acceptance criteria

1. Two consecutive green staging runs with no weakened assertions.
2. Killing the admin suite mid-ADM-21 (cancel-in-progress) cannot leave
   `enrollment_open=false` — the next deploy reseeds.
3. `run.js` retrying a suite never creates a UNIQUE-constraint 500 or a
   duplicate-entity false positive.
4. Any single case failure message identifies the failing subsystem (API 5xx
   bursts are visible as warnings in output, not case failures).

## 5. Explicit non-goals

- No screenshot/exact-text assertions on time-varying UI (ceremony states,
  board roll, hadith) — out of scope, stays presence-based.
- DEP-02 stays self-skipping in CI (dead coverage; separate fix).
- No cross-job locking/serialization; no reintroduction of global visitPage
  retries.
- Prod E2E stays deploy-integrity-only (decided 2026-08-09, commits
  48ab7d5/25cdc52).

## 6. Latent issues found during implementation (not regressions — pre-existing)

1. **CON-19 was a stale-copy failure** — 8f18085 updated CON-09's info-page
   expectation ("Contact & Location" → "About") but missed CON-19, the SLUG_B
   twin. Fixed.
2. **ADM-17's selectors were stale** — the theme page's time-format buttons
   read "12-hour (1:30 PM)"/"24-hour (13:30)" with `border-accent` active
   class; the test looked for "12h"/"24h" with `border-amber-400`. The old
   `if (has12 || has24)` guard made this invisible for weeks (a skip disguised
   as a pass). Fixed; the precondition is now asserted.
3. **`ensureTables` created `external_donation_url`** on local DBs even though
   the column was dropped from schema.sql and the Drizzle schema (a3ad3f3) —
   removed, so local CREATEs match D1 again.
4. **The announcement DELETE endpoint archives** (`status='archived'`), it
   does not hard-delete. API cleanup therefore leaves inert archived rows;
   the staging reseed wipes them.
5. **Latent API bug (NOT fixed, flagged):** the rollback route
   (`admin/masjids/[id]/rollback/+server.ts:97`) still writes
   `externalDonationUrl` via Drizzle `.set()` — a column no longer in the
   Drizzle schema. Rolling back an OLD snapshot containing
   `external_donation_url` likely 500s. Needs its own fix + test.
6. **`PUT maktab/settings` is a full-row upsert** — omitting
   `active_term_id` nulls it. The E2E restore helper reads the row first and
   PUTs it back whole; any future caller must do the same.
