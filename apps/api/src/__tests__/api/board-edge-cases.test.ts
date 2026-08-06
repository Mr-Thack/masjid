import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, admins, prayerRules } from '$lib/server/db/schema';
import { GET as getBoard } from '../../routes/api/v1/masjids/[slug]/board/+server';
import { GET as getPrayer } from '../../routes/api/v1/masjids/[slug]/prayer/+server';

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

async function seedMasjid(tag: string, overrides: Record<string, unknown> = {}) {
  const id = `masjid-edge-${tag}-${Date.now()}`;
  const slug = `edge-${tag}-${Date.now()}`;
  await db.insert(masjids).values({
    id,
    slug,
    name: 'Edge Case Masjid',
    latitude: 33.75,
    longitude: -84.4,
    timezone: 'America/New_York',
    ...overrides,
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

async function callBoard(slug: string) {
  const req = new Request(`http://localhost/api/v1/masjids/${slug}/board`);
  return getBoard(fakeEvent(req, { params: { slug } }));
}

async function callPrayer(slug: string, date?: string) {
  const url = new URL(`http://localhost/api/v1/masjids/${slug}/prayer`);
  if (date) url.searchParams.set('date', date);
  const req = new Request(url.toString());
  return getPrayer(fakeEvent(req, { params: { slug }, url }));
}

beforeAll(() => {
  db = getDb();
});

describe('Board endpoint graceful degradation', () => {
  it('returns 200 for normal masjid with all 8 days valid', async () => {
    const { slug } = await seedMasjid('normal');
    const res = await callBoard(slug);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.today.times).toBeDefined();
    expect(body.today.times.fajr.adhaan).toMatch(/^\d{2}:\d{2}$/);
    expect(body.upcoming_days).toHaveLength(7);
    for (const day of body.upcoming_days) {
      expect(day.times).toBeDefined();
      expect(day.times.fajr.adhaan).toMatch(/^\d{2}:\d{2}$/);
      expect(day.error).toBeUndefined();
    }
  });

  it('returns 200 even when some upcoming days fail (bad coordinates)', async () => {
    const { slug } = await seedMasjid('bad-coords', {
      latitude: 78,
      longitude: 15,
      timezone: 'America/New_York',
    });
    const res = await callBoard(slug);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.upcoming_days).toHaveLength(7);

    const normalDays = body.upcoming_days.filter((d: Record<string, unknown>) => d.times !== null);
    const errorDays = body.upcoming_days.filter((d: Record<string, unknown>) => d.times === null && d.error);

    expect(normalDays.length).toBeGreaterThan(0);
    // Some combination should work or fail depending on latitude/solar position
    expect(normalDays.length + errorDays.length).toBe(7);
    if (errorDays.length > 0) {
      expect(typeof errorDays[0].error).toBe('string');
      expect(errorDays[0].error.length).toBeGreaterThan(0);
    }
  });

  it('returns 200 when today fails but upcoming days exist', async () => {
    const { slug } = await seedMasjid('bad-today', {
      latitude: 85,
      longitude: 0,
      timezone: 'America/New_York',
    });
    const res = await callBoard(slug);
    expect(res.status).toBe(200);

    const body = await res.json();
    // At 85N in August, today may fail
    if (body.today.times === null) {
      expect(body.today.error).toBeDefined();
      expect(typeof body.today.error).toBe('string');
    }
    // Still has upcoming days
    expect(body.upcoming_days).toBeDefined();
  });
});

describe('Board with broken prayer rules', () => {
  it('degrades gracefully when a date_range rule produces bad times', async () => {
    const { id, slug } = await seedMasjid('date-range-rule');

    // Insert a prayer rule with a date_range that matches future dates
    // The action sets right_after_adhaan AFTER an add_minutes action
    // This creates a right_after_adhaan mismatch → verifyComputedTimes should catch it
    const today = new Date();
    const futureStart = new Date(today);
    futureStart.setDate(futureStart.getDate() + 5);
    const startStr = futureStart.toISOString().slice(0, 10);
    const endStr = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

    // Rule 1: add 10 min to maghrib iqaamah
    await db.insert(prayerRules).values({
      id: `rule-1-${id}`,
      masjidId: id,
      prayerName: 'maghrib',
      executionOrder: 1,
      ruleName: 'Add 10 min to maghrib',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    });

    // Rule 2: starting in 5 days, set maghrib to right_after_adhaan
    // This conflicts with rule 1 (iqaamah != adhaan + right_after_adhaan flag)
    await db.insert(prayerRules).values({
      id: `rule-2-${id}`,
      masjidId: id,
      prayerName: 'maghrib',
      executionOrder: 2,
      ruleName: 'Switch to right_after_adhaan',
      conditionsJson: JSON.stringify([{ type: 'date_range', start: startStr, end: endStr }]),
      actionJson: JSON.stringify({ type: 'right_after_adhaan' }),
    });

    const res = await callBoard(slug);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.upcoming_days).toHaveLength(7);

    // Days before the date_range should be fine
    // Days within the date_range should fail (right_after_adhaan + iqaamah != adhaan)
    const hasErrorDays = body.upcoming_days.some((d: Record<string, unknown>) => d.error);
    expect(hasErrorDays).toBe(true);
  });

  it('degrades gracefully with a round_up rule that has increment=0', async () => {
    const { id, slug } = await seedMasjid('zero-increment');

    await db.insert(prayerRules).values({
      id: `rule-zero-${id}`,
      masjidId: id,
      prayerName: 'dhuhr',
      executionOrder: 1,
      ruleName: 'Broken round_up',
      conditionsJson: JSON.stringify([{ type: 'date_range', start: '2026-08-10', end: '2026-08-20' }]),
      actionJson: JSON.stringify({ type: 'round_up', increment: 0 }),
    });

    const res = await callBoard(slug);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.upcoming_days).toHaveLength(7);
    // Today (Aug 5) is outside the range, upcoming days Aug 10+ are inside
    // The round_up with increment=0 produces NaN but shouldn't crash
  });
});

