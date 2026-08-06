# Integration test cases — swarm work order

**Companion doc**: `docs/integration-testing.md` (strategy, environments, CI).
This file is the authoritative, enumerated list of every browser/API smoke
test case, written so an agent with no project context can implement a case
end-to-end without inventing anything.

- **Harness + API/worker/consumer suites already exist** in `tests/e2e/`
  (implemented 2026-08-01, green locally: 174 assertions). Cases marked
  **IMPLEMENTED** show the pattern to copy. Cases marked **PENDING** are the
  swarm's work.
- Every expected string below was verified against the real components or a
  live page on 2026-08-01. If a string has drifted when you implement a case,
  fix the expectation, note it in your hand-off, and update this doc.

## How to read a case

```
### CON-07 — Announcements page renders
Suite: consumer | Env: all | Priority: P1 | Status: PENDING
Failure class: C6 (real-render crash)
Preconditions: local — dev servers on 5173+5175, seeded DB. remote — deploy live.
Steps:
  1. visitPage(browser, cfg, `${cfg.consumer}/${SLUG_A}/announcements`,
               { expectText: '...' })
Assertions:
  - r.ok === true
Notes:
  ...
```

`SLUG_A` = `masjid-al-noor`, `SLUG_B` = `masjid-al-jabal`,
`SLUG_UNKNOWN` = `definitely-not-a-masjid` (import from `targets.js`).

## The one pattern (copy this)

Every browser case is one of two shapes. **Do not invent a third.**

### Shape A — one-shot page check (90% of cases)

```js
import { createReporter, launchBrowser, visitPage, explain } from './helpers.js';
import { targets, SLUG_A } from './targets.js';

const cfg = targets();
const t = createReporter(`Consumer [${cfg.env}] → ${cfg.consumer}`);
const browser = await launchBrowser();

// CON-07 — announcements page renders
{
  const r = await visitPage(browser, cfg, `${cfg.consumer}/${SLUG_A}/announcements`, {
    expectText: 'Announcements',            // string or string[]; exact case
    // expectTextCI: ['Fajr'],              // use for CSS-uppercased text
    // expectSelector: '.some-class',       // waits up to 15s for visibility
    // allowFailures: [/some-expected-404/], // expected failed requests
  });
  t.assert(r.ok, `CON-07 renders clean ${r.ok ? '' : '— ' + explain(r)}`);
}

await browser.close();
process.exit((await t.done()) > 0 ? 1 : 0);
```

`r.ok` is true ONLY when ALL of these are empty: `pageErrors` (uncaught
exceptions — the crash detector), `consoleErrors`, `failedRequests`
(same-origin/API ≥400), `missing` (expected text/selector not found),
`badApiOrigins` (any `/api/*` request that did NOT go to the API origin —
the VITE_API_URL-misbuild detector). You almost always assert `r.ok` plus
optionally one extra bucket.

### Shape B — multi-step flow (login, navigation)

Use when the case has clicks/form fills. Attach collectors BEFORE `goto`:

```js
import { collectPage } from './helpers.js';

const context = await browser.newContext();
const page = await context.newPage();
const b = collectPage(page, cfg); // buckets mutate live as the page runs

await page.goto(`${cfg.admin}/login`, { waitUntil: 'load', timeout: 30000 });
await page.fill('input[type="email"]', cfg.adminEmail);
await page.fill('input[type="password"]', cfg.adminPassword);
await page.click('button[type="submit"]');
await page.waitForURL('**/admin/**', { timeout: 15000 });
await page.waitForTimeout(1500); // let the dashboard settle

t.assert(b.pageErrors.length === 0, `ADM-03 no uncaught exceptions — ${JSON.stringify(b.pageErrors)}`);
t.assert(b.failedRequests.length === 0, `ADM-03 no failed requests — ${JSON.stringify(b.failedRequests)}`);
await context.close();
```

### Guards you must use

```js
// Auth cases (credentials: local + staging use the SEEDED admin
// admin@masjid-alnoor.org/password123 — staging D1 is seeded from the local
// dump. Prod uses E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD, else SKIP):
if (!cfg.adminEmail) { t.skip('ADM-03', 'no admin credentials for this env'); }
else { ...auth test... }

// Write cases (local + staging only — staging's masjid-db-staging is
// disposable; PROD IS ALWAYS READ-ONLY):
if (!cfg.writes) { t.skip('ADM-XX', 'read-only env'); }
else { ...write test... }
```

