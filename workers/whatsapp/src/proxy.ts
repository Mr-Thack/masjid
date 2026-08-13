import type { Env } from './types';
import {
  apiCall as coreApiCall,
  getAdminJWT as coreGetAdminJWT,
  getMasjidProfile as coreGetMasjidProfile,
  getPrayerConfig as coreGetPrayerConfig,
  updateMasjidProfile as coreUpdateMasjidProfile,
  getPrayerRules as coreGetPrayerRules,
  updatePrayerConfig as coreUpdatePrayerConfig,
  getPrayerRulesList as coreGetPrayerRulesList,
  createPrayerRule as coreCreatePrayerRule,
  updatePrayerRule as coreUpdatePrayerRule,
  deletePrayerRule as coreDeletePrayerRule,
  reorderPrayerRules as coreReorderPrayerRules,
  getJumuahSessions as coreGetJumuahSessions,
  createJumuahSession as coreCreateJumuahSession,
  updateJumuahSession as coreUpdateJumuahSession,
  deleteJumuahSession as coreDeleteJumuahSession,
  getAnnouncements as coreGetAnnouncements,
  createAnnouncement as coreCreateAnnouncement,
  updateAnnouncement as coreUpdateAnnouncement,
  deleteAnnouncement as coreDeleteAnnouncement,
  pinAnnouncement as corePinAnnouncement,
  getContent as coreGetContent,
  createContent as coreCreateContent,
  updateContent as coreUpdateContent,
  deleteContent as coreDeleteContent,
  pinContentHomepage as corePinContentHomepage,
  pinContentInfo as corePinContentInfo,
  dryRunPrayerTimes as coreDryRunPrayerTimes,
  rollbackRestore as coreRollbackRestore,
  type ApiClientConfig,
} from '@masjid/agent';

function config(env: Env, adminId: string, masjidId: string): ApiClientConfig {
  return { apiUrl: env.API_URL, jwtSecret: env.JWT_SECRET, adminId, masjidId };
}

export function apiCall(
  method: string,
  path: string,
  body: unknown | null,
  env: Env,
  adminId: string,
  masjidId: string,
): Promise<Response> {
  return coreApiCall(method, path, body, config(env, adminId, masjidId));
}

export function getAdminJWT(
  adminId: string,
  masjidId: string,
  env: Env,
): Promise<string> {
  return coreGetAdminJWT(config(env, adminId, masjidId));
}

export function getMasjidProfile(env: Env, adminId: string, masjidId: string) {
  return coreGetMasjidProfile(config(env, adminId, masjidId));
}
export function getPrayerConfig(env: Env, adminId: string, masjidId: string) {
  return coreGetPrayerConfig(config(env, adminId, masjidId));
}
export function updateMasjidProfile(body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreUpdateMasjidProfile(body, config(env, adminId, masjidId));
}
export function getPrayerRules(env: Env, adminId: string, masjidId: string) {
  return coreGetPrayerRules(config(env, adminId, masjidId));
}
export function updatePrayerConfig(body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreUpdatePrayerConfig(body, config(env, adminId, masjidId));
}
export function getPrayerRulesList(env: Env, adminId: string, masjidId: string) {
  return coreGetPrayerRulesList(config(env, adminId, masjidId));
}
export function createPrayerRule(body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreCreatePrayerRule(body, config(env, adminId, masjidId));
}
export function updatePrayerRule(ruleId: string, body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreUpdatePrayerRule(ruleId, body, config(env, adminId, masjidId));
}
export function deletePrayerRule(ruleId: string, env: Env, adminId: string, masjidId: string) {
  return coreDeletePrayerRule(ruleId, config(env, adminId, masjidId));
}
export function reorderPrayerRules(order: string[], env: Env, adminId: string, masjidId: string) {
  return coreReorderPrayerRules(order, config(env, adminId, masjidId));
}
export function getJumuahSessions(env: Env, adminId: string, masjidId: string) {
  return coreGetJumuahSessions(config(env, adminId, masjidId));
}
export function createJumuahSession(body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreCreateJumuahSession(body, config(env, adminId, masjidId));
}
export function updateJumuahSession(sessionId: string, body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreUpdateJumuahSession(sessionId, body, config(env, adminId, masjidId));
}
export function deleteJumuahSession(sessionId: string, env: Env, adminId: string, masjidId: string) {
  return coreDeleteJumuahSession(sessionId, config(env, adminId, masjidId));
}
export function getAnnouncements(env: Env, adminId: string, masjidId: string) {
  return coreGetAnnouncements(config(env, adminId, masjidId));
}
export function createAnnouncement(body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreCreateAnnouncement(body, config(env, adminId, masjidId));
}
export function updateAnnouncement(slug: string, body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreUpdateAnnouncement(slug, body, config(env, adminId, masjidId));
}
export function deleteAnnouncement(slug: string, env: Env, adminId: string, masjidId: string) {
  return coreDeleteAnnouncement(slug, config(env, adminId, masjidId));
}
export function pinAnnouncement(slug: string, env: Env, adminId: string, masjidId: string) {
  return corePinAnnouncement(slug, config(env, adminId, masjidId));
}
export function getContent(env: Env, adminId: string, masjidId: string) {
  return coreGetContent(config(env, adminId, masjidId));
}
export function createContent(body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreCreateContent(body, config(env, adminId, masjidId));
}
export function updateContent(slug: string, body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreUpdateContent(slug, body, config(env, adminId, masjidId));
}
export function deleteContent(slug: string, env: Env, adminId: string, masjidId: string) {
  return coreDeleteContent(slug, config(env, adminId, masjidId));
}
export function pinContentHomepage(slug: string, env: Env, adminId: string, masjidId: string) {
  return corePinContentHomepage(slug, config(env, adminId, masjidId));
}
export function pinContentInfo(slug: string, env: Env, adminId: string, masjidId: string) {
  return corePinContentInfo(slug, config(env, adminId, masjidId));
}
export function dryRunPrayerTimes(body: Record<string, unknown>, env: Env, adminId: string, masjidId: string) {
  return coreDryRunPrayerTimes(body, config(env, adminId, masjidId));
}
export function rollbackRestore(snapshotId: string, env: Env, adminId: string, masjidId: string) {
  return coreRollbackRestore(snapshotId, config(env, adminId, masjidId));
}
