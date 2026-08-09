// ---------------------------------------------------------------------------
// E2E shared harness. EVERY page visit in EVERY suite goes through
// visitPage() (one-shot) or collectPage() (multi-step flows like login).
// Never attach your own pageerror/console listeners — extend this file.
//
// The error collector is the whole point: any uncaught exception, any
// console.error, any failed same-origin/API request while loading a page
// fails the test — you do not need to predict the crash.
//
// Determinism contract (2026-08-05 rework — see docs/integration-testing.md):
//   - NO "sleep and hope": waits are CONDITION-based with bounded ceilings.
//     Fixed sleeps are for pacing only (rapid-nav stress), never for
//     "wait until the page is ready" — use waitForHydration/waitForContent/
//     settlePage/gotoPage instead.
//   - EVERY case body runs inside testCase() so a thrown timeout becomes a
//     FAIL line (and the rest of the suite still runs) instead of an
//     uncaught exception that kills the whole process with a stack trace.
//   - Auth flows go through loginAdmin() ONCE per suite; later cases reuse
//     the captured storageState (localStorage JWT) instead of re-logging in.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

// --- timeout ceilings (happy path never waits on these — conditions win) ----
export const NAV_TIMEOUT = 30_000; // page.goto (remote CDN + cold worker)
export const HYDRATION_TIMEOUT = 30_000; // SvelteKit boot on a cold context
export const EXPECT_TIMEOUT = 30_000; // content expectations
export const LOGIN_TIMEOUT = 45_000; // bcrypt + 2 API round trips + SPA nav
export const SETTLE_MAX = 2_000; // adaptive-settle ceiling
const CONTENT_TIMEOUT = 10_000; // best-effort "something rendered" signal
const QUIET_WINDOW = 500; // settle exits after this much event silence

// --- reporter ---------------------------------------------------------------
// Same PASS/FAIL style as apps/consumer/tests/sw-integration.test.js.
// Usage: const t = createReporter('my suite'); ... t.assert(cond, 'label');
// ... await t.done();  (prints summary, sets exit code, returns failed count)
//
// The reporter also owns the suite WATCHDOG: if the suite exceeds
// E2E_SUITE_WATCHDOG_MS (default 8 min) it prints the in-flight case and
// exits non-zero — a suite can never hang a CI job silently.
let activeReporter = null;

export function createReporter(suiteName) {
  let passed = 0;
  let failed = 0;
  let currentCase = null;
  const caseTimes = [];
  const suiteStart = Date.now();
  console.log(`\n=== ${suiteName} ===\n`);

  const watchdogMs = Number(process.env.E2E_SUITE_WATCHDOG_MS || 8 * 60 * 1000);
  const watchdog = setTimeout(() => {
    console.error(
      `\n  WATCHDOG  ${suiteName} exceeded ${Math.round(watchdogMs / 1000)}s` +
        (currentCase ? ` — stuck in ${currentCase}` : ' (between cases)'),
    );
    console.error(`\n=== ${suiteName}: ${passed} passed, ${failed} failed + watchdog abort ===\n`);
    process.exitCode = 1;
    process.exit(1);
  }, watchdogMs);

  const reporter = {
    assert(condition, label) {
      if (condition) {
        console.log(`  PASS  ${label}`);
        passed++;
      } else {
        console.error(`  FAIL  ${label}`);
        failed++;
      }
    },
    skip(label, reason) {
      console.log(`  SKIP  ${label} (${reason})`);
    },
    // skipIf writes guard: t.skipIf(!cfg.writes) in mutating tests
    skipIf(cond) {
      return cond;
    },
    // testCase() lifecycle hooks — track the in-flight case for the watchdog
    // and for unhandledRejection attribution.
    _begin(id) {
      currentCase = id;
      caseTimes.push({ id, start: Date.now() });
    },
    _end() {
      const entry = caseTimes[caseTimes.length - 1];
      if (entry && entry.ms === undefined) entry.ms = Date.now() - entry.start;
      currentCase = null;
    },
    get currentCase() {
      return currentCase;
    },
    get failed() {
      return failed;
    },
    async done() {
      clearTimeout(watchdog);
      const elapsed = ((Date.now() - suiteStart) / 1000).toFixed(1);
      const slowest = caseTimes
        .filter((c) => c.ms !== undefined)
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 3)
        .map((c) => `${c.id} ${(c.ms / 1000).toFixed(1)}s`);
      console.log(`\n=== ${suiteName}: ${passed} passed, ${failed} failed — ${elapsed}s ===`);
      if (slowest.length) console.log(`    slowest: ${slowest.join(', ')}\n`);
      if (activeReporter === reporter) activeReporter = null;
      if (failed > 0) process.exitCode = 1;
      return failed;
    },
  };
  activeReporter = reporter;
  return reporter;
}

