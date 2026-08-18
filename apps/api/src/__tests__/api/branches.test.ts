import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, admins, configBranches, configMutations, configSnapshots } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { GET as getBranches } from '../../routes/api/v1/admin/masjids/[id]/branches/+server';
import { POST as postConfirm } from '../../routes/api/v1/admin/masjids/[id]/agent/confirm/+server';
import { POST as postCancel } from '../../routes/api/v1/admin/masjids/[id]/agent/cancel/+server';

let db: ReturnType<typeof getDb>;

function createRequest(method: string, path: string): Request {
  return new Request(new URL(path, 'http://localhost').toString(), { method });
}

function adminLocals(masjidId: string) {
  return {
    admin: {
      sub: 'admin-test',
      masjid_id: masjidId,
      email: 'admin@example.com',
      display_name: 'Test Admin',
    },
  };
}

function call(req: Request, id: string, locals: Record<string, unknown>) {
  return getBranches({
    params: { id },
    request: req,
    url: new URL(req.url),
    locals,
    platform: { env: {} },
    cookies: {} as any,
    fetch: globalThis.fetch,
  } as any);
}

async function seedMasjid(slug: string) {
  const id = `masjid-${slug}`;
  await db.insert(masjids).values({
    id,
    slug,
    name: 'Test Masjid',
    latitude: 33.9,
    longitude: -84.6,
    timezone: 'America/New_York',
  });
  await db.insert(masjidThemes).values({ masjidId: id });
  await db.insert(admins).values({
    id: `admin-${slug}`,
    masjidId: id,
    email: `admin-${slug}@example.com`,
    passwordHash: 'unused',
  });
  return id;
}

beforeAll(() => {
  db = getDb();
});

