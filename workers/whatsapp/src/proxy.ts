import { SignJWT } from 'jose';
import type { Env } from './types';

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

export async function getAdminJWT(
  adminId: string,
  masjidId: string,
  env: Env,
): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  const secretKey = new TextEncoder().encode(env.JWT_SECRET);

  const token = await new SignJWT({ sub: adminId, masjid_id: masjidId })
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
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Response> {
  const token = await getAdminJWT(adminId, masjidId, env);
  const url = `${env.API_URL}${path}`;

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

export async function getMasjidProfile(
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${masjidId}`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getPrayerConfig(
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${masjidId}/prayer`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updateMasjidProfile(
  body: Record<string, unknown>,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${masjidId}`, body, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getPrayerRules(
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${masjidId}/prayer`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updatePrayerConfig(
  body: Record<string, unknown>,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PATCH', `/api/v1/admin/masjids/${masjidId}/prayer`, body, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getPrayerRulesList(
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${masjidId}/prayer/rules`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function createPrayerRule(
  body: Record<string, unknown>,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('POST', `/api/v1/admin/masjids/${masjidId}/prayer/rules`, body, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updatePrayerRule(
  ruleId: string,
  body: Record<string, unknown>,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${masjidId}/prayer/rules/${ruleId}`, body, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function deletePrayerRule(
  ruleId: string,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('DELETE', `/api/v1/admin/masjids/${masjidId}/prayer/rules/${ruleId}`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function reorderPrayerRules(
  order: string[],
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${masjidId}/prayer/rules/reorder`, { order }, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getJumuahSessions(
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${masjidId}/jumuah`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function createJumuahSession(
  body: Record<string, unknown>,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('POST', `/api/v1/admin/masjids/${masjidId}/jumuah`, body, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updateJumuahSession(
  sessionId: string,
  body: Record<string, unknown>,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${masjidId}/jumuah/${sessionId}`, body, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function deleteJumuahSession(
  sessionId: string,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('DELETE', `/api/v1/admin/masjids/${masjidId}/jumuah/${sessionId}`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getAnnouncements(
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('GET', `/api/v1/admin/masjids/${masjidId}/announcements`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function createAnnouncement(
  body: Record<string, unknown>,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('POST', `/api/v1/admin/masjids/${masjidId}/announcements`, body, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function updateAnnouncement(
  slug: string,
  body: Record<string, unknown>,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${masjidId}/announcements/${slug}`, body, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function deleteAnnouncement(
  slug: string,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('DELETE', `/api/v1/admin/masjids/${masjidId}/announcements/${slug}`, null, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function pinAnnouncement(
  slug: string,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Record<string, unknown>> {
  const res = await apiCall('PUT', `/api/v1/admin/masjids/${masjidId}/announcements/${slug}/pin`, {}, env, adminId, masjidId);
  return res.json() as Promise<Record<string, unknown>>;
}