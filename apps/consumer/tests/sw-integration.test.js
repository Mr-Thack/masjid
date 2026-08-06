// ---------------------------------------------------------------------------
// Integration tests for the service-worker REMOVAL strategy
//
// The consumer app no longer registers a service worker. What remains:
//   - /sw.js serves a "suicide worker" that heals old installs (purges all
//     CacheStorage caches, then unregisters itself). Kept indefinitely.
//   - /sw-kill is a permanent gateway-served recovery page (tested against
//     deployed envs in tests/e2e/deploy.test.js — there is no gateway in
//     vite dev, so it is not asserted here).
//
// Prerequisites: consumer dev server running on localhost:5175
//                and API server running on localhost:5173
//
// Run: node tests/sw-integration.test.js
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

const BASE = process.env.SW_TEST_BASE || 'http://localhost:5175';
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
  console.log('\n=== Service Worker Removal Tests ===\n');

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // -----------------------------------------------------------------------
  // Test 1: page load registers NO service worker
  // -----------------------------------------------------------------------
  console.log('1. No SW registration on page load');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const workers = context.serviceWorkers();
    assert(workers.length === 0, `no SW registered after page load (got ${workers.length})`);

    const hasReg = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg !== undefined;
    });
    assert(!hasReg, 'in-page getRegistration() is undefined');

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 2: /sw.js serves the suicide worker
  // -----------------------------------------------------------------------
  console.log('2. Suicide worker content');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });

    const result = await page.evaluate(async () => {
      const resp = await fetch('/sw.js');
      return {
        status: resp.status,
        contentType: resp.headers.get('content-type') || '',
        body: await resp.text(),
      };
    });

    assert(result.status === 200, `/sw.js → 200 (got ${result.status})`);
    assert(
      result.contentType.includes('javascript'),
      `/sw.js content-type is JavaScript (got "${result.contentType}")`,
    );
    assert(
      result.body.includes('registration.unregister'),
      '/sw.js unregisters itself on activate',
    );
    assert(
      result.body.includes('caches.delete'),
      '/sw.js purges CacheStorage on activate',
    );
    assert(
      !result.body.includes('__BUILD_HASH__'),
      '/sw.js contains no __BUILD_HASH__ placeholder',
    );
    assert(
      !result.body.includes("addEventListener('fetch'") &&
        !result.body.includes('addEventListener("fetch"'),
      '/sw.js has NO fetch handler (intercepts nothing)',
    );

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 3: suicide worker heals a stale install — purges caches, then
  // unregisters itself (simulates a browser carrying the OLD worker)
  // -----------------------------------------------------------------------
  console.log('3. Suicide worker self-removal');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });

    // Seed junk state that mimics the old cache-first worker's leftovers.
    await page.evaluate(async () => {
      const cache = await caches.open('masjid-consumer-stalejunk');
      await cache.put('/junk-entry', new Response('stale'));
    });
    const seeded = await page.evaluate(() => caches.keys());
    assert(
      seeded.includes('masjid-consumer-stalejunk'),
      `junk cache seeded before registration (got ${JSON.stringify(seeded)})`,
    );

    // Register the suicide worker exactly as an old install would have it.
    await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));

    // The worker installs → activates → purges caches → unregisters itself.
    let healed = false;
    for (let i = 0; i < 40 && !healed; i++) {
      await page.waitForTimeout(250);
      healed = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const names = await caches.keys();
        return reg === undefined && names.length === 0;
      });
    }
    assert(healed, 'after activate: registration gone AND all caches purged');

    await context.close();
  }

  // -----------------------------------------------------------------------
  // Test 4: page still functions with no SW at all (sanity — the app must
  // never depend on a worker existing)
  // -----------------------------------------------------------------------
  console.log('4. App works with no service worker');
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE}${MASJID}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true', { timeout: 30000 });

    const text = await page.evaluate(() => document.body.innerText);
    assert(text.length > 100, `masjid page rendered content (${text.length} chars)`);

    const workers = context.serviceWorkers();
    assert(workers.length === 0, 'still no SW after full hydration');

    await context.close();
  }

  await browser.close();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