### Rules (binding for every agent)

1. ALL page visits via `visitPage` or `collectPage`. Never attach your own
   `pageerror`/`console` listeners. Extend `helpers.js` if something is
   missing (one shared allowlist lives there).
2. No `waitForTimeout` longer than 5s. Prefer `expectSelector`/`expectText`.
3. No assertions on wall-clock-dependent UI (which prayer is "current",
   countdown values, ceremony states). Presence + zero-error only.
4. No `data-testid` additions to components unless text is genuinely
   ambiguous — and if you add one, record it in the case's Notes here.
5. Remote URLs are cache-busted automatically by the harness (`?cb=`). Do
   not add your own.
6. Verify the expected string on a running page BEFORE writing the
   assertion (`curl` the API, or open the dev page). Never assert from
   imagination. If reality differs from this doc, the doc is stale — fix
   the doc.
7. A case is DONE when: it passes locally (`node tests/e2e/<suite>.test.js`
   with dev servers up), its Status row here says IMPLEMENTED, and
   `node tests/e2e/run.js` is still green.

---

## Suite: API (no browser) — `tests/e2e/api.test.js`

**Status: ALL 8 IMPLEMENTED + green locally (23 assertions).**
Each is a plain `fetch` against `cfg.api`. Verified payload shapes
(2026-08-01): masjid → `{masjid, theme, calculation_method, timezone,
prayer_times{fajr{adhaan,iqaamah,right_after_adhaan}, sunrise, dhuhr, asr,
asr_secondary, maghrib, isha}, jumuah, ...}`; board → `{masjid, theme,
today{date,times}, server_time, upcoming_days[7], jumuah, ...}`; unknown →
`404 {"error":{"code":"NOT_FOUND"}}`; maktab → `{open, term, status_message,
program_info, square_config}`.

| ID | Case | Assertions |
|---|---|---|
| API-01 | `/api/v1/status` | 200; JSON; `db.connected === true` |
| API-02 | `/api/v1/debug` | 200; JSON parseable |
| API-03a/b | `/api/v1/masjids/{SLUG_A,SLUG_B}` | 200; `theme` present; `prayer_times` has adhaan+iqaamah for fajr/dhuhr/asr/maghrib/isha; `sunrise` present |
| API-04a/b | `/api/v1/masjids/{slug}/board` | 200; `server_time` string; `today.times`; `theme`; `upcoming_days.length === 7` |
| API-05 | `/api/v1/masjids/{SLUG_A}/maktab` | 200; `open` boolean; `term` key present |
| API-06 | `/api/v1/masjids/{SLUG_UNKNOWN}` | 404; JSON body `error.code === 'NOT_FOUND'` (never HTML, never 500) |
| API-07 | CORS: GET with `Origin: <consumer origin>` | `access-control-allow-origin` echoes the origin |
| API-08 | CORS: OPTIONS preflight | status < 400; allow-methods has GET; allow-headers matches /authorization/i |

## Suite: WRK (worker/API runtime, real D1) — `tests/e2e/worker.test.js`

**Status: ALL 5 IMPLEMENTED + green locally (11 assertions).**
These exist because multiple production incidents were API-side and
invisible to Node-based unit tests: workerd-only crashes (lessons 1–3),
wrangler env misconfig (lesson 7), D1 batch atomicity (lessons 15, 20), and
schema drift (lesson 18 — Drizzle had `label_speech`, prod D1 didn't →
registration 500). They run against the REAL worker + REAL D1 on staging
(and the local dev server when `E2E_ENV=local`). Plain `fetch`, no browser.