// A stray rejection must become a FAIL line, not a process-killing
// "triggerUncaughtException" stack trace (the old failure mode).
process.on('unhandledRejection', (err) => {
  const msg = String(err?.message ?? err).split('\n')[0];
  const where = activeReporter?.currentCase ? ` (during ${activeReporter.currentCase})` : '';
  if (activeReporter) activeReporter.assert(false, `unhandled rejection${where}: ${msg}`);
  else console.error(`  FAIL  unhandled rejection${where}: ${msg}`);
  process.exitCode = 1;
});

// --- browser ----------------------------------------------------------------
export async function launchBrowser() {
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}

// Every context gets bounded default timeouts: locator actions (click/fill)
// auto-wait up to EXPECT_TIMEOUT; navigations up to NAV_TIMEOUT. Explicit
// per-call timeouts still override these.
export async function newContext(browser, opts = {}) {
  const context = await browser.newContext(opts);
  context.setDefaultTimeout(EXPECT_TIMEOUT);
  context.setDefaultNavigationTimeout(NAV_TIMEOUT);
  return context;
}

// --- collectors ---------------------------------------------------------------
const NOISE_ALLOWLIST = [
  /favicon\.ico/i,
  // Dev-mode Vite client chatter — extend HERE, never inline in a test:
  /\[vite\] connected/i,
  // Square Web Payments SDK emits CSP font-violation noise from its own
  // iframe on the maktab enroll page — not actionable by us:
  /squarecdn\.com/i,
];

function isNoise(text) {
  return NOISE_ALLOWLIST.some((re) => re.test(text));
}

// Attach collectors to a page. Returns the buckets object (mutated live).
// buckets._activity counts page events; settlePage() uses it to detect when
// the page has gone quiet (no network/console/error activity).
export function collectPage(page, cfg) {
  const buckets = { pageErrors: [], consoleErrors: [], failedRequests: [], apiOrigins: [], warnings: [], _activity: 0 };
  const bump = () => buckets._activity++;

  page.on('pageerror', (err) => {
    bump();
    buckets.pageErrors.push(`pageerror: ${err.message}`);
  });

  page.on('console', (msg) => {
    bump();
    if (msg.type() !== 'error') return;
    const loc = msg.location()?.url;
    const text = loc ? `${msg.text()} [${loc}]` : msg.text();
    if (!isNoise(text)) buckets.consoleErrors.push(`console.error: ${text}`);
  });

  page.on('request', bump);
  page.on('requestfailed', bump);

  page.on('response', (resp) => {
    bump();
    const url = resp.url();
    const status = resp.status();
    if (status < 400 || isNoise(url)) return;
    const pageOrigin = new URL(page.url() || cfg.consumer).origin;
    let origin;
    try {
      origin = new URL(url).origin;
    } catch {
      return;
    }
    // Third-party failures (fonts etc.) are warnings, not failures.
    if (origin === pageOrigin || origin === new URL(cfg.api).origin || cfg.allowedApiOrigins.includes(origin)) {
      buckets.failedRequests.push(`${status} ${url}`);
    } else {
      buckets.warnings.push(`third-party ${status} ${url}`);
    }
  });

  page.on('request', (req) => {
    try {
      const u = new URL(req.url());
      if (!u.pathname.startsWith('/api/')) return;
      // Only OUR origins count as API-call candidates (page origin → catches
      // VITE_API_URL misbuilds; cfg.api → the real API). Third-party origins
      // with /api/* paths (Square, Datadog CSP reports…) are ignored.
      const pageOrigin = page.url() ? new URL(page.url()).origin : null;
      if (u.origin === pageOrigin || u.origin === new URL(cfg.api).origin) {
        buckets.apiOrigins.push(u.origin);
      }
    } catch {
      /* ignore */
    }
  });

  return buckets;
}

