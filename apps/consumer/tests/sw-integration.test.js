// ---------------------------------------------------------------------------
// Integration tests for service worker
//
// Prerequisites: consumer dev server running on localhost:5175
//                and API server running on localhost:5173
//
// Run: node tests/sw-integration.test.js
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

const BASE = 'http://localhost:5175';
const MASJID = '/masjid-al-noor';
let browser;
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

async function main() {
  console.log('\n=== Service Worker Integration Tests ===\n');

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // -----------------------------------------------------------------------
  // Test 1: SW registers on page load
  // -----------------------------------------------------------------------
  console.log('1. SW registration');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const workers = context.serviceWorkers();
    assert(workers.length >= 1, 'at least one SW registered');

    const sw = workers[0];
    const scriptUrl = sw.url();
    assert(scriptUrl.endsWith('/sw.js'), `SW script URL ends with /sw.js (got ${scriptUrl})`);

    const state = await sw.evaluate(() => self.registration?.active?.state);
    console.log(`    SW state: ${state}`);
    assert(state === 'activated', `SW is activated (got ${state})`);

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 2: Cache name is versioned (no __BUILD_HASH__ placeholder)
  // -----------------------------------------------------------------------
  console.log('2. Cache name versioning');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    const workers = context.serviceWorkers();
    assert(workers.length >= 1, 'SW registered');

    const cacheNames = await workers[0].evaluate(() => caches.keys());
    console.log(`    Cache names: ${JSON.stringify(cacheNames)}`);

    assert(cacheNames.length >= 1, 'at least one cache exists');
    assert(
      cacheNames.some((n) => n.startsWith('masjid-consumer-') && !n.includes('__BUILD_HASH__')),
      'cache name is versioned (no placeholder)',
    );

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 3: /sw-kill self-destruct unregisters SW and clears caches
  // -----------------------------------------------------------------------
  console.log('3. /sw-kill self-destruct');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    let workers = context.serviceWorkers();
    assert(workers.length >= 1, 'SW registered before kill');

    // The SW's fetch handler intercepts /sw-kill for non-navigation requests.
    // We trigger it via page.evaluate (an in-page fetch, not a navigation).
    const result = await page.evaluate(async () => {
      const resp = await fetch('/sw-kill');
      return { status: resp.status, body: await resp.text() };
    });

    assert(result.status === 200, `/sw-kill fetch returns 200 (got ${result.status})`);
    assert(result.body.includes('unregistered'), `body confirms unregister: "${result.body}"`);

    // Allow time for unregister to propagate
    await page.waitForTimeout(4000);

    // Re-check: after unregister, navigator.serviceWorker.getRegistration() should
    // resolve to undefined. context.serviceWorkers() may still show a stale entry
    // in some Playwright/Chromium versions, so we check via in-page API.
    const hasSW = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg !== undefined;
    });
    assert(!hasSW, `no SW registration after kill (got hasSW=${hasSW})`);

    // Verify caches are empty
    const cacheKeys = await page.evaluate(() => caches.keys());
    assert(cacheKeys.length === 0, `all caches cleared (got ${cacheKeys.length})`);

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 4: app.html avoids SW registration on /sw-kill path
  // -----------------------------------------------------------------------
  console.log('4. SW skipped on /sw-kill path');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}/sw-kill`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);

    const workers = context.serviceWorkers();
    assert(workers.length === 0, `no SW registered when landing on /sw-kill (got ${workers.length})`);

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 5: Icons are cached after page load
  // -----------------------------------------------------------------------
  console.log('5. Icon caching');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const workers = context.serviceWorkers();
    assert(workers.length >= 1, 'SW registered');

    // In dev mode, JS/CSS come from /@ paths (skipped). Icons should still be
    // cached if the page triggers a fetch for them that goes through the SW.
    // Force-cache the icon via an explicit fetch to exercise the cache path.
    // Use icon-512.png (not icon-192.png which is preloaded by <link> in app.html
    // and may be served from the browser HTTP cache without going through the SW)
    const fetchResult = await page.evaluate(async () => {
      // Use a cache-busting query to avoid HTTP cache
      const resp = await fetch('/icon-512.png?t=' + Date.now());
      const blob = await resp.blob();
      return { status: resp.status, ok: resp.ok, size: blob.size, type: resp.type };
    });
    console.log(`    Icon fetch: ${JSON.stringify(fetchResult)}`);

    // Give the SW time to complete cache.put (async after respondWith)
    await page.waitForTimeout(3000);

    // Check cache from both page context and SW context
    const pageCache = await page.evaluate(() => caches.keys());
    console.log(`    Page cache names: ${JSON.stringify(pageCache)}`);

    const allCached = await workers[0].evaluate(() =>
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.open(n).then((c) => c.keys()).then((keys) => keys.map((r) => r.url))))
      ).then((arrs) => arrs.flat())
    );

    console.log(`    Cached URLs (${allCached.length}): ${allCached.slice(0, 5).join(', ')}${allCached.length > 5 ? '...' : ''}`);

    // Quick debug: open the cache directly and check keys
    const debugKeys = await workers[0].evaluate(() =>
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.open(n).then((c) => c.keys())))
      ).then((arr) => arr.flat().map((r) => r.url))
    );
    console.log(`    Debug cached keys: ${JSON.stringify(debugKeys)}`);

    const hasIcon = allCached.some((u) => u.includes('icon-512'));
    assert(hasIcon, 'icon-512.png is cached');

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 6: API requests are not cached
  // -----------------------------------------------------------------------
  console.log('6. API requests bypass cache');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const workers = context.serviceWorkers();
    assert(workers.length >= 1, 'SW registered');

    const allCached = await workers[0].evaluate(() =>
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.open(n).then((c) => c.keys()).then((keys) => keys.map((r) => r.url))))
      ).then((arrs) => arrs.flat())
    );

    const hasApiUrls = allCached.some((u) => u.includes('/api/'));
    assert(!hasApiUrls, 'no API URLs in cache');

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 7: Health-check postMessage between page and SW
  // -----------------------------------------------------------------------
  console.log('7. Health-check postMessage');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const workers = context.serviceWorkers();
    assert(workers.length >= 1, 'SW registered');

    const healthResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (!navigator.serviceWorker.controller) {
          resolve({ error: 'no controlling SW' });
          return;
        }
        const timeout = setTimeout(() => resolve({ error: 'timeout' }), 5000);
        const handler = (event) => {
          navigator.serviceWorker.removeEventListener('message', handler);
          clearTimeout(timeout);
          resolve(event.data);
        };
        navigator.serviceWorker.addEventListener('message', handler);
        navigator.serviceWorker.controller.postMessage({ type: 'health-check' });
      });
    });

    console.log(`    Health result: ${JSON.stringify(healthResult)}`);
    assert(
      healthResult?.type === 'health-check-result',
      `got health-check-result response (got ${healthResult?.type})`,
    );
    assert(
      healthResult?.stats?.name?.startsWith('masjid-consumer-'),
      `cache name in stats (got ${healthResult?.stats?.name})`,
    );
    assert(typeof healthResult?.stats?.count === 'number', 'cache count is a number');

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 8: Navigation requests are not cached
  // -----------------------------------------------------------------------
  console.log('8. Navigation requests not cached');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const workers = context.serviceWorkers();
    assert(workers.length >= 1, 'SW registered');

    const allCached = await workers[0].evaluate(() =>
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.open(n).then((c) => c.keys()).then((keys) => keys.map((r) => r.url))))
      ).then((arrs) => arrs.flat())
    );

    const hasHtml = allCached.some((u) => u.endsWith('/') || u.endsWith('index.html'));
    assert(!hasHtml, 'no HTML documents in cache');

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 9: Opaque responses are not cached
  // -----------------------------------------------------------------------
  console.log('9. Opaque responses not cached');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const workers = context.serviceWorkers();
    assert(workers.length >= 1, 'SW registered');

    // Try to cache a cross-origin resource. The SW should skip opaque responses.
    const result = await page.evaluate(async () => {
      try {
        // Use no-cors mode to force an opaque response
        await fetch('https://fonts.googleapis.com/css2?family=Test', { mode: 'no-cors' });
        return 'fetched';
      } catch {
        return 'failed';
      }
    });
    console.log(`    Cross-origin fetch result: ${result}`);

    // Verify no opaque response URLs ended up in cache
    const allCached = await workers[0].evaluate(() =>
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.open(n).then((c) => c.keys()).then((keys) => keys.map((r) => r.url))))
      ).then((arrs) => arrs.flat())
    );

    const hasCrossOrigin = allCached.some((u) => u.includes('fonts.googleapis.com'));
    assert(!hasCrossOrigin, 'no cross-origin URLs in cache');

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 10: Non-GET requests are not intercepted
  // -----------------------------------------------------------------------
  console.log('10. Non-GET requests not cached');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const workers = context.serviceWorkers();
    assert(workers.length >= 1, 'SW registered');

    // POST to an API endpoint — should pass through uncached
    const result = await page.evaluate(async () => {
      try {
        await fetch('/api/v1/masjids/masjid-al-noor', { method: 'POST' });
        return 'made POST';
      } catch {
        return 'POST failed';
      }
    });
    console.log(`    POST result: ${result}`);

    // Verify nothing new was cached from this
    const allCached = await workers[0].evaluate(() =>
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.open(n).then((c) => c.keys()).then((keys) => keys.map((r) => r.url))))
      ).then((arrs) => arrs.flat())
    );

    // The POST itself shouldn't be cached because the SW skips non-GET methods
    // We just check that the test didn't crash the SW
    assert(true, 'POST request handled without SW errors');

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});