| ID | Case | Env | Assertions |
|---|---|---|---|
| WRK-01 | runtime health | all | `/api/v1/status` → 200 (worker booted in its real runtime); `db.connected === true`; `env.environment === cfg.expectedEnvironment` (`dev`/`staging`/`production` — pins the target) |
| WRK-02 | debug endpoint | all | `/api/v1/debug` → 200; JSON parseable (DB + bcrypt verified in the real runtime) |
| WRK-03 | registration smoke | writes-guarded | POST `/api/v1/auth/register` with unique slug `e2e-smoke-<rand>` (valid `CreateMasjidSchema` payload — see the implementation) → 200/201 JSON; repeat same payload → 409 `CONFLICT`; GET `/api/v1/masjids/{slug}` → 200 with `prayer_times.fajr.adhaan` + `theme.style_system`. Exercises db.batch + the lesson-18 columns (`style_system`, `style_options`, `label_*`) on real D1. Leaves an `e2e-smoke-*` masjid behind — staging/local DBs are disposable (re-seed per integration-testing.md §4.6) |
| WRK-04 | login round-trip | credentials-guarded | POST `/api/v1/auth/login` → 200 + `token` string; GET `/api/v1/auth/me` with Bearer → 200 + `admin.email` matches. JWT sign/verify + bcrypt through the worker, not Node |
| WRK-05 | schema-drift guard | local + staging | `npm run check-schema` exits 0 (schema.sql ↔ Drizzle in sync on the checked-out commit). Also wired as a pre-deploy step in BOTH workflows — the suite copy is the belt-and-suspenders |

When adding API endpoints in the future, add a WRK case here — the rule of
thumb: if a bug in it could only appear in workerd/D1, it belongs in this
suite, not just in vitest.

## Suite: DEPLOY (deployed artifact integrity) — `tests/e2e/deploy.test.js`

**Status: ALL PENDING.** Env: `remote only` — self-skip when
`!cfg.remote` (print one SKIP line and exit 0). These are plain `fetch`
checks; no browser. Case DEP-02 additionally needs a local `.merged/`
directory (exists after `node tooling/merge-pages.js`) — skip it with a
message when absent.

### DEP-01 — Route→SPA mapping | Priority: P0 | Class: C5
Steps: GET (fetch, `?cb=` random) each of `/`, `/{SLUG_A}`,
`/display/{SLUG_A}`, `/admin/{SLUG_A}`, `/login` on `cfg.consumer`.
Assert: every response 200, `content-type` contains `text/html`,
`cache-control` contains `no-store`. The `/display/...` body MUST differ
from the `/...` consumer body (wrong-fallback routing makes them identical) —
compare full text equality.

### DEP-02 — SPA hash match (stale-deploy detector) | Priority: P0 | Class: C2
Precondition: `.merged/__consumer_spa.html`, `__tv_spa.html`,
`__admin_spa.html` exist locally (CI: merge ran in an earlier job on the
same commit — the e2e job must run `node tooling/merge-pages.js` first OR
this case self-skips; self-skip is acceptable v1).
Steps: sha256 each local file (node:crypto). GET `/`, `/display/{SLUG_A}`,
`/admin/{SLUG_A}` remotely (`?cb=` busted), sha256 each body. Map:
`/`→consumer, `/display/`→tv, `/admin/`→admin.
Assert: each remote hash equals its local hash.

### DEP-03 — Immutable chunk headers | Priority: P0 | Class: C4
Steps: GET `/` (consumer). Extract the first `/_app/immutable/...js` URL
from the HTML (regex `/_app\/immutable\/[^"']+\.js`). GET it.
Assert: `cache-control` EXACTLY `public, max-age=31536000, immutable`
(trim + strict equal — appended directives are the bug, see
unified-deploy lesson 2).

### DEP-04 — Service worker headers + hash | Priority: P1 | Class: C4
Steps: GET `/sw.js`.
Assert: 200; `cache-control` contains `no-store`; body does NOT contain
`__BUILD_HASH__`.

### DEP-05 — API URL baked into the bundle | Priority: P0 | Class: C1
Steps: GET `/`; extract ALL `/_app/immutable/...js` URLs from the HTML;
GET each; search text for the expected API host — derive it from
`new URL(cfg.api).host` (`mapi-staging.mr-thack.workers.dev` on staging,
`mapi.mr-thack.workers.dev` on prod).
Assert: at least one chunk contains the API host string.
Note: this is the deploy-time twin of the runtime `badApiOrigins` check —
keep both.

### DEP-06 — SPA fallbacks are distinct per namespace | Priority: P1 | Class: C5
Steps: GET `/display/{SLUG_A}` and `/admin/{SLUG_A}` and `/{SLUG_A}`.
Assert: pairwise-different bodies (protects against a merge regression
serving one SPA everywhere).

