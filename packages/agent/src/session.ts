import type { BranchRecord, MutationRecord } from './types';
import { BRANCH_TIMEOUT_HOURS, BRANCH_GRACE_MINUTES } from './types';

function uuid(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
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

export async function getBranchById(
  branchId: string,
  db: D1Database,
): Promise<BranchRecord | null> {
  const stmt = db.prepare(
    'SELECT id, masjid_id, admin_id, branch_name, status, created_at, updated_at FROM config_branches WHERE id = ? LIMIT 1',
  );
  return stmt.bind(branchId).first<BranchRecord>() || null;
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

export async function cleanupStaleBranches(db: D1Database): Promise<void> {
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
  fullState?: Record<string, unknown>,
): Promise<void> {
  const now = nowISO();

  let fullStateJson: string;
  if (fullState) {
    fullStateJson = JSON.stringify({
      version: 1,
      summary,
      created_at: now,
      ...fullState,
    });
  } else {
    const mutations = await getMutations(branchId, db);
    fullStateJson = JSON.stringify({
      merged_at: now,
      summary,
      mutation_count: mutations.length,
      mutations: mutations.map(m => ({
        domain: m.domain,
        action: m.action_type,
        target: m.target_key,
        payload: JSON.parse(m.payload_json),
      })),
    });
  }

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

export async function listSnapshots(
  masjidId: string,
  db: D1Database,
): Promise<Array<{
  id: string;
  summary: string;
  mutation_count: number;
  created_at: string;
}>> {
  const result = await db
    .prepare(
      'SELECT id, summary, full_state_json, created_at FROM config_snapshots WHERE masjid_id = ? ORDER BY created_at DESC LIMIT 20',
    )
    .bind(masjidId)
    .all<{ id: string; summary: string; full_state_json: string; created_at: string }>();

  return result.results.map(r => {
    let mutationCount = 0;
    try {
      const state = JSON.parse(r.full_state_json);
      mutationCount = state.mutation_count || 0;
    } catch { /* ignore */ }
    return {
      id: r.id,
      summary: r.summary,
      mutation_count: mutationCount,
      created_at: r.created_at,
    };
  });
}

export async function getSnapshot(
  snapshotId: string,
  db: D1Database,
): Promise<{ id: string; masjid_id: string; summary: string; full_state_json: string; created_at: string } | null> {
  const result = await db
    .prepare(
      'SELECT id, masjid_id, summary, full_state_json, created_at FROM config_snapshots WHERE id = ?',
    )
    .bind(snapshotId)
    .first<{ id: string; masjid_id: string; summary: string; full_state_json: string; created_at: string }>();

  return result || null;
}
