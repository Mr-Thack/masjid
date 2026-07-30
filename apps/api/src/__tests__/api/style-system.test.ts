import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, admins } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { GET as getBoard } from '../../routes/api/v1/masjids/[slug]/board/+server';
import {
  GET as getAdminMasjid,
  PUT as putAdminMasjid,
} from '../../routes/api/v1/admin/masjids/[id]/+server';
import { parseStyleOptionsJson } from '$lib/server/style-options';

// ---------------------------------------------------------------------------
// Style system pass-through (docs/design-language.md — Phase 0 plumbing)
//
// Verifies the new `style_system` / `style_options` columns flow from the DB
// through the public board endpoint and the admin GET/PUT endpoints.
// ---------------------------------------------------------------------------

let db: ReturnType<typeof getDb>;

function adminLocals(masjidId: string) {
  return {
    admin: {
      sub: `admin-${masjidId}`,
      masjid_id: masjidId,
      email: `admin-${masjidId}@example.com`,
      display_name: 'Test Admin',
    },
  };
}

function fakeEvent(req: Request, extra: Record<string, unknown> = {}) {
  return {
    request: req,
    url: new URL(req.url),
    platform: { env: {} },
    cookies: {} as never,
    fetch: globalThis.fetch,
    locals: {},
    ...extra,
  } as never;
}

async function seedMasjid(tag: string) {
  const id = `masjid-style-${tag}-${Date.now()}`;
  const slug = `style-${tag}-${Date.now()}`;
  await db.insert(masjids).values({
    id,
    slug,
    name: 'Style Test Masjid',
    latitude: 33.75,
    longitude: -84.4,
    timezone: 'America/New_York',
  });
  await db.insert(masjidThemes).values({ masjidId: id });
  await db.insert(admins).values({
    id: `admin-${id}`,
    masjidId: id,
    email: `admin-${id}@example.com`,
    passwordHash: 'unused',
  });
  return { id, slug };
}

function callBoard(slug: string) {
  const req = new Request(`http://localhost/api/v1/masjids/${slug}/board`);
  return getBoard(fakeEvent(req, { params: { slug } }));
}

function callAdminGet(id: string) {
  const req = new Request(`http://localhost/api/v1/admin/masjids/${id}`);
  return getAdminMasjid(fakeEvent(req, { params: { id }, locals: adminLocals(id) }));
}