### DEP-07 — Asset-miss is a real 404 | Priority: P0 | Class: C4
Steps: GET `/_app/immutable/chunks/definitely-missing-<rand>.js`.
Assert: status **404**; `content-type` NOT `text/html`; `cache-control`
contains `no-store`. (Serving the SPA shell for a missing chunk made
browsers parse markup as JS — the white-screen failure class. See
unified-deploy lesson 11.)

### DEP-08 — /sw-kill recovery hatch | Priority: P1 | Class: C4
Steps: GET `/sw-kill`.
Assert: 200; `cache-control` contains `no-store`; body contains
`getRegistrations` and `caches.delete` (the gateway-served recovery page —
see unified-deploy lesson 12).

### DEP-09 — Unversioned root statics cache headers | Priority: P1 | Class: C4
Steps: GET `/manifest.json` and `/icon-192.png`.
Assert: 200; `cache-control` contains `max-age=3600` and does NOT contain
`immutable` (unversioned files get short bounded cache, never immutable).

## Suite: CONSUMER — `tests/e2e/consumer.test.js`

**Status: CON-01..16 IMPLEMENTED + green.** Env: all.
Verified strings: root → "Please Verify Your URL"; SLUG_A name "Masjid
Al-Noor", labels Fajr/Dhuhr/Asr/Maghrib/Isha; SLUG_B name "Masjid Al-Jabal",
labels Fajr/**Zuhr**/Asr/Maghrib/Isha (Indo-Pak transliterations — verified
via `theme.label_*`); weekly table headers are CSS-uppercased (use
`expectTextCI`); unknown slug renders "Internal Error" (SvelteKit DEFAULT
fallback — the branded `[masjid_slug]/+error.svelte` does NOT catch
layout-load failures; follow-up filed, do not "fix" the test).

| ID | Case | URL / key assertions | Status |
|---|---|---|---|
| CON-01 | root verification notice, NO redirect | `/` → expectText "Please Verify Your URL"; r.ok | IMPLEMENTED |
| CON-02 | SLUG_A home renders | `/{SLUG_A}` → name + 5 English prayer labels; r.ok; badApiOrigins empty | IMPLEMENTED |
| CON-03 | SLUG_B home renders (custom labels) | `/{SLUG_B}` → name + Zuhr-label set; same asserts | IMPLEMENTED |
| CON-04 | weekly prayer timetable | `/{SLUG_A}/prayer` → expectTextCI Fajr+Isha; r.ok | IMPLEMENTED |
| CON-05 | unknown slug, no crash | `/{SLUG_UNKNOWN}` → expectText "Internal Error", allowFailures [/definitely-not-a-masjid/]; r.ok | IMPLEMENTED |
| CON-06 | maktab enroll embed mode | `/{SLUG_A}/maktab/enroll?embed=1` → pageErrors+failedRequests empty | IMPLEMENTED |

### CON-07 — Announcements page | P1 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}/announcements`.
Assert: r.ok AND body contains "Announcements" (expectText).
Note: seed has ≥1 announcement; if the seed changed, an empty-state also
passes — assert the heading only, not a specific announcement title.

### CON-08 — Jumu'ah page | P1 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}/jumuah`, expectText "Jumu'ah".
Assert: r.ok. (Page also renders "Friday congregational prayer sessions".)

### CON-09 — Info page | P1 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}/info`, expectText "Contact & Location".
Assert: r.ok.

### CON-10 — Donate page | P1 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}/donate`, expectText "Why Give?".
Assert: r.ok.

### CON-11 — Maktab landing page | P1 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}/maktab`, expectText "Maktab Enrollment".
Assert: r.ok. (Enrollment may show closed state — both pass; heading matters.)

### CON-12 — Maktab enroll (non-embed) form renders | P1 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}/maktab/enroll`.
Assert: r.ok AND pageErrors empty. Do NOT submit the form in ANY env
(Square sandbox charges + writes a registration row).
Note: Square SDK CSP font noise is already allowlisted in helpers.js.

