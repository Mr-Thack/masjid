import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminRecord } from '../types';

beforeEach(() => {
  vi.resetModules();
});

const testAdmin: AdminRecord = {
  id: 'admin-1',
  masjid_id: 'masjid-1',
  email: 'admin@test.org',
  display_name: 'Admin',
  whatsapp_phone: '+15550000001',
};

function makeDb(responses: Record<string, unknown>) {
  const prepared: Record<string, unknown> = {};

  const db = {
    prepare(sql: string) {
      return {
        bind(...vals: unknown[]) {
          const key = `${sql}|${JSON.stringify(vals)}`;
          return {
            first<T>(): Promise<T | null> {
              return Promise.resolve((responses[key] as T) || null);
            },
            all<T>(): Promise<{ results: T[] }> {
              return Promise.resolve({ results: (responses[key] as T[]) || [] });
            },
            run(): Promise<{ success: boolean }> {
              return Promise.resolve({ success: true });
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return db;
}

describe('resolveTenant', () => {
  it('returns null for unknown phone', async () => {
    const { resolveTenant } = await import('../session');
    const db = makeDb({});
    const result = await resolveTenant('+15550000099', db);
    expect(result).toBeNull();
  });

  it('returns admin for known phone', async () => {
    const { resolveTenant } = await import('../session');
    const db = makeDb({
      [selectAdmins('+15550000001')]: testAdmin,
    });
    const result = await resolveTenant('15550000001', db);
    expect(result?.id).toBe('admin-1');
  });
});

describe('createBranch', () => {
  it('creates branch with OPEN status', async () => {
    const { createBranch } = await import('../session');
    const db = makeDb({});
    const branch = await createBranch('admin-1', 'masjid-1', db);
    expect(branch.status).toBe('OPEN');
    expect(branch.admin_id).toBe('admin-1');
    expect(branch.masjid_id).toBe('masjid-1');
  });

  it('auto-generates branch_name as whatsapp-YYYY-MM-DD', async () => {
    const { createBranch } = await import('../session');
    const db = makeDb({});
    const branch = await createBranch('admin-1', 'masjid-1', db);
    const today = new Date().toISOString().slice(0, 10);
    expect(branch.branch_name).toBe(`whatsapp-${today}`);
  });
});

describe('getOpenBranch', () => {
  it('returns null when no OPEN branch', async () => {
    const { getOpenBranch } = await import('../session');
    const db = makeDb({});
    const result = await getOpenBranch('admin-1', 'masjid-1', db);
    expect(result).toBeNull();
  });

  it('returns OPEN branch if exists', async () => {
    const { getOpenBranch } = await import('../session');
    const db = makeDb({
      [selectOpenBranch('admin-1', 'masjid-1', 'OPEN')]: {
        id: 'branch-1', masjid_id: 'masjid-1', admin_id: 'admin-1',
        branch_name: 'test', status: 'OPEN', created_at: 'now', updated_at: 'now',
      },
    });
    const result = await getOpenBranch('admin-1', 'masjid-1', db);
    expect(result?.status).toBe('OPEN');
  });
});

describe('abandonBranch + mergeBranch', () => {
  it('abandonBranch calls UPDATE', async () => {
    const { abandonBranch } = await import('../session');
    const db = makeDb({});
    await abandonBranch('branch-1', db);
  });

  it('mergeBranch creates snapshot + updates branch', async () => {
    const { mergeBranch } = await import('../session');
    const db = makeDb({
      [selectMutations('branch-1')]: [],
    });
    await mergeBranch('branch-1', 'test merge', 'masjid-1', db);
  });

  it('mergeBranch uses fullState when provided', async () => {
    const { mergeBranch } = await import('../session');
    const db = makeDb({
      [selectMutations('branch-1')]: [],
    });
    const fullState = {
      masjid: { name: 'Test Masjid', theme: { primary_color: '#333' } },
      prayer_rules: { rules: [] },
      jumuah: { sessions: [] },
      announcements: { announcements: [] },
    };
    await mergeBranch('branch-1', 'test merge with state', 'masjid-1', db, fullState);
  });
});

describe('touchBranch', () => {
  it('runs update without error', async () => {
    const { touchBranch } = await import('../session');
    const db = makeDb({});
    await touchBranch('branch-1', db);
  });
});

describe('listBranches', () => {
  it('returns empty for no branches', async () => {
    const { listBranches } = await import('../session');
    const db = makeDb({});
    const result = await listBranches('masjid-1', db);
    expect(result).toEqual([]);
  });

  it('returns branches', async () => {
    const { listBranches } = await import('../session');
    const db = makeDb({
      [listBranchesKey('masjid-1')]: [{ id: 'b1', status: 'OPEN' }],
    });
    const result = await listBranches('masjid-1', db);
    expect(result).toHaveLength(1);
  });
});

describe('storeMutation', () => {
  it('stores mutation and returns UUID', async () => {
    const { storeMutation } = await import('../session');
    const db = makeDb({
      [countMutations('branch-1')]: { cnt: 0 },
    });
    const id = await storeMutation('branch-1', 'THEME', 'UPSERT', 'theme', { x: 1 }, db);
    expect(id).toBeTruthy();
    expect(id.length).toBeGreaterThan(20);
  });
});

describe('getMutations', () => {
  it('returns empty for no mutations', async () => {
    const { getMutations } = await import('../session');
    const db = makeDb({});
    const result = await getMutations('branch-1', db);
    expect(result).toEqual([]);
  });

  it('returns ordered mutations', async () => {
    const { getMutations } = await import('../session');
    const db = makeDb({
      [selectMutations('branch-1')]: [
        { sequence_order: 0, domain: 'THEME' },
        { sequence_order: 1, domain: 'PROFILE' },
      ],
    });
    const result = await getMutations('branch-1', db);
    expect(result).toHaveLength(2);
    expect(result[0]?.sequence_order).toBe(0);
    expect(result[1]?.sequence_order).toBe(1);
  });
});

describe('getMutationCount', () => {
  it('returns 0 for no mutations', async () => {
    const { getMutationCount } = await import('../session');
    const db = makeDb({});
    const result = await getMutationCount('branch-1', db);
    expect(result).toBe(0);
  });

  it('returns count', async () => {
    const { getMutationCount } = await import('../session');
    const db = makeDb({
      [countMutations('branch-1')]: { cnt: 3 },
    });
    const result = await getMutationCount('branch-1', db);
    expect(result).toBe(3);
  });
});

describe('listSnapshots', () => {
  it('returns snapshots with mutation counts', async () => {
    const { listSnapshots } = await import('../session');

    const snapshots = [
      {
        id: 'snap-1',
        summary: 'First merge',
        full_state_json: JSON.stringify({ mutation_count: 3, mutations: [] }),
        created_at: '2026-07-20T12:00:00Z',
      },
      {
        id: 'snap-2',
        summary: 'Second merge',
        full_state_json: JSON.stringify({ mutation_count: 1, mutations: [] }),
        created_at: '2026-07-21T12:00:00Z',
      },
    ];

    const responses: Record<string, unknown> = {
      [selectSnapshots('masjid-1')]: snapshots,
    };

    const db = makeDb(responses);
    const result = await listSnapshots('masjid-1', db);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('snap-1');
    expect(result[0]?.mutation_count).toBe(3);
    expect(result[1]?.id).toBe('snap-2');
    expect(result[1]?.mutation_count).toBe(1);
  });

  it('returns empty array when no snapshots', async () => {
    const { listSnapshots } = await import('../session');

    const responses: Record<string, unknown> = {
      [selectSnapshots('masjid-1')]: [],
    };

    const db = makeDb(responses);
    const result = await listSnapshots('masjid-1', db);

    expect(result).toHaveLength(0);
  });

  it('handles malformed JSON in full_state_json gracefully', async () => {
    const { listSnapshots } = await import('../session');

    const snapshots = [
      {
        id: 'snap-3',
        summary: 'Bad JSON',
        full_state_json: 'not-valid-json',
        created_at: '2026-07-20T12:00:00Z',
      },
    ];

    const responses: Record<string, unknown> = {
      [selectSnapshots('masjid-1')]: snapshots,
    };

    const db = makeDb(responses);
    const result = await listSnapshots('masjid-1', db);

    expect(result).toHaveLength(1);
    expect(result[0]?.mutation_count).toBe(0);
  });
});

describe('getSnapshot', () => {
  it('returns full snapshot by ID', async () => {
    const { getSnapshot } = await import('../session');

    const snapshot = {
      id: 'snap-1',
      masjid_id: 'masjid-1',
      summary: 'First merge',
      full_state_json: JSON.stringify({ mutation_count: 3 }),
      created_at: '2026-07-20T12:00:00Z',
    };

    const responses: Record<string, unknown> = {
      [getSnapshotKey('snap-1')]: snapshot,
    };

    const db = makeDb(responses);
    const result = await getSnapshot('snap-1', db);

    expect(result).not.toBeNull();
    expect(result?.id).toBe('snap-1');
    expect(result?.summary).toBe('First merge');
    expect(result?.masjid_id).toBe('masjid-1');
  });

  it('returns null for non-existent snapshot', async () => {
    const { getSnapshot } = await import('../session');

    const responses: Record<string, unknown> = {};
    const db = makeDb(responses);
    const result = await getSnapshot('nonexistent', db);

    expect(result).toBeNull();
  });
});

function selectAdmins(phone: string) {
  return `SELECT id, masjid_id, email, display_name, whatsapp_phone FROM admins WHERE whatsapp_phone = ?|[${JSON.stringify(phone)}]`;
}

function selectOpenBranch(adminId: string, masjidId: string, status: string) {
  return `SELECT id, masjid_id, admin_id, branch_name, status, created_at, updated_at FROM config_branches WHERE admin_id = ? AND masjid_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 1|[${JSON.stringify(adminId)},${JSON.stringify(masjidId)},${JSON.stringify(status)}]`;
}

function selectMutations(branchId: string) {
  return `SELECT id, branch_id, domain, action_type, target_key, payload_json, sequence_order, created_at FROM config_mutations WHERE branch_id = ? ORDER BY sequence_order ASC|[${JSON.stringify(branchId)}]`;
}

function countMutations(branchId: string) {
  return `SELECT COUNT(*) as cnt FROM config_mutations WHERE branch_id = ?|[${JSON.stringify(branchId)}]`;
}

function listBranchesKey(masjidId: string) {
  return `SELECT id, masjid_id, admin_id, branch_name, status, created_at, updated_at FROM config_branches WHERE masjid_id = ? ORDER BY updated_at DESC LIMIT 10|[${JSON.stringify(masjidId)}]`;
}

function selectSnapshots(masjidId: string) {
  return `SELECT id, summary, full_state_json, created_at FROM config_snapshots WHERE masjid_id = ? ORDER BY created_at DESC LIMIT 20|[${JSON.stringify(masjidId)}]`;
}

function getSnapshotKey(snapshotId: string) {
  return `SELECT id, masjid_id, summary, full_state_json, created_at FROM config_snapshots WHERE id = ?|[${JSON.stringify(snapshotId)}]`;
}
