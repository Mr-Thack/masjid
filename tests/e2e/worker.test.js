// ---------------------------------------------------------------------------
// Worker/API-runtime suite — implements WRK-01..WRK-05 from
// docs/integration-test-cases.md.
//
// These cases exist because several production incidents were API-side and
// INVISIBLE to the Node-based unit tests: workerd-only crashes (lessons
// 1–3), D1 batch/schema drift (lessons 15, 18), non-atomic multi-table
// writes (lesson 20). Unit tests run in Node against better-sqlite3; this
// suite runs against the REAL worker + REAL D1 (staging) — or the local dev
// server when E2E_ENV=local.
//
// Run directly: node tests/e2e/worker.test.js
// ---------------------------------------------------------------------------

import { execSync } from 'node:child_process';
import { createReporter } from './helpers.js';
import { targets } from './targets.js';

const cfg = targets();
const t = createReporter(`Worker/API runtime [${cfg.env}] → ${cfg.api}`);

// Bounded fetch: a hung worker becomes a FAIL line (status 0), never a hung
// CI job or an uncaught exception. 502/503/52x responses trigger up to 2
// retries with a 5s delay — the same Cloudflare edge-propagation allowance
// api.test.js has (lesson 36). This suite runs FIRST after a deploy (the
// e2e-api job has historically run inside the 503 window), so it needs the
// retry most.
const RETRYABLE = new Set([502, 503, 520, 521, 522, 523, 524]);
async function req(method, path, { body, token } = {}, attempt = 0) {
  try {
    const resp = await fetch(`${cfg.api}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (RETRYABLE.has(resp.status) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000));
      return req(method, path, { body, token }, attempt + 1);
    }
    const text = await resp.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* stays null — HTML or empty body */
    }
    return { status: resp.status, json, isJson: json !== null, text: text.slice(0, 300) };
  } catch (err) {
    const msg = String(err?.message ?? err);
    return { status: 0, json: null, isJson: false, text: msg.slice(0, 300) };
  }
}

// WRK-01 — runtime health: the worker module initialized (no workerd-only
// crash, lessons 1–3/7), D1 binding works, and it reports the EXPECTED
// environment for this target (catches pointing staging tests at prod, or
// a staging deploy that accidentally shipped with ENVIRONMENT=production).
{
  const r = await req('GET', '/api/v1/status');
  t.assert(r.status === 200, `WRK-01 status 200 (got ${r.status}) — worker booted in its real runtime`);
  t.assert(r.isJson && r.json?.db?.connected === true, 'WRK-01 D1 connected from the worker');
  t.assert(
    r.json?.env?.environment === cfg.expectedEnvironment,
    `WRK-01 ENVIRONMENT === "${cfg.expectedEnvironment}" (got "${r.json?.env?.environment}")`,
  );
}

// WRK-02 — debug endpoint: DB connectivity + bcrypt verified inside the real
// runtime (lesson 21 pattern — this endpoint exists for exactly this).
{
  const r = await req('GET', '/api/v1/debug');
  t.assert(r.status === 200, `WRK-02 debug 200 (got ${r.status})`);
  t.assert(r.isJson, 'WRK-02 debug returns JSON (not an HTML error page)');
}

// WRK-03 — registration smoke (WRITES; local + staging only).
// Exercises the exact lesson-15/18/20 stack: CreateMasjidSchema → bcrypt →
// db.batch atomic insert of masjid + masjid_themes (style_system /
// style_options / label_* columns — the lesson-18 drift columns) + admins.
// Then proves the new masjid actually serves prayer times.
if (!cfg.writes) {
  t.skip('WRK-03 registration smoke', 'read-only env');
  t.skip('WRK-03b duplicate slug 409', 'read-only env');
  t.skip('WRK-03c smoke masjid serves times', 'read-only env');
} else {
  const rand = Math.random().toString(36).slice(2, 8);
  const slug = `e2e-smoke-${rand}`;
  const payload = {
    slug,
    name: 'E2E Smoke Masjid',
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: 'America/Chicago',
    calculation_method: 2,
    asr_madhab: 'shafi',
    high_latitude_rule: 'seventh_of_night',
    show_dual_asr: false,
    admin_email: `e2e-smoke-${rand}@example.com`,
    admin_password: 'e2e-smoke-password-123',
  };

  const r = await req('POST', '/api/v1/auth/register', { body: payload });
  t.assert(
    (r.status === 200 || r.status === 201) && r.isJson,
    `WRK-03 register ${slug} → 200/201 JSON (got ${r.status}: ${r.isJson ? '' : r.text})`,
  );

  const dup = await req('POST', '/api/v1/auth/register', { body: payload });
  t.assert(
    dup.status === 409 && dup.json?.error?.code === 'CONFLICT',
    `WRK-03b duplicate slug → 409 CONFLICT (got ${dup.status})`,
  );

  const page = await req('GET', `/api/v1/masjids/${slug}`);
  t.assert(
    page.status === 200 && page.json?.prayer_times?.fajr?.adhaan && page.json?.theme?.style_system,
    `WRK-03c new masjid serves prayer_times + theme (got ${page.status})`,
  );
  // Note: each run leaves an e2e-smoke-* masjid behind. Local and staging
  // DBs are disposable — re-seed staging if clutter matters (§4 checklist).
}

// WRK-04 — login + authenticated round-trip in the real runtime (JWT sign +
// verify + bcrypt through the worker, not Node). Guarded on credentials:
// local + staging use the seeded admin; prod skips unless E2E_ADMIN_* set.
if (!cfg.adminEmail) {
  t.skip('WRK-04 login round-trip', 'no admin credentials for this env');
  t.skip('WRK-04b /auth/me', 'no admin credentials for this env');
} else {
  const login = await req('POST', '/api/v1/auth/login', {
    body: { email: cfg.adminEmail, password: cfg.adminPassword },
  });
  const token = login.json?.token;
  t.assert(login.status === 200 && typeof token === 'string', `WRK-04 login 200 + token (got ${login.status})`);

  const me = await req('GET', '/api/v1/auth/me', { token });
  t.assert(
    me.status === 200 && me.json?.admin?.email === cfg.adminEmail,
    `WRK-04b /auth/me returns the logged-in admin (got ${me.status})`,
  );
}

// WRK-05 — schema-drift guard (lesson 18: Drizzle schema vs schema.sql).
// Static check on the checked-out commit — runs wherever the repo is
// checked out (local + CI e2e jobs). Skipped on prod: prod runs against the
// deployed artifact, and this guard's job is to fire BEFORE deploy.
if (cfg.env === 'prod') {
  t.skip('WRK-05 schema drift check', 'pre-deploy guard, not a runtime check');
} else {
  try {
    execSync('npm run check-schema', { stdio: 'pipe' });
    t.assert(true, 'WRK-05 schema.sql ↔ Drizzle schema in sync');
  } catch (e) {
    t.assert(false, `WRK-05 schema drift detected: ${String(e.message).slice(0, 200)}`);
  }
}

process.exit((await t.done()) > 0 ? 1 : 0);
