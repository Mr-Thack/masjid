// ---------------------------------------------------------------------------
// E2E API client — for test SETUP/CLEANUP only (never the thing under test).
//
// Why this exists: UI-driven cleanup (hunting trash icons by text, re-toggling
// a checkbox and hoping the save button isn't disabled) was the single biggest
// source of staging-DB drift. Mutations are still CREATED through the UI (that
// is what the mutation tests prove), but state is RESTORED here, in `finally`
// blocks, via direct API calls — deterministic even when the test body throws.
//
// Login is cached per process (one bcrypt per suite, not per call).
// 503s are retried (Cloudflare edge propagation window — lesson 36).
// ---------------------------------------------------------------------------

const RETRYABLE = new Set([502, 503, 520, 521, 522, 523, 524]);

let session = null; // { token, masjidId } — cached for the process

export class ApiClientError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Login once per suite. Returns { token, masjidId }. Throws on failure —
// callers in test setup should let it throw inside testCase (becomes a FAIL
// line); callers in `finally` cleanup should wrap in try/catch.
export async function apiLogin(cfg) {
  if (session) return session;
  if (!cfg.adminEmail || !cfg.adminPassword) {
    throw new ApiClientError('apiLogin: no admin credentials for this env', 0);
  }
  const r = await rawRequest(cfg, 'POST', '/api/v1/auth/login', {
    email: cfg.adminEmail,
    password: cfg.adminPassword,
  });
  if (r.status !== 200 || !r.json?.token || !r.json?.admin?.masjid_id) {
    throw new ApiClientError(`apiLogin: login failed (${r.status})`, r.status);
  }
  session = { token: r.json.token, masjidId: r.json.admin.masjid_id };
  return session;
}

