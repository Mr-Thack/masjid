import { SignJWT } from 'jose';
import type { ApiClientConfig } from './types';

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

export async function getAdminJWT(config: ApiClientConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  const secretKey = new TextEncoder().encode(config.jwtSecret);

  const token = await new SignJWT({ sub: config.adminId, masjid_id: config.masjidId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('masjid-platform')
    .setIssuedAt()
    .setExpirationTime('30 days')
    .sign(secretKey);

  cachedToken = token;
  cachedTokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000;

  return token;
}

export async function apiCall(
  method: string,
  path: string,
  body: unknown | null,
  config: ApiClientConfig,
): Promise<Response> {
  const token = await getAdminJWT(config);
  const url = `${config.apiUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const init: RequestInit = { method, headers };

  if (body !== null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const doFetch = config.fetcher ?? fetch;
  return doFetch(url, init);
}

/**
 * apiCall + response validation. The body is always read as text first so that
 * infrastructure failures surface as descriptive errors instead of cryptic
 * JSON.parse SyntaxErrors — e.g. Cloudflare blocks same-zone Worker→Worker
 * subrequests with a plain-text `error code: 1042` body (2026-08-10 incident).
 */
async function apiJson(
  method: string,
  path: string,
  body: unknown | null,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall(method, path, body, config);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Admin API ${method} ${path} failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Admin API ${method} ${path} returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function getMasjidProfile(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}`, null, config);
}

export async function getPrayerConfig(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/prayer`, null, config);
}

export async function updateMasjidProfile(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}`, body, config);
}

export async function getPrayerRules(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/prayer`, null, config);
}

export async function updatePrayerConfig(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PATCH', `/api/v1/admin/masjids/${config.masjidId}/prayer`, body, config);
}

export async function getPrayerRulesList(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules`, null, config);
}

export async function createPrayerRule(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules`, body, config);
}

export async function updatePrayerRule(
  ruleId: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules/${ruleId}`, body, config);
}

export async function deletePrayerRule(
  ruleId: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('DELETE', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules/${ruleId}`, null, config);
}

export async function reorderPrayerRules(
  order: string[],
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules/reorder`, { order }, config);
}

export async function getJumuahSessions(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/jumuah`, null, config);
}

export async function createJumuahSession(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/jumuah`, body, config);
}

export async function updateJumuahSession(
  sessionId: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/jumuah/${sessionId}`, body, config);
}

export async function deleteJumuahSession(
  sessionId: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('DELETE', `/api/v1/admin/masjids/${config.masjidId}/jumuah/${sessionId}`, null, config);
}

export async function getAnnouncements(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/announcements`, null, config);
}

export async function createAnnouncement(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/announcements`, body, config);
}

export async function updateAnnouncement(
  slug: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/announcements/${slug}`, body, config);
}

export async function deleteAnnouncement(
  slug: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('DELETE', `/api/v1/admin/masjids/${config.masjidId}/announcements/${slug}`, null, config);
}

export async function pinAnnouncement(
  slug: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/announcements/${slug}/pin`, {}, config);
}

export async function dryRunPrayerTimes(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/prayer/dry-run`, body, config);
}

export async function rollbackRestore(
  snapshotId: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/rollback`, { snapshot_id: snapshotId }, config);
}

export async function getPosts(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/posts`, null, config);
}

export async function createPost(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/posts`, body, config);
}

export async function updatePost(
  slug: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/posts/${slug}`, body, config);
}

export async function deletePost(
  slug: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('DELETE', `/api/v1/admin/masjids/${config.masjidId}/posts/${slug}`, null, config);
}

export async function pinPostHomepage(
  slug: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/posts/${slug}/homepage`, {}, config);
}

export async function pinPostInfo(
  slug: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/posts/${slug}/info`, {}, config);
}

export async function explainPrayerRules(
  date: string | undefined,
  config: ApiClientConfig,
): Promise<{ dryRun: Record<string, unknown>; rules: unknown[] }> {
  const dryBody: Record<string, unknown> = {};
  if (date) dryBody.date = date;
  const dryRun = await dryRunPrayerTimes(dryBody, config);
  const rulesRes = await getPrayerRulesList(config);
  const rulesList = (rulesRes as Record<string, unknown>).rules as unknown[] || [];
  return { dryRun, rules: rulesList };
}

export async function importTimetable(
  rules: Array<{ prayer_name: string; rule_name: string; conditions_json: unknown[]; action_json: Record<string, unknown> }>,
  replaceExisting: boolean,
  config: ApiClientConfig,
): Promise<{ created: number; deleted: number; rules: unknown[] }> {
  let deletedCount = 0;

  if (replaceExisting) {
    const existing = await getPrayerRulesList(config);
    const existingRules = (existing as Record<string, unknown>).rules as Array<{ id: string }> || [];
    for (const r of existingRules) {
      await deletePrayerRule(r.id, config);
      deletedCount++;
    }
  }

  const created: unknown[] = [];
  for (const rule of rules) {
    const body: Record<string, unknown> = {
      prayer_name: rule.prayer_name,
      rule_name: rule.rule_name,
      conditions_json: rule.conditions_json,
      action_json: rule.action_json,
    };

    const existing = await getPrayerRulesList(config);
    const existingRules = (existing as Record<string, unknown>).rules as Array<{ id: string; prayer_name: string }> || [];
    const maxOrder = existingRules.filter((r: { prayer_name: string }) => r.prayer_name === rule.prayer_name).length;
    body.execution_order = replaceExisting ? created.filter(r => (r as Record<string, unknown>).prayer_name === rule.prayer_name).length : maxOrder;

    const res = await createPrayerRule(body, config);
    created.push(res);
  }

  return { created: created.length, deleted: deletedCount, rules: created };
}

// ── Maktab ──────────────────────────────────────────────────────────────────

export async function getMaktabSettings(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/maktab/settings`, null, config);
}

export async function updateMaktabSettings(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/maktab/settings`, body, config);
}

export async function getMaktabTerms(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/maktab/terms`, null, config);
}

export async function activateMaktabTerm(
  termId: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/maktab/terms/${termId}/activate`, {}, config);
}

// ── Navigation ──────────────────────────────────────────────────────────────

export async function getNavItems(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/nav`, null, config);
}

export async function createNavItem(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/nav`, body, config);
}

export async function updateNavItem(
  itemId: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/nav/${itemId}`, body, config);
}

export async function deleteNavItem(
  itemId: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('DELETE', `/api/v1/admin/masjids/${config.masjidId}/nav/${itemId}`, null, config);
}

export async function reorderNavItems(
  itemIds: string[],
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/nav/reorder`, { item_ids: itemIds }, config);
}

// ── Custom Pages ────────────────────────────────────────────────────────────

export async function getPages(config: ApiClientConfig): Promise<Record<string, unknown>> {
  return apiJson('GET', `/api/v1/admin/masjids/${config.masjidId}/pages`, null, config);
}

export async function createPage(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('POST', `/api/v1/admin/masjids/${config.masjidId}/pages`, body, config);
}

export async function updatePage(
  pageSlug: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('PUT', `/api/v1/admin/masjids/${config.masjidId}/pages/${pageSlug}`, body, config);
}

export async function deletePage(
  pageSlug: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  return apiJson('DELETE', `/api/v1/admin/masjids/${config.masjidId}/pages/${pageSlug}`, null, config);
}