### CON-13 — Embed mode hides chrome (positive/negative pair) | P2 | IMPLEMENTED | Class C6
Steps: (a) visitPage `/{SLUG_A}/maktab/enroll` — Shape B: count
`nav` elements, assert ≥ 1. (b) `?embed=1` — assert 0 `nav` elements.
Assert both, plus zero errors on both.
Mechanics: use Shape B, `page.locator('nav').count()`.

### CON-14 — Client-side nav flow | P1 | IMPLEMENTED | Class C6
Steps (Shape B): goto `/{SLUG_A}` → wait for "Fajr" → `page.click` the
bottom-nav/top-nav link whose text is "Times" (`page.click('text=Times')`;
if ambiguous use role: `page.getByRole('link', { name: 'Times' }).first()`)
→ wait for expectTextCI "FAJR" weekly header → click "Home" → wait for
"Fajr".
Assert: pageErrors + failedRequests empty at the end.
Purpose: catches SPA client-router crashes that a fresh goto never sees.

### CON-15 — Style-system regression pair | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}` and `/{SLUG_B}`; in each, Shape B read
`page.evaluate(() => document.documentElement.dataset.styleSystem)`.
Assert: attribute is present and one of `mishkaat|sakeenah`; the two slugs
differ LOCALLY (al-noor=mishkaat, al-jabal=sakeenah). REMOTE: prod data
differs (al-noor is currently sakeenah in prod) — assert presence/valid
value only, not specific values. r.ok on both visits.

### CON-16 — Service worker lifecycle | P1 | IMPLEMENTED | Class C4
Env: **local + staging only** (`cfg.env !== 'prod'` guard).
PORT — do not rewrite — the 10 tests in
`apps/consumer/tests/sw-integration.test.js` into this suite: replace
hardcoded `http://localhost:5175` with `cfg.consumer` and `MASJID` with
`/${SLUG_A}`. Keep their assert text. Delete nothing from the original file
(the npm `test:sw` script still uses it); the port is a copy that stays in
sync manually — note this in your hand-off.

## Suite: TV — `tests/e2e/tv.test.js`

**Status: ALL 4 IMPLEMENTED.** Env: all. Base: `{cfg.tv}/display/{slug}`.
Verified: board container selector `.prayer-grid`; header cells render the
theme's adhaan/iqaamah labels ("Adhaan"/"Iqaamah" for SLUG_A,
"Azaan"/"Iqamah" for SLUG_B — verify remotely via
`curl $API/api/v1/masjids/{slug} | jq .theme` first; if prod labels differ
from local, assert the LOCAL values locally and re-derive the remote ones
from the API response inside the test — see TV-02 note).

### TV-01 — Mishkaat board renders (SLUG_A) | P0 | Class C6
Steps: visitPage `{cfg.tv}/display/{SLUG_A}`, expectSelector `.prayer-grid`,
expectTextCI ['Fajr','Dhuhr','Asr','Maghrib','Isha'].
Assert: r.ok.
Note: no `badApiOrigins` relaxation needed — TV calls the API like any app.

### TV-02 — Sakeenah board renders with custom labels (SLUG_B) | P1 | Class C6
Steps: FIRST fetch `{cfg.api}/api/v1/masjids/{SLUG_B}` and read
`theme.label_adhaan`, `label_iqaamah`, `label_dhuhr` (derive expectations
from live data — do not hardcode). Then visitPage
`{cfg.tv}/display/{SLUG_B}`, expectSelector `.prayer-grid`, expectTextCI
[label_dhuhr value, label_adhaan value].
Assert: r.ok.

### TV-03 — Clock renders, time sync not NaN | P1 | Class C3/C6
Steps (Shape B): goto SLUG_A display; wait for `.prayer-grid`; then
`const svgCount = await page.locator('svg').count()` and
`const hasNaN = await page.evaluate(() => document.body.innerHTML.includes('NaN'))`.
Assert: svgCount ≥ 1, hasNaN === false, pageErrors empty.
Purpose: `server-clock.ts` offset bugs produce NaN transforms in the SVG
without throwing — this catches them.

### TV-04 — Unknown masjid, no crash | P1 | Class C6
Steps: visitPage `{cfg.tv}/display/{SLUG_UNKNOWN}`,
allowFailures [/definitely-not-a-masjid/].
Assert: pageErrors empty. (No specific text contract — encode whatever
graceful state you find after verifying it renders SOMETHING:
`document.body.innerText.length > 0`. Record findings here.)