export async function rawRequest(cfg, method, path, body, token, attempt = 0) {
  try {
    const resp = await fetch(`${cfg.api}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (RETRYABLE.has(resp.status) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000));
      return rawRequest(cfg, method, path, body, token, attempt + 1);
    }
    const text = await resp.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* HTML or empty body */
    }
    return { status: resp.status, json, text: text.slice(0, 300) };
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000));
      return rawRequest(cfg, method, path, body, token, attempt + 1);
    }
    return { status: 0, json: null, text: String(err?.message ?? err).slice(0, 300) };
  }
}

async function request(cfg, method, path, body) {
  const { token } = await apiLogin(cfg);
  const r = await rawRequest(cfg, method, path, body, token);
  if (r.status === 401) {
    // Token rejected (shouldn't happen — 30d JWT) — refresh once.
    session = null;
    const { token: fresh } = await apiLogin(cfg);
    return rawRequest(cfg, method, path, body, fresh);
  }
  return r;
}

export const apiGet = (cfg, path) => request(cfg, 'GET', path);
export const apiPost = (cfg, path, body) => request(cfg, 'POST', path, body);
export const apiPut = (cfg, path, body) => request(cfg, 'PUT', path, body);
export const apiDelete = (cfg, path) => request(cfg, 'DELETE', path);

// --- entity helpers (cleanup by lookup, not by DOM) -------------------------

// Delete every announcement whose title starts with `titlePrefix`.
// Returns the number deleted. Safe to call in `finally` (never throws).
export async function deleteAnnouncementsByPrefix(cfg, masjidId, titlePrefix) {
  try {
    const list = await apiGet(cfg, `/api/v1/admin/masjids/${masjidId}/announcements`);
    const items = list.json?.announcements ?? list.json ?? [];
    let deleted = 0;
    for (const a of Array.isArray(items) ? items : []) {
      if (typeof a.title === 'string' && a.title.startsWith(titlePrefix) && a.slug) {
        const r = await apiDelete(cfg, `/api/v1/admin/masjids/${masjidId}/announcements/${a.slug}`);
        if (r.status >= 200 && r.status < 300) deleted++;
      }
    }
    return deleted;
  } catch {
    return 0;
  }
}

// Delete every prayer rule whose rule_name starts with `namePrefix`. Never throws.
export async function deletePrayerRulesByPrefix(cfg, masjidId, namePrefix) {
  try {
    const list = await apiGet(cfg, `/api/v1/admin/masjids/${masjidId}/prayer/rules`);
    const items = list.json?.rules ?? list.json ?? [];
    let deleted = 0;
    for (const rule of Array.isArray(items) ? items : []) {
      const name = rule.rule_name ?? rule.name ?? '';
      if (typeof name === 'string' && name.startsWith(namePrefix) && rule.id) {
        const r = await apiDelete(cfg, `/api/v1/admin/masjids/${masjidId}/prayer/rules/${rule.id}`);
        if (r.status >= 200 && r.status < 300) deleted++;
      }
    }
    return deleted;
  } catch {
    return 0;
  }
}

// Delete every jumu'ah session whose label starts with `labelPrefix`. Never throws.
export async function deleteJumuahByPrefix(cfg, masjidId, labelPrefix) {
  try {
    const list = await apiGet(cfg, `/api/v1/admin/masjids/${masjidId}/jumuah`);
    const items = list.json?.sessions ?? list.json?.jumuah ?? list.json ?? [];
    let deleted = 0;
    for (const s of Array.isArray(items) ? items : []) {
      const label = s.label ?? s.name ?? '';
      if (typeof label === 'string' && label.startsWith(labelPrefix) && s.id) {
        const r = await apiDelete(cfg, `/api/v1/admin/masjids/${masjidId}/jumuah/${s.id}`);
        if (r.status >= 200 && r.status < 300) deleted++;
      }
    }
    return deleted;
  } catch {
    return 0;
  }
}

// Restore the maktab enrollment_open flag. The PUT is a FULL-ROW upsert
// (active_term_id etc. default to null when omitted), so we must read the
// current row and PUT it back with only the flag changed. Never throws —
// returns success.
export async function restoreEnrollmentOpen(cfg, masjidId, enrollmentOpen) {
  try {
    const current = await apiGet(cfg, `/api/v1/admin/masjids/${masjidId}/maktab/settings`);
    if (current.status !== 200 || !current.json) return false;
    const s = current.json;
    const r = await apiPut(cfg, `/api/v1/admin/masjids/${masjidId}/maktab/settings`, {
      enrollment_open: enrollmentOpen,
      active_term_id: s.active_term?.id ?? null,
      status_message: s.status_message ?? null,
      assistance_code: s.assistance_code ?? null,
      program_info: s.program_info ?? {},
    });
    return r.status >= 200 && r.status < 300;
  } catch {
    return false;
  }
}

// Read the public maktab state (no auth) — used as a PRECONDITION check by
// consumer enrollment tests so a closed-enrollment failure names the real
// cause instead of "Square iframes: 0".
export async function getPublicMaktab(cfg, slug) {
  return rawRequest(cfg, 'GET', `/api/v1/masjids/${slug}/maktab`);
}

// --- profile/theme restore (ADM-16/17/22) ------------------------------------
// The admin profile endpoint (GET/PUT /api/v1/admin/masjids/{id}) carries BOTH
// masjid fields and theme fields, and PUT is a partial update
// (field !== undefined → updated). So a restore only needs the changed keys.

// Snapshot the fields a mutation test is about to touch. `fields` are
// snake_case API field names; theme fields are lifted from the nested
// `theme` object automatically. Returns a flat partial body suitable for
// restoreProfileFields(). Never throws — returns null on failure.
export async function snapshotProfileFields(cfg, masjidId, fields) {
  try {
    const r = await apiGet(cfg, `/api/v1/admin/masjids/${masjidId}`);
    if (r.status !== 200 || !r.json) return null;
    const profile = r.json; // flat response: { id, slug, name, …, city, …, theme: {…} }
    const theme = r.json.theme ?? {};
    const snap = {};
    for (const f of fields) {
      if (profile[f] !== undefined) snap[f] = profile[f];
      else if (theme[f] !== undefined) snap[f] = theme[f];
    }
    return snap;
  } catch {
    return null;
  }
}

// PUT back a snapshot from snapshotProfileFields(). Never throws.
export async function restoreProfileFields(cfg, masjidId, snapshot) {
  try {
    if (!snapshot || Object.keys(snapshot).length === 0) return false;
    const r = await apiPut(cfg, `/api/v1/admin/masjids/${masjidId}`, snapshot);
    return r.status >= 200 && r.status < 300;
  } catch {
    return false;
  }
}
