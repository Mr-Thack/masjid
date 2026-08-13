import { auth } from './auth.svelte';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    auth.logout();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.error?.message || err.message || `Request failed (${res.status})`);
  }

  if (res.status === 204) return null;

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    auth.login(email, password),

  getProfile: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}`),

  updateProfile: (masjidId: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}`, data),

  getPrayerConfig: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/prayer`),

  updatePrayerConfig: (masjidId: string, data: Record<string, unknown>) =>
    request('PATCH', `/api/v1/admin/masjids/${masjidId}/prayer`, data),

  getPrayerRules: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/prayer/rules`),

  getPrayerRulesPreview: (masjidId: string, date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return request('GET', `/api/v1/admin/masjids/${masjidId}/prayer/rules/preview${qs}`);
  },

  getHijriToday: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/prayer/hijri-today`),

  getPrayerHealth: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/prayer/health`),

  createPrayerRule: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/prayer/rules`, data),

  updatePrayerRule: (masjidId: string, ruleId: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/prayer/rules/${ruleId}`, data),

  deletePrayerRule: (masjidId: string, ruleId: string) =>
    request('DELETE', `/api/v1/admin/masjids/${masjidId}/prayer/rules/${ruleId}`),

  reorderPrayerRules: (masjidId: string, order: string[]) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/prayer/rules/reorder`, { order }),

  dryRunPrayerTimes: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/prayer/dry-run`, data),

  getJumuah: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/jumuah`),

  createJumuah: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/jumuah`, data),

  updateJumuah: (masjidId: string, sessionId: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/jumuah/${sessionId}`, data),

  deleteJumuah: (masjidId: string, sessionId: string) =>
    request('DELETE', `/api/v1/admin/masjids/${masjidId}/jumuah/${sessionId}`),

  getAnnouncements: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/announcements`),

  createAnnouncement: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/announcements`, data),

  updateAnnouncement: (masjidId: string, slug: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/announcements/${slug}`, data),

  deleteAnnouncement: (masjidId: string, slug: string) =>
    request('DELETE', `/api/v1/admin/masjids/${masjidId}/announcements/${slug}`),

  pinAnnouncement: (masjidId: string, slug: string) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/announcements/${slug}/pin`),

  getContent: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/content`),

  createContent: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/content`, data),

  updateContent: (masjidId: string, slug: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/content/${slug}`, data),

  deleteContent: (masjidId: string, slug: string) =>
    request('DELETE', `/api/v1/admin/masjids/${masjidId}/content/${slug}`),

  pinContentHomepage: (masjidId: string, slug: string) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/content/${slug}/homepage`),

  pinContentInfo: (masjidId: string, slug: string) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/content/${slug}/info`),

  getPosts: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/content`),

  getDomains: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/domains`),

  createDomain: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/domains`, data),

  deleteDomain: (masjidId: string, domainId: string) =>
    request('DELETE', `/api/v1/admin/masjids/${masjidId}/domains/${domainId}`),

  changePassword: (masjidId: string, data: { current_password: string; new_password: string }) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/admin`, data),

  rollback: (masjidId: string, snapshotId: string) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/rollback`, { snapshot_id: snapshotId }),

  agentChat: (masjidId: string, data: { message: string; branch_id?: string }) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/agent/chat`, data),

  agentConfirm: (masjidId: string, branchId: string) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/agent/confirm`, { branch_id: branchId }),

  agentCancel: (masjidId: string, branchId: string) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/agent/cancel`, { branch_id: branchId }),

  getBranches: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/branches`),

  getMaktabSettings: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/maktab/settings`),

  updateMaktabSettings: (masjidId: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/maktab/settings`, data),

  listMaktabTerms: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/maktab/terms`),

  createMaktabTerm: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/maktab/terms`, data),

  activateMaktabTerm: (masjidId: string, termId: string) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/maktab/terms/${termId}/activate`),

  listMaktabRegistrations: (masjidId: string, termId?: string) => {
    const qs = termId ? `?term_id=${encodeURIComponent(termId)}` : '';
    return request('GET', `/api/v1/admin/masjids/${masjidId}/maktab/registrations${qs}`);
  },

  createManualRegistration: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/maktab/registrations`, data),

  getNavItems: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/nav`),

  createNavItem: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/nav`, data),

  updateNavItem: (masjidId: string, itemId: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/nav/${itemId}`, data),

  deleteNavItem: (masjidId: string, itemId: string) =>
    request('DELETE', `/api/v1/admin/masjids/${masjidId}/nav/${itemId}`),

  reorderNavItems: (masjidId: string, itemIds: string[]) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/nav/reorder`, { item_ids: itemIds }),

  getIntegrations: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/integrations`),

  updateIntegrations: (masjidId: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/integrations`, data),

  testIntegration: (masjidId: string, provider: string, config: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/integrations`, { provider, [provider]: config }),

  getPages: (masjidId: string) =>
    request('GET', `/api/v1/admin/masjids/${masjidId}/content`),

  createPage: (masjidId: string, data: Record<string, unknown>) =>
    request('POST', `/api/v1/admin/masjids/${masjidId}/content`, { ...data, content_type: 'page' }),

  updatePage: (masjidId: string, slug: string, data: Record<string, unknown>) =>
    request('PUT', `/api/v1/admin/masjids/${masjidId}/content/${slug}`, data),

  deletePage: (masjidId: string, slug: string) =>
    request('DELETE', `/api/v1/admin/masjids/${masjidId}/content/${slug}`),
};
