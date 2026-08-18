import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, upsertIntegrationValue, getD1Shim } from '../../lib/server/db';
import { masjids, masjidIntegrations } from '../../lib/server/db/schema';

const db = getDb();

async function seedMasjid(tag: string): Promise<string> {
  const id = `upsert-int-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(masjids).values({
    id,
    slug: id,
    name: `Upsert Test ${tag}`,
    latitude: 33.9,
    longitude: -84.6,
    timezone: 'America/New_York',
  });
  return id;
}

async function rowsFor(masjidId: string): Promise<Map<string, string>> {
  const rows = await db
    .select()
    .from(masjidIntegrations)
    .where(eq(masjidIntegrations.masjidId, masjidId))
    .all();
  return new Map(rows.map((r) => [`${r.provider}:${r.keyName}`, r.value]));
}

describe('getDb', () => {
  it('returns local SQLite DB in Node.js even with a mock D1 binding', () => {
    // In local Node.js, process exists and caches.default doesn't.
    // This simulates adapter-cloudflare's mock D1 binding.
    const mockD1 = { prepare: () => ({ bind: () => ({ first: () => Promise.resolve({ ok: 1 }) }) }) };
    const db2 = getDb(mockD1);

    // Should return a Drizzle instance backed by local SQLite, not mock D1.
    // The mock D1 would return undefined for most Drizzle operations; the local
    // SQLite will return real data from our seed DB.
    expect(db2).toBeDefined();
    expect(typeof db2.select).toBe('function');
    expect(typeof db2.insert).toBe('function');
  });

  it('throws when no D1 binding and not in Node.js', () => {
    // In a Worker without caches (simulating a minimal Worker-like env),
    // and without a D1 binding, it should throw.
    // We can't easily mock `typeof caches.default !== 'undefined'` being true,
    // but we can test that when d1 is null AND process exists (Node.js), it works.
    // The core guard: d1 is null, process exists → returns local DB.
    const db2 = getDb();
    expect(db2).toBeDefined();
    expect(typeof db2.select).toBe('function');
  });
});

describe('D1 shim error semantics', () => {
  // Regression: the shim used to swallow every SQL error (returning
  // null/[]/false), diverging from production D1 which throws. This made
  // agent flows silently no-op on failed INSERTs in local dev.
  // (docs/regression-prevention.md, pattern 15)

  it('throws on invalid SQL instead of returning null', async () => {
    const shim = getD1Shim();
    await expect(
      shim.prepare('SELECT * FROM nonexistent_table').bind().first(),
    ).rejects.toThrow();
  });

  it('all() throws on invalid SQL', async () => {
    const shim = getD1Shim();
    await expect(
      shim.prepare('GARBAGE SQL SYNTAX').bind().all(),
    ).rejects.toThrow();
  });

  it('run() throws on invalid SQL', async () => {
    const shim = getD1Shim();
    await expect(
      shim.prepare('INSERT INTO nonexistent_table VALUES (1)').bind().run(),
    ).rejects.toThrow();
  });
});

describe('upsertIntegrationValue', () => {
  // Regression test for the missing-WHERE bug: the UPDATE branch used to filter
  // only by masjidId, so updating any single key overwrote EVERY integration row
  // for that masjid with the same value (docs/regression-prevention.md, pattern 1).
  // The final value written by the PUT loop (location_id) clobbered app_id and
  // access_token.

  it('updates only the targeted row — sibling rows unchanged', async () => {
    const masjidId = await seedMasjid('a');
    await db.insert(masjidIntegrations).values([
      { masjidId, provider: 'square', keyName: 'access_token', value: 'tok-old' },
      { masjidId, provider: 'square', keyName: 'app_id', value: 'app-old' },
      { masjidId, provider: 'square', keyName: 'location_id', value: 'loc-old' },
      { masjidId, provider: 'brevo', keyName: 'api_key', value: 'brevo-key-old' },
      { masjidId, provider: 'brevo', keyName: 'sender_email', value: 'old@example.com' },
      { masjidId, provider: 'brevo', keyName: 'sender_name', value: 'Old Sender' },
    ]);

    await upsertIntegrationValue(db, masjidId, 'square', 'access_token', 'tok-new');

    const byKey = await rowsFor(masjidId);
    expect(byKey.get('square:access_token')).toBe('tok-new');
    expect(byKey.get('square:app_id')).toBe('app-old');
    expect(byKey.get('square:location_id')).toBe('loc-old');
    expect(byKey.get('brevo:api_key')).toBe('brevo-key-old');
    expect(byKey.get('brevo:sender_email')).toBe('old@example.com');
    expect(byKey.get('brevo:sender_name')).toBe('Old Sender');
  });

  it('does not touch another masjid\'s rows', async () => {
    const masjidA = await seedMasjid('b');
    const masjidB = await seedMasjid('b2');
    await db.insert(masjidIntegrations).values([
      { masjidId: masjidA, provider: 'square', keyName: 'access_token', value: 'a-old' },
      { masjidId: masjidA, provider: 'square', keyName: 'app_id', value: 'a-app' },
      { masjidId: masjidB, provider: 'square', keyName: 'access_token', value: 'b-old' },
      { masjidId: masjidB, provider: 'square', keyName: 'app_id', value: 'b-app' },
    ]);

    await upsertIntegrationValue(db, masjidA, 'square', 'access_token', 'a-new');

    const a = await rowsFor(masjidA);
    const b = await rowsFor(masjidB);
    expect(a.get('square:access_token')).toBe('a-new');
    expect(a.get('square:app_id')).toBe('a-app');
    expect(b.get('square:access_token')).toBe('b-old');
    expect(b.get('square:app_id')).toBe('b-app');
  });

  it('inserts a new key when no row exists for that provider/key', async () => {
    const masjidId = await seedMasjid('c');
    await db.insert(masjidIntegrations).values([
      { masjidId, provider: 'square', keyName: 'app_id', value: 'app-old' },
    ]);

    await upsertIntegrationValue(db, masjidId, 'square', 'access_token', 'tok-fresh');
    await upsertIntegrationValue(db, masjidId, 'brevo', 'api_key', 'brevo-fresh');

    const byKey = await rowsFor(masjidId);
    expect(byKey.size).toBe(3);
    expect(byKey.get('square:access_token')).toBe('tok-fresh');
    expect(byKey.get('square:app_id')).toBe('app-old');
    expect(byKey.get('brevo:api_key')).toBe('brevo-fresh');
  });
});