function callAdminPut(id: string, body: unknown) {
  const req = new Request(`http://localhost/api/v1/admin/masjids/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return putAdminMasjid(fakeEvent(req, { params: { id }, locals: adminLocals(id) }));
}

beforeAll(() => {
  db = getDb();
});

describe('parseStyleOptionsJson', () => {
  it('returns {} for null/undefined/empty', () => {
    expect(parseStyleOptionsJson(null)).toEqual({});
    expect(parseStyleOptionsJson(undefined)).toEqual({});
    expect(parseStyleOptionsJson('')).toEqual({});
  });

  it('returns {} for invalid JSON', () => {
    expect(parseStyleOptionsJson('{not json')).toEqual({});
    expect(parseStyleOptionsJson('undefined')).toEqual({});
  });

  it('returns {} for non-object JSON', () => {
    expect(parseStyleOptionsJson('[]')).toEqual({});
    expect(parseStyleOptionsJson('"gold"')).toEqual({});
    expect(parseStyleOptionsJson('42')).toEqual({});
  });

  it('parses a valid options object', () => {
    expect(parseStyleOptionsJson('{"metal":"copper","arch":false}')).toEqual({
      metal: 'copper',
      arch: false,
    });
  });
});

describe('GET /masjids/:slug/board — style fields', () => {
  it('includes style_system and style_options in the theme block', async () => {
    const { slug } = await seedMasjid('board');
    const res = await callBoard(slug);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme.style_system).toBe('sakeenah');
    expect(body.theme.style_options).toEqual({});
    // Existing fields still present
    expect(body.theme.primary_color).toBeDefined();
    expect(body.theme.label_fajr).toBeDefined();
  });

  it('reflects updated style_system and parsed style_options', async () => {
    const { id, slug } = await seedMasjid('board-mishkaat');
    await db
      .update(masjidThemes)
      .set({ styleSystem: 'mishkaat', styleOptions: '{"metal":"rose","arch":false}' })
      .where(eq(masjidThemes.masjidId, id));

    const res = await callBoard(slug);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme.style_system).toBe('mishkaat');
    expect(body.theme.style_options).toEqual({ metal: 'rose', arch: false });
  });

  it('degrades gracefully when style_options holds invalid JSON', async () => {
    const { id, slug } = await seedMasjid('board-badjson');
    await db
      .update(masjidThemes)
      .set({ styleOptions: '{broken' })
      .where(eq(masjidThemes.masjidId, id));

    const res = await callBoard(slug);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme.style_options).toEqual({});
  });
});

describe('GET /admin/masjids/:id — style fields', () => {
  it('returns style_system and parsed style_options', async () => {
    const { id } = await seedMasjid('adminget');
    await db
      .update(masjidThemes)
      .set({ styleSystem: 'mishkaat', styleOptions: '{"metal":"silver"}' })
      .where(eq(masjidThemes.masjidId, id));

    const res = await callAdminGet(id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme.style_system).toBe('mishkaat');
    expect(body.theme.style_options).toEqual({ metal: 'silver' });
  });
});

describe('PUT /admin/masjids/:id — style fields', () => {
  it('persists style_system and style_options', async () => {
    const { id } = await seedMasjid('put');
    const res = await callAdminPut(id, {
      style_system: 'mishkaat',
      style_options: { metal: 'copper', ambient: false, frames: ['hadith'] },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme.style_system).toBe('mishkaat');
    expect(body.theme.style_options).toEqual({
      metal: 'copper',
      ambient: false,
      frames: ['hadith'],
    });

    const row = await db.select().from(masjidThemes).where(eq(masjidThemes.masjidId, id)).get();
    expect(row?.styleSystem).toBe('mishkaat');
    expect(JSON.parse(row?.styleOptions ?? '{}')).toEqual({
      metal: 'copper',
      ambient: false,
      frames: ['hadith'],
    });
  });

  it('does not clobber other theme fields when only style fields change', async () => {
    const { id } = await seedMasjid('put-isolated');
    await db
      .update(masjidThemes)
      .set({ accentColor: '#123456', labelFajr: 'Subh' })
      .where(eq(masjidThemes.masjidId, id));

    const res = await callAdminPut(id, { style_system: 'mishkaat' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme.style_system).toBe('mishkaat');
    expect(body.theme.accent_color).toBe('#123456');
    expect(body.theme.label_fajr).toBe('Subh');
  });

  // NOTE: the admin PUT uses UpdateThemeSchema.safeParse — invalid theme input
  // is skipped (200, theme unchanged) rather than rejected with 400. This is
  // the pre-existing contract for every theme field; style fields follow it.
  it('ignores an invalid style_system (theme unchanged)', async () => {
    const { id } = await seedMasjid('put-badsystem');
    const res = await callAdminPut(id, { style_system: 'fancy' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme.style_system).toBe('sakeenah');
  });

  it('ignores invalid style_options values (theme unchanged)', async () => {
    const { id } = await seedMasjid('put-badoptions');
    const res = await callAdminPut(id, { style_options: { metal: 'platinum' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme.style_options).toEqual({});
  });

  it('round-trips through the board endpoint after a PUT', async () => {
    const { id, slug } = await seedMasjid('put-board');
    const putRes = await callAdminPut(id, {
      style_system: 'mishkaat',
      style_options: { metal: 'gold', motif: 'eight-point-star' },
    });
    expect(putRes.status).toBe(200);

    const boardRes = await callBoard(slug);
    const board = await boardRes.json();
    expect(board.theme.style_system).toBe('mishkaat');
    expect(board.theme.style_options).toEqual({ metal: 'gold', motif: 'eight-point-star' });
  });
});