// Append a cache-buster on remote targets (edge propagation / CDN lessons).
function bust(url, cfg) {
  if (!cfg.remote) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cb=${Math.random().toString(36).slice(2, 10)}`;
}

// --- condition-based waits (use these, never bare waitForTimeout) -------------

// SvelteKit sets data-hydrated="true" on <html> when the component tree first
// mounts. Interacting with a page BEFORE this races hydration (a click on an
// unhydrated <form> triggers a NATIVE submit — the old admin-login flake).
export function waitForHydration(page, timeout = HYDRATION_TIMEOUT) {
  return page.waitForSelector('html[data-hydrated="true"]', { timeout });
}

// "Something rendered": either a <main> with children (app pages) or any
// visible body text (admin /login + /register have no <main>). Best-effort —
// callers should .catch(() => {}) and rely on expectations for failures.
export function waitForContent(page, timeout = CONTENT_TIMEOUT) {
  return page.waitForFunction(
    () =>
      (document.querySelector('main')?.children.length ?? 0) > 0 ||
      (document.body?.innerText ?? '').trim().length > 0,
    { timeout },
  );
}

// Adaptive settle: wait until the page has been quiet (no requests, responses,
// console messages, or errors) for QUIET_WINDOW ms. Exits early on healthy
// pages (~600ms), keeps waiting while errors/failed requests are actively
// streaming in, and is hard-capped at maxMs. Replaces fixed settle sleeps.
export async function settlePage(page, buckets, maxMs = SETTLE_MAX) {
  const start = Date.now();
  let lastSeen = buckets._activity ?? 0;
  let quietSince = Date.now();
  while (Date.now() - start < maxMs) {
    await page.waitForTimeout(100);
    const now = buckets._activity ?? 0;
    if (now !== lastSeen) {
      lastSeen = now;
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= QUIET_WINDOW && Date.now() - start >= QUIET_WINDOW) {
      break;
    }
  }
}

// Multi-step-flow counterpart of visitPage(): goto + hydration + optional
// content expectations + adaptive settle, all condition-based. Throws on
// navigation failure (callers run inside testCase).
export async function gotoPage(page, buckets, url, opts = {}) {
  await page.goto(url, { waitUntil: opts.waitUntil ?? 'load', timeout: opts.timeoutMs ?? NAV_TIMEOUT });
  await waitForHydration(page).catch(() => {});
  if (opts.expectSelector) {
    await page
      .waitForSelector(opts.expectSelector, { state: 'visible', timeout: opts.expectTimeout ?? EXPECT_TIMEOUT })
      .catch(() => {});
  }
  if (opts.expectText) {
    await page
      .waitForFunction((t) => document.body.innerText.includes(t), opts.expectText, {
        timeout: opts.expectTimeout ?? EXPECT_TIMEOUT,
      })
      .catch(() => {});
  }
  await settlePage(page, buckets, opts.settleMs ?? SETTLE_MAX);
}

// Race-free admin login. Hydration is awaited BEFORE touching the form (the
// pre-hydration click used to trigger a native form submit and the SPA never
// navigated → waitForURL timeout). waitForURL is registered BEFORE the click
// so a fast client-side navigation can't slip past it. 'commit' because the
// post-login nav is a same-document pushState (no load event fires).
//
// The navigation is raced against the app's error banner: if the login API
// fails (500/401/…), the app never navigates and we fail FAST with the real
// server message instead of burning the whole timeout.
export async function loginAdmin(page, cfg) {
  await page.goto(`${cfg.admin}/login`, { waitUntil: 'load', timeout: NAV_TIMEOUT });
  await waitForHydration(page);
  await page.fill('input[type="email"]', cfg.adminEmail);
  await page.fill('input[type="password"]', cfg.adminPassword);

  // Both arms carry .catch — the loser of the race must never surface as an
  // unhandled rejection.
  const nav = page
    .waitForURL('**/admin/**', { waitUntil: 'commit', timeout: LOGIN_TIMEOUT })
    .then(() => ({ ok: true }))
    .catch(() => ({ ok: false }));
  const errBanner = page
    .waitForFunction(() => document.querySelector('.text-red-400')?.textContent?.trim() || false, {
      timeout: LOGIN_TIMEOUT,
    })
    .then((msg) => ({ ok: false, error: msg }))
    .catch(() => ({ ok: false, ignore: true }));

  await page.click('button[type="submit"]');
  const outcome = await Promise.race([nav, errBanner]);
  if (!outcome.ok) {
    if (outcome.error) throw new Error(`login failed fast — app error banner: "${outcome.error}"`);
    throw new Error(`login: no navigation to /admin/** within ${LOGIN_TIMEOUT / 1000}s and no error banner`);
  }

  // The admin shell renders after the profile fetch — wait for its <main>.
  await page.waitForSelector('main', { state: 'visible', timeout: EXPECT_TIMEOUT }).catch(() => {});
  await waitForContent(page).catch(() => {});
}

// Case wrapper: turns a thrown timeout/error into a FAIL line so the rest of
// the suite keeps running, and records per-case timing for the summary.
// Playwright errors keep their "waiting for" line — that's the useful clue.
export async function testCase(t, id, fn) {
  t._begin(id);
  try {
    await fn();
  } catch (err) {
    const lines = String(err?.message ?? err).split('\n').map((l) => l.trim()).filter(Boolean);
    const brief = [lines[0], lines.find((l) => l.startsWith('waiting for'))].filter(Boolean).join(' — ');
    t.assert(false, `${id} threw: ${brief}`);
  } finally {
    t._end();
  }
}

// --- visitPage ----------------------------------------------------------------
// One-shot checked visit: fresh context, collectors on, goto, wait for the
// expected content, close. Returns buckets + derived flags.
//
// opts:
//   expectText     string | string[]  — must appear in document.body.innerText
//   expectTextCI   string | string[]  — same, case-insensitive (for CSS-uppercased text)
//   expectSelector string             — must be visible (waited for, EXPECT_TIMEOUT)
//   expectTimeout  number             — timeout for expectText/expectTextCI/expectSelector (default EXPECT_TIMEOUT)
//   allowFailures  RegExp[]           — console errors / failed requests matching
//                                       these are EXPECTED (e.g. a deliberate 404)
//                                       and are moved to warnings
//   settleMs       number             — adaptive-settle ceiling (default 2000)
//   timeoutMs      number             — navigation timeout (default 30000)
//   waitUntil      string             — page.goto waitUntil (default 'load')
//                                       use 'networkidle' for pages without persistent
//                                       third-party connections (Square SDK etc.)
//
// Result: { pageErrors, consoleErrors, failedRequests, apiOrigins, warnings,
//           missing, ok, badApiOrigins }
// ok = no pageErrors, no consoleErrors, no failedRequests, nothing missing,
// and every /api/* request went to an allowed origin.
export async function visitPage(browser, cfg, url, opts = {}) {
  const context = await newContext(browser);
  const page = await context.newPage();
  const buckets = collectPage(page, cfg);
  buckets.missing = [];

  const target = bust(url, cfg);
  try {
    await page.goto(target, { waitUntil: opts.waitUntil ?? 'load', timeout: opts.timeoutMs ?? NAV_TIMEOUT });

    // Pacing waits (best-effort, swallowed): give a healthy SPA time to boot
    // before expectations start. Kept SHORT on purpose — known-blank error
    // pages (e.g. the SPA-mode +error.svelte dedup glitch) never hydrate, and
    // the real assertions are the expectations below with their own budgets.
await waitForHydration(page, 12000).catch(() => {});
    await waitForContent(page, 5000).catch(() => {});

    // All expectations run CONCURRENTLY (they only read the DOM) — a page

    // All expectations run CONCURRENTLY (they only read the DOM) — a page
    // missing N expectations costs one EXPECT_TIMEOUT, not N × EXPECT_TIMEOUT.
    const expectTimeout = opts.expectTimeout ?? EXPECT_TIMEOUT;
    const checks = [];
    if (opts.expectSelector) {
      checks.push(
        page
          .waitForSelector(opts.expectSelector, { state: 'visible', timeout: expectTimeout })
          .catch(() => buckets.missing.push(`selector not visible: ${opts.expectSelector}`)),
      );
    }

    const texts = Array.isArray(opts.expectText) ? opts.expectText : opts.expectText ? [opts.expectText] : [];
    for (const text of texts) {
      checks.push(
        page
          .waitForFunction((t) => document.body.innerText.includes(t), text, { timeout: expectTimeout })
          .catch(() => buckets.missing.push(`text not found: "${text}"`)),
      );
    }

    const textsCI = Array.isArray(opts.expectTextCI)
      ? opts.expectTextCI
      : opts.expectTextCI
        ? [opts.expectTextCI]
        : [];
    for (const text of textsCI) {
      checks.push(
        page
          .waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), text, {
            timeout: expectTimeout,
          })
          .catch(() => buckets.missing.push(`text not found (CI): "${text}"`)),
      );
    }
    await Promise.all(checks);

    await settlePage(page, buckets, opts.settleMs ?? SETTLE_MAX);
  } catch (err) {
    buckets.pageErrors.push(`navigation: ${err.message}`);
  }

  const badApiOrigins = [...new Set(buckets.apiOrigins)].filter((o) => !cfg.allowedApiOrigins.includes(o));

  // Expected failures (e.g. a deliberate 404 for an unknown masjid) are
  // moved out of the failure buckets into warnings.
  const allow = opts.allowFailures || [];
  if (allow.length) {
    const move = (arr) => {
      const kept = [];
      for (const item of arr) {
        if (allow.some((re) => re.test(item))) buckets.warnings.push(`expected: ${item}`);
        else kept.push(item);
      }
      return kept;
    };
    buckets.consoleErrors = move(buckets.consoleErrors);
    buckets.failedRequests = move(buckets.failedRequests);
  }

  await context.close();

  return {
    ...buckets,
    badApiOrigins,
    ok:
      buckets.pageErrors.length === 0 &&
      buckets.consoleErrors.length === 0 &&
      buckets.failedRequests.length === 0 &&
      buckets.missing.length === 0 &&
      badApiOrigins.length === 0,
  };
}

// Pretty-print a visitPage result for FAIL output.
export function explain(r) {
  const parts = [];
  for (const k of ['pageErrors', 'consoleErrors', 'failedRequests', 'missing', 'badApiOrigins', 'warnings']) {
    if (r[k] && r[k].length) parts.push(`${k}: ${JSON.stringify(r[k].slice(0, 5))}`);
  }
  return parts.join(' | ') || '(no detail)';
}

// ---------------------------------------------------------------------------
// Pre-warm: visit every URL the test suite will use to warm the API worker,
// D1, and CDN edges. Runs once at suite start. Each URL is visited in a
// fresh context and waited until content is loaded. Failures are logged but
// never fatal — the actual tests will retry.
// ---------------------------------------------------------------------------
export async function prewarm(browser, baseUrl, paths) {
  console.log(`  pre-warming ${paths.length} URLs…`);
  const start = Date.now();
  for (const p of paths) {
    try {
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      await page.goto(`${baseUrl}${p}`, { waitUntil: 'load', timeout: 45000 });
      // Wait for content-ready signal if present, otherwise body text > 50 chars
      await page.waitForSelector('[data-content-ready]', { state: 'attached', timeout: 30000 }).catch(() => {});
      await page.waitForFunction(() => document.body.innerText.length > 50, { timeout: 15000 }).catch(() => {});
      await ctx.close();
    } catch (e) {
      console.error(`    prewarm ${p}: ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`  pre-warm done in ${((Date.now() - start) / 1000).toFixed(0)}s`);
}