### TV-05 — No time-dependent assertions | META
Do NOT assert: current-prayer highlight, countdown values, ceremony
overlays, board roll cycle, night veil. Those live in the 210 TV unit
tests (`npm run test:tv`). Smoke = presence + zero errors.

## Suite: ADMIN — `tests/e2e/admin.test.js`

**Status: ALL 8 IMPLEMENTED.** Env: all (auth cases skip without credentials).
Verified strings: `/login` → "Masjid Admin", "Sign in to manage your
masjid", email input `input[type="email"]`, password `input[type="password"]`,
submit `button[type="submit"]` labeled "Sign In" ("Signing in..." while
submitting); success navigates to `/admin/{slug}`. Dashboard shows "Service
Status", "Quick Actions", "Prayer Config". Settings page h1/h2 texts
(verified in components): profile "Profile", theme "Theme" (sections incl.
"Screen Appearance"), prayer "Prayer Rules", jumuah "Jumu'ah Sessions",
maktab "Maktab Settings", announcements "Announcements", domain "Domain",
snapshots "Snapshots", account "Account". Bot: "AI Assistant", "Configure
your masjid via chat".

### ADM-01 — Login page renders | P0 | Env: all | Class C5/C6
Steps: visitPage `{cfg.admin}/login`, expectText ["Masjid Admin",
"Sign in to manage your masjid"].
Assert: r.ok. **This is the ONLY admin case that runs in prod.**

### ADM-02 — Bad login shows error | P2 | Env: credentials-guarded | Class C6
Steps (Shape B): goto `/login`; fill email `cfg.adminEmail`, password
`definitely-wrong-password`; click submit; wait 3s.
Assert: still on `/login` (`page.url()` contains `/login`); an error
element appears (the form renders a red box with the server message —
verify its text on first run and record it here); pageErrors empty.

### ADM-03 — Login flow lands on dashboard | P0 | Env: credentials-guarded | Class C1/C6
Steps: the Shape B template from the top of this doc, verbatim.
Assert: URL matches `**/admin/{SLUG_A}`; pageErrors empty; failedRequests
empty; every `/api/*` request carried an `Authorization` header — check via
`page.on('request')` inside Shape B: for URLs with path starting `/api/`,
`req.headers()['authorization']` must start with `Bearer `. (Collect into
an array; assert count > 0 AND all have the header.)
Also assert dashboard text "Service Status" or "Quick Actions" visible.

### ADM-04 — All settings pages render | P0 | Env: credentials-guarded | Class C6
Steps: log in ONCE (Shape B, keep the same context/page — the JWT is in
localStorage), then for each row below `page.goto` the URL, wait for the
heading text, collect errors:
| URL (after `{cfg.admin}/admin/{SLUG_A}`) | expectText |
|---|---|
| `/settings/profile` | "Profile" |
| `/settings/theme` | "Screen Appearance" |
| `/settings/prayer` | "Prayer Rules" |
| `/settings/jumuah` | "Jumu'ah Sessions" |
| `/settings/maktab` | "Maktab Settings" |
| `/settings/announcements` | "Announcements" |
| `/settings/domain` | "Domain" |
| `/settings/snapshots` | "Snapshots" |
| `/settings/account` | "Account" |
Assert per page: heading found + pageErrors empty + failedRequests empty
(a 401/500 on any settings API call is a FAIL — this is the case that
catches the historical admin-page crashes).
Mechanics: reuse one page; after the LAST page, read the same `b` buckets
but diff them per page (`const before = b.pageErrors.length` …) OR simpler:
close and re-login per page is too slow — instead, record per-page counts:
```js
for (const [path, heading] of rows) {
  const pe = b.pageErrors.length, fr = b.failedRequests.length;
  await page.goto(`${cfg.admin}/admin/${SLUG_A}${path}`, { waitUntil: 'load' });
  const found = await page.waitForFunction(
    (h) => document.body.innerText.includes(h), heading, { timeout: 15000 }
  ).then(() => true).catch(() => false);
  t.assert(found, `ADM-04 ${path} shows "${heading}"`);
  t.assert(b.pageErrors.length === pe && b.failedRequests.length === fr,
    `ADM-04 ${path} zero new errors ${b.pageErrors.slice(pe)}`);
}
```

