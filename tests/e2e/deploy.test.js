// ---------------------------------------------------------------------------
// Deploy artifact integrity suite — implements DEP-01..DEP-06 from
// docs/integration-test-cases.md.
//
// Remote-only (staging + prod). Self-skips with a note when local.
// Run directly: node tests/e2e/deploy.test.js
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReporter } from './helpers.js';
import { targets, SLUG_A } from './targets.js';

const cfg = targets();
const t = createReporter(`Deploy integrity [${cfg.env}] → ${cfg.consumer}`);

if (!cfg.remote) {
  t.skip('DEP-all', 'remote-only — no deployed pages to verify locally. Run with E2E_ENV=staging or E2E_ENV=prod');
  process.exit((await t.done()) > 0 ? 1 : 0);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MERGED_DIR = path.resolve(HERE, '../../.merged');

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function getResponse(url) {
  const sep = url.includes('?') ? '&' : '?';
  const cb = `${sep}cb=${Math.random().toString(36).slice(2, 10)}`;
  try {
    const resp = await fetch(`${url}${cb}`, { signal: AbortSignal.timeout(20000) });
    const text = await resp.text();
    return { status: resp.status, headers: resp.headers, text };
  } catch (err) {
    // Bounded failure: assertions see status 0 and fail cleanly, never hang.
    return { status: 0, headers: new Headers(), text: String(err?.message ?? err) };
  }
}

// DEP-01 — route→SPA mapping: each path returns 200 HTML, cache-control no-store
// /display/ body differs from / body (wrong-fallback routing makes them identical)
console.log('\n  DEP-01 route→SPA mapping');
{
  const routes = [
    ['/', 'root'],
    [`/${SLUG_A}`, 'masjid page'],
    [`/display/${SLUG_A}`, 'TV display'],
    [`/admin/${SLUG_A}`, 'admin dashboard'],
    ['/login', 'login page'],
  ];

  const bodies = {};
  for (const [route, label] of routes) {
    const r = await getResponse(`${cfg.consumer}${route}`);
    const ct = r.headers.get('content-type') || '';
    const cc = r.headers.get('cache-control') || '';
    t.assert(r.status === 200, `DEP-01 ${label} (${route}) → 200 (got ${r.status})`);
    t.assert(
      ct.includes('text/html'),
      `DEP-01 ${label} content-type text/html (got "${ct}")`,
    );
    t.assert(
      cc.includes('no-store'),
      `DEP-01 ${label} cache-control includes no-store (got "${cc}")`,
    );
    bodies[route] = r.text;
  }

  // /display/ body MUST differ from / body
  if (bodies['/'] && bodies[`/display/${SLUG_A}`]) {
    t.assert(
      bodies['/'] !== bodies[`/display/${SLUG_A}`],
      'DEP-01 consumer root body ≠ TV display body (different SPAs)',
    );
  }
}

// DEP-02 — SPA hash match (stale-deploy detector)
// Self-skip when .merged/ directory is absent
console.log('\n  DEP-02 SPA hash match');
{
  const consumerHtml = path.join(MERGED_DIR, '__consumer_spa.html');
  const tvHtml = path.join(MERGED_DIR, '__tv_spa.html');
  const adminHtml = path.join(MERGED_DIR, '__admin_spa.html');

  if (!existsSync(consumerHtml) || !existsSync(tvHtml) || !existsSync(adminHtml)) {
    t.skip('DEP-02', `.merged/ directory incomplete — run "node tooling/merge-pages.js" first`);
  } else {
    const localHashes = {
      consumer: sha256(readFileSync(consumerHtml, 'utf8')),
      tv: sha256(readFileSync(tvHtml, 'utf8')),
      admin: sha256(readFileSync(adminHtml, 'utf8')),
    };

    const remoteChecks = [
      ['consumer', `${cfg.consumer}/`],
      ['tv', `${cfg.consumer}/display/${SLUG_A}`],
      ['admin', `${cfg.consumer}/admin/${SLUG_A}`],
    ];

    for (const [name, url] of remoteChecks) {
      const r = await getResponse(url);
      const remoteHash = sha256(r.text);
      t.assert(
        r.status === 200 && remoteHash === localHashes[name],
        `DEP-02 ${name} SPA hash matches local build (local: ${localHashes[name].slice(0, 12)}..., remote: ${remoteHash.slice(0, 12)}...)`,
      );
    }
  }
}

// DEP-03 — immutable chunk headers
console.log('\n  DEP-03 immutable chunk headers');
{
  const r = await getResponse(`${cfg.consumer}/`);
  const match = r.text.match(/_app\/immutable\/[^"']+\.js/);
  if (!match) {
    t.assert(false, 'DEP-03 could not find an immutable JS chunk in consumer HTML');
  } else {
    const chunkUrl = `${cfg.consumer}/${match[0]}`;
    const cr = await getResponse(chunkUrl);
    const cc = (cr.headers.get('cache-control') || '').replace(/\s+/g, ' ').trim();
    t.assert(
      cc === 'public, max-age=31536000, immutable',
      `DEP-03 immutable chunk cache-control exactly "public, max-age=31536000, immutable" (got "${cc}")`,
    );
  }
}

// DEP-04 — service worker headers + hash
console.log('\n  DEP-04 service worker headers');
{
  const r = await getResponse(`${cfg.consumer}/sw.js`);
  t.assert(r.status === 200, `DEP-04 /sw.js → 200 (got ${r.status})`);
  const cc = (r.headers.get('cache-control') || '').toLowerCase();
  t.assert(cc.includes('no-store'), `DEP-04 /sw.js cache-control includes no-store (got "${cc}")`);
  t.assert(
    !r.text.includes('__BUILD_HASH__'),
    'DEP-04 /sw.js body does not contain __BUILD_HASH__ placeholder',
  );
}

// DEP-05 — API URL baked into the bundle. The api.ts module is in a
// lazy-loaded chunk, so it won't appear in the root page HTML. We walk
// the JS dependency chain: start from all chunks referenced in the root
// and masjid page HTML, download each one, extract any chunk references
// (both absolute _"app/immutable/…"_ paths and relative _../chunks/…_
// import specifiers), and follow those recursively until we find the
// API host or exhaust the set of known chunk URLs.
console.log('\n  DEP-05 API URL in bundle');
{
  const apiHost = new URL(cfg.api).host;

  function chunkPaths(html) {
    const paths = new Set();
    for (const m of html.matchAll(/_app\/immutable\/[^"')<> ]+\.js/g)) {
      paths.add(m[0]);
    }
    return paths;
  }

  /**
   * Normalise a chunk reference into an _app/immutable/… path.
   *   ".. / chunks / foo.js"  →  "_app/immutable/chunks/foo.js"
   *   ".  / chunks / foo.js"  →  "_app/immutable/chunks/foo.js"
   *   "_app/immutable/…"      →  kept as-is
   */
  function normaliseRef(ref) {
    if (ref.startsWith('_app/')) return ref;
    // relative import, e.g.  "../chunks/DHDIa3K-.js"
    const cleaned = ref.replace(/^["'(]+/, '').replace(/^\.\.?\//, '');
    if (cleaned.startsWith('chunks/')) return `_app/immutable/${cleaned}`;
    return null;
  }

  const rootHtml = (await getResponse(`${cfg.consumer}/`)).text;
  const masjidHtml = (await getResponse(`${cfg.consumer}/${SLUG_A}`)).text;
  const seen = new Set();
  const queue = [rootHtml, masjidHtml].flatMap((h) => [...chunkPaths(h)]);
  for (const p of queue) seen.add(p);

  let found = false;

  for (let i = 0; i < queue.length && !found; i++) {
    const chunkPath = queue[i];
    const cr = await getResponse(`${cfg.consumer}/${chunkPath}`);

    if (cr.text.includes(apiHost)) {
      found = true;
      console.log(`  DEP-05 found API host in ${chunkPath}`);
      break;
    }

    // Collect both absolute and relative chunk references
    const fromSource = [
      ...cr.text.matchAll(/_app\/immutable\/[^"')<> ]+\.js/g),
      ...cr.text.matchAll(/["'(]\.\.\/chunks\/[^"')<> ]+\.js/g),
      ...cr.text.matchAll(/["'(]\.\/chunks\/[^"')<> ]+\.js/g),
    ].map((m) => m[0]);

    for (const raw of fromSource) {
      const ref = normaliseRef(raw);
      if (ref && !seen.has(ref)) {
        seen.add(ref);
        queue.push(ref);
      }
    }
  }

  t.assert(found, `DEP-05 at least one JS chunk contains API host "${apiHost}"`);
}

// DEP-06 — SPA fallbacks are pairwise distinct
console.log('\n  DEP-06 SPA fallbacks distinct');
{
  const urls = [
    `${cfg.consumer}/${SLUG_A}`,
    `${cfg.consumer}/display/${SLUG_A}`,
    `${cfg.consumer}/admin/${SLUG_A}`,
  ];
  const bodies = await Promise.all(urls.map((u) => getResponse(u).then((r) => r.text)));

  t.assert(bodies[0] !== bodies[1], 'DEP-06 consumer ≠ TV');
  t.assert(bodies[0] !== bodies[2], 'DEP-06 consumer ≠ admin');
  t.assert(bodies[1] !== bodies[2], 'DEP-06 TV ≠ admin');
}

process.exit((await t.done()) > 0 ? 1 : 0);