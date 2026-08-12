// ---------------------------------------------------------------------------
// API smoke suite (no browser) — implements cases API-01..API-08 from
// docs/integration-test-cases.md. Run directly: node tests/e2e/api.test.js
// ---------------------------------------------------------------------------

import { createReporter } from './helpers.js';
import { targets, SLUG_A, SLUG_B, SLUG_UNKNOWN } from './targets.js';

const cfg = targets();
const t = createReporter(`API smoke [${cfg.env}] → ${cfg.api}`);

// Every fetch is bounded (15s) and failures return status 0 instead of
// throwing — a hung/unreachable API becomes a FAIL line, never a hung CI job
// or an uncaught exception. 503 responses trigger up to 2 retries with a 5s
// delay (Cloudflare edge propagation after deploy can take ~30s).
async function getJson(path, headers = {}, attempt = 0) {
  try {
    const resp = await fetch(`${cfg.api}${path}`, { headers, signal: AbortSignal.timeout(15000) });
    if (resp.status === 503 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000));
      return getJson(path, headers, attempt + 1);
    }
    const text = await resp.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* body stays null */
    }
    return { status: resp.status, headers: resp.headers, body, isJson: body !== null };
  } catch (err) {
    return { status: 0, headers: new Headers(), body: null, isJson: false, error: String(err?.message ?? err) };
  }
}

