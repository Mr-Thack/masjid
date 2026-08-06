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

  return fetch(url, init);
}

export async function getMasjidProfile(config: ApiClientConfig): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${config.masjidId}`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getPrayerConfig(config: ApiClientConfig): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${config.masjidId}/prayer`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updateMasjidProfile(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${config.masjidId}`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getPrayerRules(config: ApiClientConfig): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${config.masjidId}/prayer`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updatePrayerConfig(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PATCH', `/api/v1/admin/masjids/${config.masjidId}/prayer`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getPrayerRulesList(config: ApiClientConfig): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function createPrayerRule(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('POST', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updatePrayerRule(
  ruleId: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules/${ruleId}`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function deletePrayerRule(
  ruleId: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('DELETE', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules/${ruleId}`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function reorderPrayerRules(
  order: string[],
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${config.masjidId}/prayer/rules/reorder`, { order }, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getJumuahSessions(config: ApiClientConfig): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${config.masjidId}/jumuah`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function createJumuahSession(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('POST', `/api/v1/admin/masjids/${config.masjidId}/jumuah`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updateJumuahSession(
  sessionId: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${config.masjidId}/jumuah/${sessionId}`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function deleteJumuahSession(
  sessionId: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('DELETE', `/api/v1/admin/masjids/${config.masjidId}/jumuah/${sessionId}`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getAnnouncements(config: ApiClientConfig): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${config.masjidId}/announcements`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function createAnnouncement(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('POST', `/api/v1/admin/masjids/${config.masjidId}/announcements`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updateAnnouncement(
  slug: string,
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${config.masjidId}/announcements/${slug}`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function deleteAnnouncement(
  slug: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('DELETE', `/api/v1/admin/masjids/${config.masjidId}/announcements/${slug}`, null, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function pinAnnouncement(
  slug: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${config.masjidId}/announcements/${slug}/pin`, {}, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function dryRunPrayerTimes(
  body: Record<string, unknown>,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('POST', `/api/v1/admin/masjids/${config.masjidId}/prayer/dry-run`, body, config);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function rollbackRestore(
  snapshotId: string,
  config: ApiClientConfig,
): Promise<Record<string, unknown>> {
  const res = await apiCall('POST', `/api/v1/admin/masjids/${config.masjidId}/rollback`, { snapshot_id: snapshotId }, config);
  return res.json() as Promise<Record<string, unknown>>;
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
