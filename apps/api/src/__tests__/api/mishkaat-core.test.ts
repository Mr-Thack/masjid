import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { GET as getBoard } from '../../routes/api/v1/masjids/[slug]/board/+server';
import { POST as postRegister } from '../../routes/api/v1/auth/register/+server';

// ---------------------------------------------------------------------------
// Mishkaat core — Phase 1 (docs/design-language.md §7.7, §8)
//  - board payload carries server_time for TV clock correction
//  - new registrations default to the Mishkaat style system
// ---------------------------------------------------------------------------

let db: ReturnType<typeof getDb>;

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
  const id = `masjid-core-${tag}-${Date.now()}`;
  const slug = `core-${tag}-${Date.now()}`;
  await db.insert(masjids).values({
    id,
    slug,
    name: 'Core Test Masjid',
    latitude: 33.75,
    longitude: -84.4,
    timezone: 'America/New_York',
  });
  await db.insert(masjidThemes).values({ masjidId: id });
  return { id, slug };
}

beforeAll(() => {
  db = getDb();
});

describe('GET /masjids/:slug/board — server_time (§7.7)', () => {
  it('includes an ISO server_time close to now', async () => {
    const { slug } = await seedMasjid('svtime');
    const before = Date.now();
    const req = new Request(`http://localhost/api/v1/masjids/${slug}/board`);
    const res = await getBoard(fakeEvent(req, { params: { slug } }));
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.server_time).toBe('string');
    const parsed = Date.parse(body.server_time);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(parsed).toBeGreaterThanOrEqual(before - 1000);
    expect(parsed).toBeLessThanOrEqual(after + 1000);
  });
});

describe('POST /auth/register — Mishkaat defaults (§8)', () => {
  it('registers new masjids with the Mishkaat style system', async () => {
    const tag = Date.now();
    const body = {
      slug: `mishkaat-reg-${tag}`,
      name: 'Mishkaat Registration Masjid',
      latitude: 33.75,
      longitude: -84.4,
      timezone: 'America/New_York',
      calculation_method: 2,
      asr_madhab: 'shafi',
      high_latitude_rule: 'seventh_of_night',
      show_dual_asr: false,
      admin_email: `admin-mishkaat-${tag}@example.com`,
      admin_password: 'password123',
    };
    const req = new Request('http://localhost/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await postRegister(fakeEvent(req));
    expect(res.status).toBe(201);
    const resBody = await res.json();
    const masjidId = resBody.admin.masjid_id;

    const theme = await db
      .select()
      .from(masjidThemes)
      .where(eq(masjidThemes.masjidId, masjidId))
      .get();

    expect(theme?.styleSystem).toBe('mishkaat');
    expect(theme?.styleOptions).toBe('{}');
    expect(theme?.layoutPreset).toBe('mishkaat');
    // Gold metal family (§7.4) + Amiri display face (§7.2)
    expect(theme?.accentColor).toBe('#d4af37');
    expect(theme?.primaryColor).toBe('#9c7c1e');
    expect(theme?.fontHeading).toBe('Amiri');
  });

  it('keeps seed-style masjids on Sakeenah (existing masjids unchanged)', async () => {
    // Masjids created outside the register flow (seed, migrations) keep the
    // column default — their boards stay Sakeenah.
    const { id } = await seedMasjid('sakeenah-default');
    const theme = await db
      .select()
      .from(masjidThemes)
      .where(eq(masjidThemes.masjidId, id))
      .get();
    expect(theme?.styleSystem).toBe('sakeenah');
  });
});
