import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, admins, configBranches } from '$lib/server/db/schema';
import { GET as getBranches } from '../../routes/api/v1/admin/masjids/[id]/branches/+server';

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
