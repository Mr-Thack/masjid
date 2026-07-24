import type { AdminRecord } from './types';

function uuid(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function resolveTenant(
  phone: string,
  db: D1Database,
): Promise<AdminRecord | null> {
  const normalized = phone.startsWith('+') ? phone : `+${phone}`;
  const stmt = db.prepare(
    'SELECT id, masjid_id, email, display_name, whatsapp_phone FROM admins WHERE whatsapp_phone = ?',
  );
  const result = await stmt.bind(normalized).first<AdminRecord>();
  return result || null;
}

export {
  getOpenBranch,
  createBranch,
  touchBranch,
  abandonBranch,
  cleanupStaleBranches as abandonExpiredBranches,
  getBranchTimeoutWarning,
  listBranches,
  storeMutation,
  getMutations,
  getMutationCount,
  mergeBranch,
  listSnapshots,
  getSnapshot,
} from '@masjid/agent';
