// ---------------------------------------------------------------------------
// API smoke suite (no browser) — implements cases API-01..API-08 from
// docs/integration-test-cases.md. Run directly: node tests/e2e/api.test.js
// ---------------------------------------------------------------------------

import { createReporter } from './helpers.js';
import { targets, SLUG_A, SLUG_B, SLUG_UNKNOWN } from './targets.js';

const cfg = targets();
const t = createReporter(`API smoke [${cfg.env}] → ${cfg.api}`);

async function getJson(path, headers = {}) {
  const resp = await fetch(`${cfg.api}${path}`, { headers });
  const text = await resp.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* body stays null */
  }
  return { status: resp.status, headers: resp.headers, body, isJson: body !== null };
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
  });
  const allowMethods = resp.headers.get('access-control-allow-methods') || '';
  const allowHeaders = resp.headers.get('access-control-allow-headers') || '';
  t.assert(resp.status < 400, `API-08 preflight status < 400 (got ${resp.status})`);
  t.assert(
    allowMethods.includes('GET') && /authorization/i.test(allowHeaders),
    `API-08 preflight allows GET + Authorization (${allowMethods} | ${allowHeaders})`,
  );
}

process.exit((await t.done()) > 0 ? 1 : 0);
