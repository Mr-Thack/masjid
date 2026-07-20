import type { Env, AdminRecord, BranchRecord } from './types';
import { BRANCH_TIMEOUT_HOURS, BRANCH_GRACE_MINUTES } from './types';

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

export async function getOpenBranch(
  adminId: string,
  masjidId: string,
  db: D1Database,
): Promise<BranchRecord | null> {
  const stmt = db.prepare(
    'SELECT id, masjid_id, admin_id, branch_name, status, created_at, updated_at FROM config_branches WHERE admin_id = ? AND masjid_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 1',
  );
  return stmt.bind(adminId, masjidId, 'OPEN').first<BranchRecord>() || null;
}

export async function createBranch(
  adminId: string,
  masjidId: string,
  db: D1Database,
): Promise<BranchRecord> {
  const id = uuid();
  const now = nowISO();
  const branchName = `whatsapp-${now.slice(0, 10)}`;

  await db
    .prepare(
      'INSERT INTO config_branches (id, masjid_id, admin_id, branch_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, masjidId, adminId, branchName, 'OPEN', now, now)
    .run();

  return {
    id,
    masjid_id: masjidId,
    admin_id: adminId,
    branch_name: branchName,
    status: 'OPEN',
    created_at: now,
    updated_at: now,
  };
}

export async function touchBranch(
  branchId: string,
  db: D1Database,
): Promise<void> {
  await db
    .prepare('UPDATE config_branches SET updated_at = ? WHERE id = ?')
    .bind(nowISO(), branchId)
    .run();
}

export async function abandonBranch(
  branchId: string,
  db: D1Database,
): Promise<void> {
  await db
    .prepare('UPDATE config_branches SET status = ?, updated_at = ? WHERE id = ?')
    .bind('ABANDONED', nowISO(), branchId)
    .run();
}

export async function abandonExpiredBranches(db: D1Database): Promise<void> {
  const cutoff = new Date(
    Date.now() - (BRANCH_TIMEOUT_HOURS * 60 + BRANCH_GRACE_MINUTES) * 60 * 1000,
  ).toISOString();

  await db
    .prepare(
      'UPDATE config_branches SET status = ?, updated_at = ? WHERE status = ? AND updated_at < ?',
    )
    .bind('ABANDONED', nowISO(), 'OPEN', cutoff)
    .run();
}

export async function getBranchTimeoutWarning(
  branchId: string,
  db: D1Database,
): Promise<boolean> {
  const branch = await db
    .prepare('SELECT updated_at, status FROM config_branches WHERE id = ?')
    .bind(branchId)
    .first<{ updated_at: string; status: string }>();

  if (!branch || branch.status !== 'OPEN') return false;

  const updated = new Date(branch.updated_at).getTime();
  const timeoutAt = updated + BRANCH_TIMEOUT_HOURS * 60 * 60 * 1000;
  const graceAt = timeoutAt + BRANCH_GRACE_MINUTES * 60 * 1000;

  return Date.now() >= timeoutAt && Date.now() < graceAt;
}

export async function listBranches(
  masjidId: string,
  db: D1Database,
): Promise<BranchRecord[]> {
  const result = await db
    .prepare(
      'SELECT id, masjid_id, admin_id, branch_name, status, created_at, updated_at FROM config_branches WHERE masjid_id = ? ORDER BY updated_at DESC LIMIT 10',
    )
    .bind(masjidId)
    .all<BranchRecord>();

  return result.results;
}