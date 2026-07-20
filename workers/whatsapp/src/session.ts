import type { Env, AdminRecord, BranchRecord, MutationRecord } from './types';
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

export async function storeMutation(
  branchId: string,
  domain: string,
  actionType: string,
  targetKey: string,
  payload: unknown,
  db: D1Database,
): Promise<string> {
  const id = uuid();
  const now = nowISO();

  const countResult = await db
    .prepare('SELECT COUNT(*) as cnt FROM config_mutations WHERE branch_id = ?')
    .bind(branchId)
    .first<{ cnt: number }>();

  const sequenceOrder = (countResult?.cnt || 0);

  await db
    .prepare(
      'INSERT INTO config_mutations (id, branch_id, domain, action_type, target_key, payload_json, sequence_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, branchId, domain, actionType, targetKey, JSON.stringify(payload), sequenceOrder, now)
    .run();

  return id;
}

export async function getMutations(
  branchId: string,
  db: D1Database,
): Promise<MutationRecord[]> {
  const result = await db
    .prepare(
      'SELECT id, branch_id, domain, action_type, target_key, payload_json, sequence_order, created_at FROM config_mutations WHERE branch_id = ? ORDER BY sequence_order ASC',
    )
    .bind(branchId)
    .all<MutationRecord>();

  return result.results;
}

export async function getMutationCount(
  branchId: string,
  db: D1Database,
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as cnt FROM config_mutations WHERE branch_id = ?')
    .bind(branchId)
    .first<{ cnt: number }>();

  return result?.cnt || 0;
}

export async function mergeBranch(
  branchId: string,
  summary: string,
  masjidId: string,
  db: D1Database,
): Promise<void> {
  const now = nowISO();

  const mutations = await getMutations(branchId, db);
  const fullStateJson = JSON.stringify({
    merged_at: now,
    summary,
    mutation_count: mutations.length,
    mutations: mutations.map(m => ({
      domain: m.domain,
      action: m.action_type,
      target: m.target_key,
    })),
  });

  const snapshotId = uuid();
  await db
    .prepare(
      'INSERT INTO config_snapshots (id, masjid_id, summary, full_state_json, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(snapshotId, masjidId, summary, fullStateJson, now)
    .run();

  await db
    .prepare('UPDATE config_branches SET status = ?, updated_at = ? WHERE id = ?')
    .bind('MERGED', now, branchId)
    .run();
}