// ---------------------------------------------------------------------------
// E2E shared harness. EVERY page visit in EVERY suite goes through
// visitPage() (one-shot) or collectPage() (multi-step flows like login).
// Never attach your own pageerror/console listeners — extend this file.
//
// The error collector is the whole point: any uncaught exception, any
// console.error, any failed same-origin/API request while loading a page
// fails the test — you do not need to predict the crash.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

// --- reporter ---------------------------------------------------------------
// Same PASS/FAIL style as apps/consumer/tests/sw-integration.test.js.
// Usage: const t = createReporter('my suite'); ... t.assert(cond, 'label');
// ... await t.done();  (prints summary, sets exit code, returns failed count)
export function createReporter(suiteName) {
  let passed = 0;
  let failed = 0;
  console.log(`\n=== ${suiteName} ===\n`);
  return {
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
    get failed() {
      return failed;
    },
    async done() {
      console.log(`\n=== ${suiteName}: ${passed} passed, ${failed} failed ===\n`);
      if (failed > 0) process.exitCode = 1;
      return failed;
    },
  };
}

// --- browser ----------------------------------------------------------------
export async function launchBrowser() {
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
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
export function collectPage(page, cfg) {
  const buckets = { pageErrors: [], consoleErrors: [], failedRequests: [], apiOrigins: [], warnings: [] };

  page.on('pageerror', (err) => buckets.pageErrors.push(`pageerror: ${err.message}`));

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location()?.url;
    const text = loc ? `${msg.text()} [${loc}]` : msg.text();
    if (!isNoise(text)) buckets.consoleErrors.push(`console.error: ${text}`);
  });

  page.on('response', (resp) => {
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

// --- visitPage ----------------------------------------------------------------
// One-shot checked visit: fresh context, collectors on, goto, wait for the
// expected content, close. Returns buckets + derived flags.
//
// opts:
//   expectText     string | string[]  — must appear in document.body.innerText
//   expectTextCI   string | string[]  — same, case-insensitive (for CSS-uppercased text)
//   expectSelector string             — must be visible (waited for, 15s)
//   allowFailures  RegExp[]           — console errors / failed requests matching
//                                       these are EXPECTED (e.g. a deliberate 404)
//                                       and are moved to warnings
//   settleMs       number             — extra settle time (default 3000)
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
  const context = await browser.newContext();
  const page = await context.newPage();
  const buckets = collectPage(page, cfg);
  buckets.missing = [];

  const target = bust(url, cfg);
  try {
    await page.goto(target, { waitUntil: opts.waitUntil ?? 'load', timeout: opts.timeoutMs ?? 30000 });

    // Wait for SvelteKit to hydrate: the root layout sets data-hydrated="true"
    // on <html> via $effect() when the component tree first mounts.
    await page.waitForSelector('html[data-hydrated="true"]', { timeout: 30000 }).catch(() => {});

    // Wait for page content to render. data-hydrated fires when the shell
    // mounts, but page data (from load functions) may still be in flight.
    // When <main> has children, the route component has rendered.
    await page.waitForFunction(
      () => document.querySelector('main')?.children.length > 0,
      { timeout: 30000 },
    ).catch(() => {});

    if (opts.expectSelector) {
      try {
        await page.waitForSelector(opts.expectSelector, { state: 'visible', timeout: 30000 });
      } catch {
        buckets.missing.push(`selector not visible: ${opts.expectSelector}`);
      }
    }

    const texts = Array.isArray(opts.expectText) ? opts.expectText : opts.expectText ? [opts.expectText] : [];
    for (const text of texts) {
      try {
        await page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout: 30000 });
      } catch {
        buckets.missing.push(`text not found: "${text}"`);
      }
    }

    const textsCI = Array.isArray(opts.expectTextCI)
      ? opts.expectTextCI
      : opts.expectTextCI
        ? [opts.expectTextCI]
        : [];
    for (const text of textsCI) {
      try {
        await page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), text, {
          timeout: 30000,
        });
      } catch {
        buckets.missing.push(`text not found (CI): "${text}"`);
      }
    }

    await page.waitForTimeout(opts.settleMs ?? 3000);
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