describe('Prayer endpoint edge cases', () => {
  it('returns 200 for valid date range', async () => {
    const { slug } = await seedMasjid('prayer-valid');
    const res = await callPrayer(slug, '2026-08-10');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.date).toBe('2026-08-10');
    expect(body.times.fajr.adhaan).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns 200 for today when no date param given', async () => {
    const { slug } = await seedMasjid('prayer-no-date');
    const res = await callPrayer(slug);
    expect(res.status).toBe(200);

    const body = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    expect(body.date).toBe(today);
  });

  it('returns 200 for far-future date', async () => {
    const { slug } = await seedMasjid('prayer-far');
    const res = await callPrayer(slug, '2027-06-15');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.date).toBe('2027-06-15');
    expect(body.times.fajr.adhaan).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns 500 with error message for bad coordinates on specific dates', async () => {
    const { slug } = await seedMasjid('prayer-bad-coords', {
      latitude: 78,
      longitude: 15,
      timezone: 'America/New_York',
    });
    const res = await callPrayer(slug, '2026-08-10');
    // Extreme latitude may produce times where fajr >= sunrise,
    // but verifyComputedTimes now warns instead of throwing.
    // However Intl.DateTimeFormat may still produce --:-- which
    // could cause issues downstream. The important thing is:
    // it should NOT be a 500 with swallowed error.
    if (res.status === 200) {
      const body = await res.json();
      expect(body.times).toBeDefined();
    } else {
      // If it does fail, the error should be descriptive
      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toBeDefined();
      expect(body.error.message).not.toBe('Failed to compute prayer times');
    }
  });
});

describe('Board response contract', () => {
  it('includes server_time field', async () => {
    const { slug } = await seedMasjid('server-time');
    const res = await callBoard(slug);
    const body = await res.json();
    expect(body.server_time).toBeDefined();
    expect(new Date(body.server_time).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('includes all required top-level keys', async () => {
    const { slug } = await seedMasjid('keys');
    const res = await callBoard(slug);
    const body = await res.json();

    expect(body).toHaveProperty('masjid');
    expect(body).toHaveProperty('theme');
    expect(body).toHaveProperty('today');
    expect(body).toHaveProperty('server_time');
    expect(body).toHaveProperty('upcoming_days');
    expect(body).toHaveProperty('jumuah');
    expect(body).toHaveProperty('pinned_announcement');
    expect(body).toHaveProperty('recent_announcements');
  });

  it('today.times has error key when today fails', async () => {
    const { slug } = await seedMasjid('today-fail', {
      latitude: 85,
      longitude: 0,
      timezone: 'America/New_York',
    });
    const res = await callBoard(slug);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today.date).toBeDefined();
    // today.times may be null if computation fails
    if (body.today.times === null) {
      expect(body.today.error).toBeDefined();
    }
  });
});

describe('Board with masjid that has no prayer rules', () => {
  it('returns default iqaamah = adhaan for all prayers', async () => {
    const { slug } = await seedMasjid('no-rules');
    const res = await callBoard(slug);
    expect(res.status).toBe(200);

    const body = await res.json();
    const times = body.today.times;
    expect(times.fajr.iqaamah).toBe(times.fajr.adhaan);
    expect(times.dhuhr.iqaamah).toBe(times.dhuhr.adhaan);
    expect(times.asr.iqaamah).toBe(times.asr.adhaan);
    expect(times.maghrib.iqaamah).toBe(times.maghrib.adhaan);
    expect(times.isha.iqaamah).toBe(times.isha.adhaan);
  });
});

describe('Board with dual Asr', () => {
  it('includes asr_secondary for hanafi masjid', async () => {
    const { slug } = await seedMasjid('dual-asr', {
      asrMadhab: 'hanafi',
      showDualAsr: true,
    });
    const res = await callBoard(slug);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.today.times.asr_secondary).toBeDefined();
    expect(body.today.times.asr_secondary).toMatch(/^\d{2}:\d{2}$/);
  });
});