### ADM-05 — Bot panel renders | P1 | Env: credentials-guarded | Class C6
Steps: after login, goto `/admin/{SLUG_A}/bot`, expectText "AI Assistant".
Assert: heading + zero errors. Do NOT send a chat message in any env (LLM
cost + writes config branches).

### ADM-06 — Auth guard for logged-out users | P1 | Env: all | Class C6
Steps (Shape B, FRESH context — no token): goto `/admin/{SLUG_A}`.
Assert: verify CURRENT behavior first (redirect to `/login`? rendered
login gate?) by running it once, then encode what you find. Record the
finding in this row. pageErrors empty regardless.

### ADM-07 — Theme settings form is populated | P2 | Env: credentials-guarded | Class C6
Steps: after login, goto theme settings.
Assert (Shape B): at least one `input` or `select` on the page has a
non-empty value (`page.locator('input').first().inputValue()` or evaluate
`[...document.querySelectorAll('input')].some(i => i.value)`).
Purpose: catches "form renders but data load failed silently".

### ADM-08 — Env coverage map | META
Local + staging run ALL cases (staging D1 is seeded with the admin, so
`cfg.adminEmail` resolves to the seeded credentials there). In prod, ONLY
ADM-01 runs (plus ADM-06 if the guard behavior is a redirect — it makes no
writes); everything else sits behind the credentials guard and CI does not
set `E2E_ADMIN_*` for the prod job.

## Extended coverage (2026-08-01)

Additional cases added to exhaustively cover every route + edge case across
all three page apps.

### CON-17 — SLUG_B announcements page | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_B}/announcements`, expectText "Announcements".
Assert: r.ok. Cross-masjid coverage for the Indo-Pak/Sakeenah tenant.

### CON-18 — SLUG_B jumu'ah page | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_B}/jumuah`, expectText "Jumu'ah". Assert: r.ok.

### CON-19 — SLUG_B info page | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_B}/info`, expectText "Contact & Location". Assert: r.ok.

### CON-20 — SLUG_B donate page | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_B}/donate`, expectText "Why Give?". Assert: r.ok.

### CON-21 — SLUG_B maktab page | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_B}/maktab`, expectText "Maktab Enrollment". Assert: r.ok.

### CON-22 — SLUG_B maktab enroll form | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_B}/maktab/enroll`. Assert: pageErrors empty.

### CON-23 — embed=1 on home page hides chrome | P2 | IMPLEMENTED | Class C6
Steps: Shape B; goto `/{SLUG_A}?embed=1`; count `nav` elements.
Assert: nav count === 0, zero pageErrors.

### CON-24 — embed=1 on prayer page hides chrome | P2 | IMPLEMENTED | Class C6
Steps: Shape B; goto `/{SLUG_A}/prayer?embed=1`; count `nav` elements.
Assert: nav count === 0, zero pageErrors.

### CON-25 — rapid client-side nav, no reload loops | P1 | IMPLEMENTED | Class C6
Steps: goto home → click 7 nav links rapidly (Times→Home→News→Times→Home→Maktab→Home).
Assert: pageErrors + failedRequests empty at the end.
Purpose: catches SPA router reload loops and nav crashes.

### CON-26 — cold-load prayer page directly | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}/prayer` (fresh context, no prior visit to home).
Assert: r.ok, pageErrors empty. Purpose: layout-load failure without prior fetch.

### CON-27 — trailing slash handled | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_A}/` (trailing slash). Assert: r.ok, "Fajr" present.

### CON-28 — SLUG_B cold-load donate | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/{SLUG_B}/donate`. Assert: r.ok. Cross-masjid cold-load.

### TV-05 — board re-render stability | P1 | IMPLEMENTED | Class C6
Steps: goto SLUG_A display → wait for `.prayer-grid` → goto SLUG_B display → back to SLUG_A.
Assert: no new pageErrors after re-render. Purpose: catches mount/unmount leaks.

### TV-06 — /display/ root without slug | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/display/`. Assert: pageErrors empty (any graceful 4xx is fine).