describe('GET /admin/masjids/:id/branches', () => {
  it('returns UNAUTHORIZED without admin', async () => {
    const req = createRequest('GET', '/api/v1/admin/masjids/fake/branches');
    const res = await call(req, 'fake', {});
    expect(res.status).toBe(401);
  });

  it('returns FORBIDDEN for wrong masjid', async () => {
    const req = createRequest('GET', '/api/v1/admin/masjids/other/branches');
    const res = await call(req, 'other', adminLocals('mine'));
    expect(res.status).toBe(403);
  });

  it('returns empty list for masjid with no branches', async () => {
    const id = await seedMasjid(`branches-empty-${Date.now()}`);
    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/branches`);
    const res = await call(req, id, adminLocals(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branches).toEqual([]);
  });

  it('lists branches with snake_case fields', async () => {
    const id = await seedMasjid(`branches-list-${Date.now()}`);
    await db.insert(configBranches).values({
      id: `branch-open-${Date.now()}`,
      masjidId: id,
      adminId: `admin-${id}`,
      branchName: 'main',
      status: 'OPEN',
    });
    await db.insert(configBranches).values({
      id: `branch-merged-${Date.now()}`,
      masjidId: id,
      adminId: `admin-${id}`,
      branchName: 'whatsapp-fix',
      status: 'MERGED',
    });

    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/branches`);
    const res = await call(req, id, adminLocals(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branches).toHaveLength(2);
    const statuses = body.branches.map((b: any) => b.status).sort();
    expect(statuses).toEqual(['MERGED', 'OPEN']);
    for (const b of body.branches) {
      expect(b).toHaveProperty('id');
      expect(b).toHaveProperty('branch_name');
      expect(b).toHaveProperty('created_at');
      expect(b).toHaveProperty('updated_at');
    }
  });

  it('does not leak other masjids’ branches', async () => {
    const mine = await seedMasjid(`branches-mine-${Date.now()}`);
    const theirs = await seedMasjid(`branches-theirs-${Date.now()}`);
    await db.insert(configBranches).values({
      id: `branch-theirs-${Date.now()}`,
      masjidId: theirs,
      adminId: `admin-${theirs}`,
      branchName: 'main',
      status: 'OPEN',
    });

    const req = createRequest('GET', `/api/v1/admin/masjids/${mine}/branches`);
    const res = await call(req, mine, adminLocals(mine));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branches).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// POST /admin/masjids/:id/agent/confirm + /cancel — branch validation
// ─────────────────────────────────────────────────────────────────────────────────
describe('POST /admin/masjids/:id/agent/confirm', () => {
  function callConfirm(id: string, body: unknown, locals: Record<string, unknown>) {
    const req = new Request(`http://localhost/api/v1/admin/masjids/${id}/agent/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return postConfirm({
      params: { id },
      request: req,
      url: new URL(req.url),
      locals,
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
  }

  it('returns NOT_FOUND for a nonexistent branch', async () => {
    const id = await seedMasjid(`confirm-ghost-${Date.now()}`);
    const res = await callConfirm(id, { branch_id: 'does-not-exist' }, adminLocals(id));
    expect(res.status).toBe(404);
  });

  it('returns FORBIDDEN for another masjid\'s branch', async () => {
    const mine = await seedMasjid(`confirm-mine-${Date.now()}`);
    const theirs = await seedMasjid(`confirm-theirs-${Date.now()}`);
    await db.insert(configBranches).values({
      id: `confirm-branch-${Date.now()}`,
      masjidId: theirs,
      adminId: `admin-${theirs}`,
      branchName: 'main',
      status: 'OPEN',
    });
    const row = await db.select().from(configBranches).where(eq(configBranches.masjidId, theirs)).get();

    const res = await callConfirm(mine, { branch_id: row!.id }, adminLocals(mine));
    expect(res.status).toBe(403);
  });

  it('returns CONFLICT for an already-merged branch (no junk snapshot)', async () => {
    const id = await seedMasjid(`confirm-merged-${Date.now()}`);
    const branchId = `confirm-merged-branch-${Date.now()}`;
    await db.insert(configBranches).values({
      id: branchId,
      masjidId: id,
      adminId: `admin-${id}`,
      branchName: 'main',
      status: 'MERGED',
    });
    const snapshotsBefore = await db.select().from(configSnapshots).all();
    const res = await callConfirm(id, { branch_id: branchId }, adminLocals(id));
    expect(res.status).toBe(409);
    const snapshotsAfter = await db.select().from(configSnapshots).all();
    expect(snapshotsAfter.length).toBe(snapshotsBefore.length);
  });

  it('returns CONFLICT for an open branch with zero mutations', async () => {
    const id = await seedMasjid(`confirm-empty-${Date.now()}`);
    const branchId = `confirm-empty-branch-${Date.now()}`;
    await db.insert(configBranches).values({
      id: branchId,
      masjidId: id,
      adminId: `admin-${id}`,
      branchName: 'main',
      status: 'OPEN',
    });
    const res = await callConfirm(id, { branch_id: branchId }, adminLocals(id));
    expect(res.status).toBe(409);
  });

  it('confirms an open branch with mutations and creates a snapshot', async () => {
    const id = await seedMasjid(`confirm-ok-${Date.now()}`);
    const branchId = `confirm-ok-branch-${Date.now()}`;
    await db.insert(configBranches).values({
      id: branchId,
      masjidId: id,
      adminId: `admin-${id}`,
      branchName: 'main',
      status: 'OPEN',
    });
    await db.insert(configMutations).values({
      id: `confirm-mut-${Date.now()}`,
      branchId,
      domain: 'THEME',
      actionType: 'UPSERT',
      targetKey: 'theme',
      payloadJson: JSON.stringify({ primary_color: '#123456' }),
      sequenceOrder: 0,
    });

    const res = await callConfirm(id, { branch_id: branchId }, adminLocals(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.mutation_count).toBe(1);

    const branch = await db.select().from(configBranches).where(eq(configBranches.id, branchId)).get();
    expect(branch?.status).toBe('MERGED');
    const snapshots = await db.select().from(configSnapshots).where(eq(configSnapshots.masjidId, id)).all();
    expect(snapshots.length).toBe(1);
  });
});

describe('POST /admin/masjids/:id/agent/cancel', () => {
  function callCancel(id: string, body: unknown, locals: Record<string, unknown>) {
    const req = new Request(`http://localhost/api/v1/admin/masjids/${id}/agent/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return postCancel({
      params: { id },
      request: req,
      url: new URL(req.url),
      locals,
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
  }

  it('returns NOT_FOUND for a nonexistent branch', async () => {
    const id = await seedMasjid(`cancel-ghost-${Date.now()}`);
    const res = await callCancel(id, { branch_id: 'does-not-exist' }, adminLocals(id));
    expect(res.status).toBe(404);
  });

  it('returns CONFLICT for an already-merged branch (no silent success)', async () => {
    const id = await seedMasjid(`cancel-merged-${Date.now()}`);
    const branchId = `cancel-merged-branch-${Date.now()}`;
    await db.insert(configBranches).values({
      id: branchId,
      masjidId: id,
      adminId: `admin-${id}`,
      branchName: 'main',
      status: 'MERGED',
    });

    const res = await callCancel(id, { branch_id: branchId }, adminLocals(id));
    expect(res.status).toBe(409);
  });

  it('abandons an open branch', async () => {
    const id = await seedMasjid(`cancel-ok-${Date.now()}`);
    const branchId = `cancel-ok-branch-${Date.now()}`;
    await db.insert(configBranches).values({
      id: branchId,
      masjidId: id,
      adminId: `admin-${id}`,
      branchName: 'main',
      status: 'OPEN',
    });

    const res = await callCancel(id, { branch_id: branchId }, adminLocals(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const branch = await db.select().from(configBranches).where(eq(configBranches.id, branchId)).get();
    expect(branch?.status).toBe('ABANDONED');
  });
});