async function postJson(path, payload, attempt = 0) {
  try {
    const resp = await fetch(`${cfg.api}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (resp.status === 503 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000));
      return postJson(path, payload, attempt + 1);
    }
    const text = await resp.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* body stays null */ }
    return { status: resp.status, body, isJson: body !== null };
  } catch (err) {
    return { status: 0, body: null, isJson: false, error: String(err?.message ?? err) };
  }
}

// API-01 — status endpoint healthy
{
  const r = await getJson('/api/v1/status');
  t.assert(r.status === 200, `API-01 status 200 (got ${r.status})`);
  t.assert(r.isJson && r.body?.db?.connected === true, 'API-01 status JSON, db.connected === true');
}

// API-02 — debug endpoint healthy
{
  const r = await getJson('/api/v1/debug');
  t.assert(r.status === 200, `API-02 debug 200 (got ${r.status})`);
  t.assert(r.isJson, 'API-02 debug returns JSON');
}

// API-03 — masjid page payload, both slugs
for (const [id, slug] of [
  ['API-03a', SLUG_A],
  ['API-03b', SLUG_B],
]) {
  const r = await getJson(`/api/v1/masjids/${slug}`);
  t.assert(r.status === 200, `${id} ${slug} 200 (got ${r.status})`);
  const pt = r.body?.prayer_times;
  const five = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  t.assert(
    r.isJson && r.body?.theme && five.every((p) => pt?.[p]?.adhaan && pt?.[p]?.iqaamah),
    `${id} theme + all 5 prayers have adhaan/iqaamah`,
  );
  t.assert(Boolean(pt?.sunrise), `${id} sunrise present`);
}

// API-04 — board payload, both slugs
for (const [id, slug] of [
  ['API-04a', SLUG_A],
  ['API-04b', SLUG_B],
]) {
  const r = await getJson(`/api/v1/masjids/${slug}/board`);
  t.assert(r.status === 200, `${id} board 200 (got ${r.status})`);
  t.assert(
    r.isJson && typeof r.body?.server_time === 'string' && r.body?.today?.times && r.body?.theme,
    `${id} server_time + today.times + theme present`,
  );
  t.assert(
    Array.isArray(r.body?.upcoming_days) && r.body.upcoming_days.length === 7,
    `${id} upcoming_days has 7 entries (got ${r.body?.upcoming_days?.length})`,
  );
}

// API-05 — maktab public payload
{
  const r = await getJson(`/api/v1/masjids/${SLUG_A}/maktab`);
  t.assert(r.status === 200, `API-05 maktab 200 (got ${r.status})`);
  t.assert(
    r.isJson && typeof r.body?.open === 'boolean' && 'term' in (r.body ?? {}),
    'API-05 maktab has open flag + term',
  );
}

// API-06 — unknown masjid → JSON 404, never HTML/500
{
  const r = await getJson(`/api/v1/masjids/${SLUG_UNKNOWN}`);
  t.assert(r.status === 404, `API-06 unknown masjid 404 (got ${r.status})`);
  t.assert(r.isJson && r.body?.error?.code === 'NOT_FOUND', 'API-06 JSON error body, code NOT_FOUND');
}

// API-07 — CORS reflects the page origin
{
  const pageOrigin = new URL(cfg.consumer).origin;
  const r = await getJson('/api/v1/status', { Origin: pageOrigin });
  const allow = r.headers.get('access-control-allow-origin');
  t.assert(allow === pageOrigin, `API-07 CORS allow-origin echoes ${pageOrigin} (got ${allow})`);
}

// API-08 — CORS preflight
{
  const pageOrigin = new URL(cfg.consumer).origin;
  const resp = await fetch(`${cfg.api}/api/v1/status`, {
    method: 'OPTIONS',
    headers: {
      Origin: pageOrigin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
    signal: AbortSignal.timeout(15000),
  }).catch((err) => ({ status: 0, headers: new Headers(), error: String(err?.message ?? err) }));
  const allowMethods = resp.headers.get('access-control-allow-methods') || '';
  const allowHeaders = resp.headers.get('access-control-allow-headers') || '';
  t.assert(resp.status < 400, `API-08 preflight status < 400 (got ${resp.status})`);
  t.assert(
    allowMethods.includes('GET') && /authorization/i.test(allowHeaders),
    `API-08 preflight allows GET + Authorization (${allowMethods} | ${allowHeaders})`,
  );
}

// API-09 — masjid sub-endpoints return valid data (no 400/500)
for (const [id, path, check] of [
  ['API-09a', `prayer?date=2026-08-01`, (b) => b?.times && b?.masjid],
  ['API-09b', 'jumuah', (b) => Array.isArray(b?.sessions)],
  ['API-09c', 'announcements', (b) => Array.isArray(b?.announcements)],
]) {
  const r = await getJson(`/api/v1/masjids/${SLUG_A}/${path}`);
  t.assert(r.status === 200, `${id} ${path} → 200 (got ${r.status})`);
  t.assert(r.isJson && check(r.body), `${id} body passes shape check`);
}

// API-10 — non-existent announcement returns proper error, never 500
{
  const r = await getJson(`/api/v1/masjids/${SLUG_A}/announcements/this-does-not-exist`);
  t.assert(
    r.status === 404 && r.isJson,
    `API-10 unknown announcement → 404 JSON (got ${r.status})`,
  );
}

// API-11 — maktab verify-code without body returns validation error, never 500
{
  const r = await postJson(`/api/v1/masjids/${SLUG_A}/maktab/verify-code`, {});
  t.assert(
    r.status < 500,
    `API-11 verify-code without code → status < 500 (got ${r.status})`,
  );
  t.assert(
    r.body !== null,
    `API-11 verify-code returns JSON (not HTML/empty)`,
  );
}

// API-12 — board endpoint for unknown masjid returns 404
{
  const r = await getJson(`/api/v1/masjids/${SLUG_UNKNOWN}/board`);
  t.assert(r.status === 404, `API-12 unknown board → 404 (got ${r.status})`);
  t.assert(r.isJson, 'API-12 body is JSON, not HTML');
}

// API-13 — prayer endpoint for unknown masjid returns 404
{
  const r = await getJson(`/api/v1/masjids/${SLUG_UNKNOWN}/prayer?date=2026-08-01`);
  t.assert(r.status === 404, `API-13 unknown prayer → 404 (got ${r.status})`);
  t.assert(r.isJson, 'API-13 body is JSON, not HTML');
}

// API-14 — bogus API sub-path returns proper error JSON, never HTML/500
{
  const r = await getJson('/api/v1/this-path-does-not-exist');
  t.assert(
    r.isJson && r.body?.error,
    `API-14 bogus API path → JSON error (isJson: ${r.isJson}, has error: ${Boolean(r.body?.error)})`,
  );
}

// API-15 — SLUG_B endpoints return valid data too (cross-masjid coverage)
for (const [id, path, check] of [
  ['API-15a', `prayer?date=2026-08-01`, (b) => b?.times && b?.masjid],
  ['API-15b', 'jumuah', (b) => Array.isArray(b?.sessions)],
  ['API-15c', 'announcements', (b) => Array.isArray(b?.announcements)],
  ['API-15d', 'maktab', (b) => typeof b?.open === 'boolean'],
]) {
  const r = await getJson(`/api/v1/masjids/${SLUG_B}/${path}`);
  t.assert(r.status === 200, `${id} SLUG_B ${path} → 200 (got ${r.status})`);
  t.assert(r.isJson && check(r.body), `${id} SLUG_B body passes shape check`);
}

// API-16 — maktab: rapid sequential fetches (no race-condition 500s)
{
  const results = await Promise.all([
    getJson(`/api/v1/masjids/${SLUG_A}/maktab`),
    getJson(`/api/v1/masjids/${SLUG_B}/maktab`),
    getJson(`/api/v1/masjids/${SLUG_A}/maktab`),
  ]);
  const all200 = results.every((r) => r.status === 200);
  const allJson = results.every((r) => r.isJson && typeof r.body?.open === 'boolean');
  t.assert(all200, `API-16 rapid maktab fetches all 200 (got ${results.map((r) => r.status).join(',')})`);
  t.assert(allJson, 'API-16 rapid maktab fetches all valid JSON');
}

// API-17 — maktab: verify-code with invalid postal code returns error, not 500
{
  const r = await postJson(`/api/v1/masjids/${SLUG_A}/maktab/verify-code`, { code: 'DEFINITELY-INVALID-CODE' });
  t.assert(
    r.status < 500,
    `API-17 verify-code with bad code → status < 500 (got ${r.status})`,
  );
  t.assert(r.body !== null, 'API-17 verify-code returns JSON');
}

// API-18 — maktab: POST enroll without Square token returns validation error, never 500
{
  const r = await postJson(`/api/v1/masjids/${SLUG_A}/maktab/enroll`, {});
  t.assert(
    r.status < 500,
    `API-18 enroll with empty body → status < 500 (got ${r.status})`,
  );
  t.assert(r.body !== null, 'API-18 enroll returns JSON');
}

// API-19 — maktab: unknown masjid maktab returns 404
{
  const r = await getJson(`/api/v1/masjids/${SLUG_UNKNOWN}/maktab`);
  t.assert(r.status === 404, `API-19 unknown maktab → 404 (got ${r.status})`);
  t.assert(r.isJson, 'API-19 body is JSON, not HTML');
}

// API-20 — weekly prayer endpoint returns expected shape
{
  const r = await getJson(`/api/v1/masjids/${SLUG_A}/prayer/weekly`);
  t.assert(r.status === 200, `API-20 weekly prayer → 200 (got ${r.status})`);
  t.assert(r.isJson, 'API-20 weekly prayer body is JSON');
  t.assert(r.body && Array.isArray(r.body.days), `API-20 has days array (len: ${r.body?.days?.length})`);
  t.assert(r.body && typeof r.body.masjid === 'object', 'API-20 has masjid object');
}

// API-21 — nav endpoint returns expected shape
{
  const r = await getJson(`/api/v1/masjids/${SLUG_A}/nav`);
  t.assert(r.status === 200, `API-21 nav → 200 (got ${r.status})`);
  t.assert(r.isJson, 'API-21 nav body is JSON');
  t.assert(r.body && Array.isArray(r.body.nav_items), `API-21 has nav_items array (len: ${r.body?.nav_items?.length})`);
}

process.exit((await t.done()) > 0 ? 1 : 0);