### ADM-08 — register page renders | P1 | IMPLEMENTED | Class C5/C6
Steps: visitPage `/register`. Assert: pageErrors + failedRequests empty.

### ADM-09 — SLUG_B admin dashboard | P1 | IMPLEMENTED | Class C6
Steps: login → goto `/admin/{SLUG_B}`. Assert: pageErrors empty, dashboard content visible.

### ADM-10 — login → logout → access denied | P1 | IMPLEMENTED | Class C6
Steps: login → `localStorage.clear()` → goto `/admin/{SLUG_A}`.
Assert: redirects to `/login`, zero pageErrors.

### ADM-11 — rapid admin nav cycle | P1 | IMPLEMENTED | Class C6
Steps: login → iterate all 9 settings pages + bot in rapid succession (600ms each).
Assert: pageErrors + failedRequests empty. Purpose: catches reload loops on admin.

### ADM-12 — bogus admin slug, no crash | P2 | IMPLEMENTED | Class C6
Steps: visitPage `/admin/this-slug-does-not-exist`. Assert: pageErrors empty.

### API-09 — masjid sub-endpoints return valid data | P1 | IMPLEMENTED | Class C3
Steps: GET `/masjids/{SLUG_A}/prayer?date=...`, `/jumuah`, `/announcements`.
Assert: 200 + body shape valid (times+masjid for prayer, sessions[] for jumuah, announcements[] for announcements).

### API-10 — non-existent announcement → 404 JSON | P2 | IMPLEMENTED | Class C3
Steps: GET `/announcements/this-does-not-exist`. Assert: 404, JSON body.

### API-11 — maktab verify-code without body → 4xx, never 500 | P2 | IMPLEMENTED | Class C3
Steps: POST with `{}` body. Assert: status < 500, JSON body.

### API-12/13 — board + prayer for unknown masjid → 404 JSON | P2 | IMPLEMENTED | Class C3
Assert: 404, JSON body for both endpoints.

### API-14 — bogus API path → JSON error, never HTML | P2 | IMPLEMENTED | Class C3
Steps: GET `/api/v1/this-path-does-not-exist`. Assert: JSON body with error key.

### API-15 — SLUG_B sub-endpoints cross-masjid parity | P1 | IMPLEMENTED | Class C3
Assert: 200 + valid shapes for SLUG_B prayer/jumuah/announcements/maktab.

## Workflow integration (how CI runs these)

- **Push to `staging`** → `.github/workflows/deploy-staging.yml`:
  `check-schema` gate → build+deploy API worker to `mapi-staging`
  (staging D1 id injected over `placeholder-staging-db-id`) → build+merge
  pages with `VITE_API_URL=https://mapi-staging.mr-thack.workers.dev` →
  deploy to `masjid-staging.pages.dev` → `sleep 30` (edge propagation) →
  `npm run test:e2e:staging` (ALL suites incl. write cases — disposable DB).
  Green = eligible to merge into `master`.
- **Push to `master`** → `.github/workflows/deploy.yml`: `check-schema`
  gate → workers+pages deploy → `e2e-prod` job → `npm run test:e2e:prod`
  (read-only alarm; write cases skip on `cfg.writes`).
- **Local**: `npm run test:e2e` with the 4 dev servers running. Run one
  suite while developing: `node tests/e2e/run.js --suite=admin`.
- The whatsapp/agent vitest suites are intentionally NOT in any workflow
  (currently red — missing tokens; tracked separately).
- If `e2e-staging` fails: FIRST re-run with a fresh `?cb` (the harness
  does this automatically) and check for edge propagation (~30s) before
  debugging code. If it fails twice in a row, it's real.

## Merge-order guidance for the swarm

1. `deploy.test.js` (DEP-*) — independent, no browser needed locally to
   develop (point `E2E_ENV=staging` once the first staging deploy exists).
2. `consumer.test.js` CON-07..16 — extends an existing file; ONE agent to
   avoid conflicts.
3. `tv.test.js` (TV-*) — new file.
4. `admin.test.js` (ADM-*) — new file; the only suite needing credentials.
All four can run in parallel worktrees per AGENTS.md multi-agent rules;
they touch disjoint files. Dev-server ports are shared — stagger local
verification runs.
