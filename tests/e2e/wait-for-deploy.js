// ---------------------------------------------------------------------------
// Post-deploy readiness probe — replaces the blind `sleep 30` that used to
// precede the browser suites in CI.
//
// Why: right after `wrangler pages deploy`, different edge nodes serve old vs
// new versions for minutes (lesson 28) and every asset is no-store, so the
// first cold hits are slow. Browser suites that start immediately see
// interleaved "text not found" failures and 20-45s cases (2026-08-06 staging
// run: consumer/tv red on a fresh deploy, fully green on rerun against the
// settled deploy — same code, same tests).
//
// This probe polls until the runner's network path consistently serves the
// JUST-DEPLOYED version, which both verifies propagation and warms the edge:
//   1. the page URL returns 200 HTML
//   2. its <meta name="build-id"> matches GITHUB_SHA (when both are present)
//   3. every referenced /_app/immutable chunk returns 200 non-HTML (a 404 or
//      SPA-shell-for-chunk means mixed-version serving — not ready)
//   4. the API /status endpoint answers 200 (warms a cold worker)
// Two consecutive clean rounds = ready. Exits non-zero on timeout.
//
// Usage: node tests/e2e/wait-for-deploy.js <consumer|tv|admin|api> [path]
// Env:   E2E_ENV (via targets.js), GITHUB_SHA (CI), E2E_PROBE_MAX_MS (240s),
//        E2E_PROBE_CLEAN_ROUNDS (2)
// ---------------------------------------------------------------------------

import { targets, SLUG_A } from './targets.js';

const APP_PATHS = {
  consumer: `/${SLUG_A}`,
  tv: `/display/${SLUG_A}`,
  admin: '/login',
  api: null, // api mode: no page checks — worker /status + build_id only
};

const MAX_MS = Number(process.env.E2E_PROBE_MAX_MS || 240_000);
const NEED_CLEAN = Number(process.env.E2E_PROBE_CLEAN_ROUNDS || 2);
const INTERVAL_MS = 4_000;

const app = process.argv[2];
const explicitPath = process.argv[3];
if (!app || !APP_PATHS[app]) {
  console.error(`Usage: node tests/e2e/wait-for-deploy.js <${Object.keys(APP_PATHS).join('|')}> [path]`);
  process.exit(2);
}

const cfg = targets();
const isApiMode = app === 'api';
const pageUrl = isApiMode ? null : `${cfg[app]}${explicitPath || APP_PATHS[app]}`;
const expectedBuild = process.env.GITHUB_SHA || '';

async function get(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    return { ok: true, status: resp.status, ct: resp.headers.get('content-type') || '', text: await resp.text() };
  } catch (err) {
    return { ok: false, status: 0, ct: '', text: '', err: err instanceof Error ? err.message : String(err) };
  }
}

// The worker's /status returns build_id (git short hash injected at build
// time). A 200 from a mid-propagation OLD worker is NOT readiness — when
// GITHUB_SHA is known, the build_id must match it. This was the probe gap
// that let browser suites run against a mixed-version backend.
function checkApiBuildId(problems, statusJson) {
  if (!expectedBuild || !statusJson) return;
  const id = statusJson.build_id;
  if (!id || String(id).includes('__')) return; // unreplaced dev placeholder
  if (!expectedBuild.startsWith(String(id)) && !String(id).startsWith(expectedBuild.slice(0, 12))) {
    problems.push(`api build_id ${id} ≠ GITHUB_SHA ${expectedBuild.slice(0, 12)}… (old worker still serving)`);
  }
}

async function round(n) {
  const problems = [];

  if (!isApiMode) {
    // 1. the page itself
    const page = await get(`${pageUrl}?probe=${n}-${Date.now()}`);
    if (!page.ok || page.status !== 200 || !page.ct.includes('text/html')) {
      problems.push(`page ${pageUrl} → ${page.status} ${page.ct}${page.err ? ` (${page.err})` : ''}`);
      return problems; // no HTML → nothing else to extract this round
    }

    // 2. build-id matches the commit under test (when knowable)
    const meta = page.text.match(/<meta name="build-id" content="([^"]+)"/);
    if (expectedBuild && meta) {
      if (!expectedBuild.startsWith(meta[1])) {
        problems.push(`build-id ${meta[1]} ≠ GITHUB_SHA ${expectedBuild.slice(0, 12)}… (old deployment still serving)`);
      }
    } else if (expectedBuild && !meta) {
      if (n === 1) console.log('  probe: no build-id meta in shell — version check skipped');
    }

    // 3. referenced immutable chunks must be real assets, not 404 / SPA shell
    const assets = [...new Set([...page.text.matchAll(/\/(_app\/immutable\/[^"'\s]+\.(?:js|css))/g)].map((m) => m[1]))].slice(0, 8);
    const origin = new URL(pageUrl).origin;
    const assetResults = await Promise.all(assets.map((a) => get(`${origin}/${a}`)));
    for (let i = 0; i < assets.length; i++) {
      const r = assetResults[i];
      if (!r.ok || r.status !== 200 || r.ct.includes('text/html')) {
        problems.push(`chunk /${assets[i]} → ${r.status} ${r.ct}`);
      }
    }
  }

  // 4. API worker is awake AND serving THIS commit (page loads will hit it
  // immediately). In api mode this is the only check.
  const api = await get(`${cfg.api}/api/v1/status`);
  if (!api.ok || api.status !== 200) {
    problems.push(`api /api/v1/status → ${api.status}${api.err ? ` (${api.err})` : ''}`);
  } else {
    try {
      checkApiBuildId(problems, JSON.parse(api.text));
    } catch {
      problems.push('api /api/v1/status → 200 but non-JSON body');
    }
  }

  return problems;
}

const start = Date.now();
let clean = 0;
let n = 0;
console.log(
  isApiMode
    ? `\n  probe: waiting for ${cfg.api} to serve the fresh worker (max ${Math.round(MAX_MS / 1000)}s)`
    : `\n  probe: waiting for ${pageUrl} to serve the fresh deploy (max ${Math.round(MAX_MS / 1000)}s)`,
);

while (Date.now() - start < MAX_MS) {
  n++;
  const problems = await round(n);
  if (problems.length === 0) {
    clean++;
    console.log(`  probe: round ${n} clean (${clean}/${NEED_CLEAN})`);
    if (clean >= NEED_CLEAN) {
      console.log(`  probe: deploy ready after ${Math.round((Date.now() - start) / 1000)}s\n`);
      process.exit(0);
    }
  } else {
    clean = 0;
    console.log(`  probe: round ${n} not ready — ${problems.join('; ')}`);
  }
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}

console.error(`\n  probe: TIMEOUT after ${Math.round(MAX_MS / 1000)}s — deployment never became consistent`);
process.exit(1);
