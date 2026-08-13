# E2E Determinism Restructure Plan

> Status: **shipped & validated (2026-08-12)** — determinism restructure
> (P1–P6) landed, staging hang diagnosed as CF daily-limit soft-throttling
> (94K/100K requests), cold-isolate D1 ops cut 33→9, gateway subrequest waste
> eliminated, prewarm/retry removed, pipeline fully green across all 6 suites.
> Further resilience rules added 2026-08-12 in `docs/integration-testing.md` §5.2.

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

## 7. Handoff — where we stopped (2026-08-09 evening)

### What's shipped and verified

- All P1–P5 work is on `master` (`5eea220`, `ec5725c`) and `staging`
  (`227bda9`, `fd2f7dc`). Both pushed. **Do not push to staging again until
  the hang below is understood — staging pushes burn CF quota.**
- Staging run 31339626631 (restructured pipeline): deploys ✓, **staging D1
  reseed worked** ✓, `e2e-api` behind the new api-mode probe ✓ (1m2s),
  `e2e-deploy` ✓, `e2e-tv` ✓, `e2e-admin` ✓ (3m8s — the restructured
  mutation tests, API restores and all, passed on staging first try).
  Only `e2e-consumer` failed — and it failed on infra, not test logic.

### The open issue: staging worker intermittently HANGS requests

**Evidence.** During/after that run, ~25% of requests to
`mapi-staging.mr-thack.workers.dev` never return (curl gave up at 40s);
the rest answer in ~500ms. Measured 2026-08-09 ~23:00 UTC from a dev
machine, against BOTH `/api/v1/masjids/masjid-al-noor` AND the trivial
`/api/v1/status` (which only does `SELECT 1` on D1). **Prod `mapi` does not
hang** (6/6 fast). The failing E2E cases match this exactly: pages render
*nothing* (body innerText 0 chars) with **no pageErrors, no failedRequests,
no warnings** — the layout `load()`'s fetch stays pending until the context
closes, so the buckets see nothing.

**What this rules out:** test-harness bugs (reproduced with raw curl, no
Playwright involved), page-specific bugs (different cases fail each run),
CDN/Pages (the SPA shell and chunks load fine — it's the API call that
hangs), and the consumer app itself (unchanged in this deploy).

**Prime suspects, in order:**

1. **CF account daily-limit exhaustion / throttling.** The failures began
   late in a day full of staging deploys + E2E runs (every remote page load
   is cache-busted, so all traffic hits the worker). The "heals over time,
   relapses under load" shape fits account-level limiting. Check: CF
   dashboard → account usage page for 2026-08-09.
2. **Staging D1 in a bad state after the first-ever reseed.** The hangs
   started with the deploy that introduced the reseed step. `SELECT 1`
   hanging points below the query layer — connection/session handling on a
   freshly-rewritten DB. Check: D1 metrics for `masjid-db-staging`
   (query latency/errors), and whether hangs correlate with `build_id`.
3. **Worker CPU-time limiting on the free tier** (10ms default) — the page
   payload computes prayer times. But `/status` is cheap and also hangs, so
   this alone doesn't explain it.
4. Mixed-version propagation serving a sick old version — the api-mode probe
   says no (build_id matched), but hung requests never return a build_id, so
   it can't be fully excluded without per-request logs.

**What we need tomorrow:** the user can expose CF request logs (Workers
Observability is enabled on the workers — `[observability] enabled = true`)
or paste dashboard output. Specifically: (a) Workers Logs for `mapi-staging`
during a hang window — does the request reach the worker at all, or is it
shed before invocation? (b) D1 metrics for `masjid-db-staging`;
(c) account-level usage/limits page. If logs show requests never arriving,
it's account limiting; if they arrive and stall at the D1 call, it's (2).

**Repro (takes 1 min):**
```bash
for i in $(seq 1 12); do
  start=$(date +%s%N)
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 40 \
    "https://mapi-staging.mr-thack.workers.dev/api/v1/status?cb=$i-$RANDOM")
  echo "$code in $(( ($(date +%s%N)-start)/1000000 ))ms"
done
```
000 = hang. If tomorrow this returns 12×200, it was quota/limits — re-run
the staging pipeline (workflow_dispatch) and it should go green.

### 2026-08-13 update — relapse is egress-specific, not account-wide

Run 31655884481 (deploy of `ee08fa7`): `e2e-api` ✓ (42s), `e2e-admin` ✓,
`e2e-tv` ✓, `e2e-deploy` ✓ — but `e2e-consumer` hung across **three
consecutive attempts** (00:54, 01:08, 01:22 UTC), each time with a
*different* random case set (CON-07/10/15b/17/21, then CON-03/10/11/14/15,
then CON-08/14/15b/26), bucket-clean missing-text failures, watchdog abort
at 480s. New evidence that reshapes the diagnosis:

1. **The probe itself saw worker hangs from the CI runner** — attempt 2:
   `api /api/v1/status → 0 (timeout)` twice, interleaved with clean rounds,
   while the Pages page-checks passed. So CI→worker hangs, CI→Pages fine.
2. **Same window, same worker, other runners green**: `e2e-admin` made
   dozens of authed worker calls (00:54–00:57) while `e2e-consumer`'s
   runner hung. So the throttle keys on the runner's egress IP/colo, not
   the account.
3. **Dev machine was 100% healthy throughout**: 12×200 + 8×200 sequential,
   then 30/30 under full concurrency against the worker, 30/30 against
   Pages — measured while CI attempt 3 was hanging.
4. The UTC day rolled over before the first attempt (00:52 UTC), so a
   midnight-reset daily quota doesn't fit either (rolling-24h still
   possible but weakened by 1–3).

Working theory: Cloudflare sheds/queues worker invocations for parts of the
GitHub Actions IP pool under burst (the consumer suite is the heaviest:
~50 cold browser contexts × shell+chunks+API). The CF-side ask from §7
stands — Workers Logs for `mapi-staging` during 00:54–01:32 UTC would
settle whether hung requests reach the worker at all. Note: the admin fix
validation (ADM-22) DID land green on staging in this run; the consumer
suite's CON-51 validation is only blocked by this infra issue, not by the
fix (proven locally + by the `badApiOrigins` mechanism).

### Remaining work, in order

1. **Resolve the staging hang** (above). If it was quota: nothing to fix in
   code; consider trimming E2E request volume later (e.g. fewer prewarm
   URLs) if the daily limit is a recurring constraint. Also consider
   disabling the `run.js` whole-suite retry on staging — it doubles quota
   burn on real failures and only helps genuine CDN chunk-404 edge cases
   (lesson 46).
2. **Re-run the staging pipeline** (`workflow_dispatch` on
   `deploy-staging.yml`, no push needed) and confirm all six jobs green —
   that completes the acceptance criteria in §4.
3. **Only then** consider master → staging merges for other work, and much
   later a prod promotion (manual `Deploy to Cloudflare`).
4. Optional follow-ups (not blocking): fix the rollback route's
   `externalDonationUrl` write (§6.5); decide whether DEP-02 should run in
   CI; the `mkt_settings.assistance_code` local-vs-D1 column-order note
   (cosmetic, verified safe per lesson 35 tooling).
