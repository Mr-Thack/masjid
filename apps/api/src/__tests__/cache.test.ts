import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Import from actual source file
// ---------------------------------------------------------------------------
import {
  setCachedTimes,
  getCachedTimes,
  invalidateMasjidCache,
  getCachedPagePayload,
  setCachedPagePayload,
  invalidatePageCache,
} from '$lib/server/prayer/cache';

// ---------------------------------------------------------------------------
// Mock KV namespace
// ---------------------------------------------------------------------------
function createMockKV(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    getWithMetadata: async (key: string) => {
      const value = store.get(key);
      return { value: value ?? null, metadata: null, cacheStatus: value ? 'hit' : 'miss' } as any;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
      return undefined as any;
    },
    delete: async (key: string) => {
      store.delete(key);
      return undefined as any;
    },
    list: async (opts: { prefix?: string }) => {
      const keys: { name: string }[] = [];
      const prefix = opts?.prefix ?? '';
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          keys.push({ name: key });
        }
      }
      return { keys: keys as any, list_complete: true };
    },
  } as unknown as KVNamespace;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const samplePrayerTimes = {
  date: '2026-07-19',
  masjid: { slug: 'masjid-al-noor', name: 'Masjid Al Noor' },
  calculation_method: 'ISNA',
  times: {
    fajr: { adhaan: '04:23', iqaamah: '04:43' },
    sunrise: '05:47',
    dhuhr: { adhaan: '13:15', iqaamah: '13:25' },
    asr: { adhaan: '17:05', iqaamah: '17:15' },
    maghrib: { adhaan: '20:32', iqaamah: '20:37' },
    isha: { adhaan: '22:10', iqaamah: '22:20' },
  },
};

// ---------------------------------------------------------------------------
describe('Cache — setCachedTimes / getCachedTimes', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('setCachedTimes then getCachedTimes returns the data', async () => {
    await setCachedTimes(kv, 'masjid-1', '2026-07-19', samplePrayerTimes);
    const cached = await getCachedTimes(kv, 'masjid-1', '2026-07-19');
    expect(cached).toEqual(samplePrayerTimes);
  });

  it('getCachedTimes returns null on cache miss', async () => {
    const cached = await getCachedTimes(kv, 'nonexistent-masjid', '2026-07-19');
    expect(cached).toBeNull();
  });

  it('getCachedTimes returns null on miss (different date)', async () => {
    await setCachedTimes(kv, 'masjid-1', '2026-07-19', samplePrayerTimes);
    const cached = await getCachedTimes(kv, 'masjid-1', '2026-07-20');
    expect(cached).toBeNull();
  });

  it('returns null when KV is undefined', async () => {
    const cached = await getCachedTimes(undefined, 'masjid-1', '2026-07-19');
    expect(cached).toBeNull();
  });

  it('does not throw when setting with undefined KV', async () => {
    await expect(setCachedTimes(undefined, 'masjid-1', '2026-07-19', samplePrayerTimes)).resolves.not.toThrow();
  });

  it('overwrites existing data for same key', async () => {
    await setCachedTimes(kv, 'masjid-1', '2026-07-19', samplePrayerTimes);

    const updatedTimes = {
      ...samplePrayerTimes,
      times: { ...samplePrayerTimes.times, dhuhr: { adhaan: '13:30', iqaamah: '13:45' } },
    };
    await setCachedTimes(kv, 'masjid-1', '2026-07-19', updatedTimes as any);

    const cached = await getCachedTimes(kv, 'masjid-1', '2026-07-19');
    expect((cached as any).times.dhuhr.adhaan).toBe('13:30');
  });

  it('different masjids have independent cache', async () => {
    await setCachedTimes(kv, 'masjid-1', '2026-07-19', samplePrayerTimes);

    const masjid2Times = {
      ...samplePrayerTimes,
      masjid: { slug: 'masjid-al-huda', name: 'Masjid Al Huda' },
    };
    await setCachedTimes(kv, 'masjid-2', '2026-07-19', masjid2Times);

    const cached1 = await getCachedTimes(kv, 'masjid-1', '2026-07-19');
    const cached2 = await getCachedTimes(kv, 'masjid-2', '2026-07-19');

    expect(cached1).toEqual(samplePrayerTimes);
    expect(cached2).toEqual(masjid2Times);
  });

  it('multiple dates for same masjid are independent', async () => {
    const day1 = { ...samplePrayerTimes, date: '2026-07-19' };
    const day2 = { ...samplePrayerTimes, date: '2026-07-20' };

    await setCachedTimes(kv, 'masjid-1', '2026-07-19', day1);
    await setCachedTimes(kv, 'masjid-1', '2026-07-20', day2 as any);

    const cachedDay1 = await getCachedTimes(kv, 'masjid-1', '2026-07-19');
    const cachedDay2 = await getCachedTimes(kv, 'masjid-1', '2026-07-20');

    expect(cachedDay1!.date).toBe('2026-07-19');
    expect(cachedDay2!.date).toBe('2026-07-20');
  });
});

// ---------------------------------------------------------------------------
describe('Cache — invalidateMasjidCache', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('removes cached data for a masjid', async () => {
    await setCachedTimes(kv, 'masjid-1', '2026-07-19', samplePrayerTimes);
    await setCachedTimes(kv, 'masjid-1', '2026-07-20', samplePrayerTimes);

    await invalidateMasjidCache(kv, 'masjid-1');

    const cachedToday = await getCachedTimes(kv, 'masjid-1', '2026-07-19');
    const cachedTomorrow = await getCachedTimes(kv, 'masjid-1', '2026-07-20');

    expect(cachedToday).toBeNull();
    expect(cachedTomorrow).toBeNull();
  });

  it('does NOT affect other masjids', async () => {
    await setCachedTimes(kv, 'masjid-1', '2026-07-19', samplePrayerTimes);
    await setCachedTimes(kv, 'masjid-2', '2026-07-19', samplePrayerTimes);

    await invalidateMasjidCache(kv, 'masjid-2');

    const masjid1Cached = await getCachedTimes(kv, 'masjid-1', '2026-07-19');
    const masjid2Cached = await getCachedTimes(kv, 'masjid-2', '2026-07-19');

    expect(masjid1Cached).not.toBeNull();
    expect(masjid2Cached).toBeNull();
  });

  it('does not throw on invalidating non-existent masjid cache', async () => {
    await expect(invalidateMasjidCache(kv, 'nonexistent')).resolves.not.toThrow();
  });

  it('does not throw when KV is undefined', async () => {
    await expect(invalidateMasjidCache(undefined, 'masjid-1')).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Page payload cache
// ---------------------------------------------------------------------------
describe('Cache — page payload', () => {
  let kv: KVNamespace;
  const samplePage = { masjid: { name: 'Test' }, theme: { primary_color: '#000000' } };

  beforeEach(() => {
    kv = createMockKV();
  });

  it('setCachedPagePayload then getCachedPagePayload returns data', async () => {
    await setCachedPagePayload(kv, 'masjid-al-noor', samplePage);
    const cached = await getCachedPagePayload(kv, 'masjid-al-noor');
    expect(cached).toEqual(samplePage);
  });

  it('getCachedPagePayload returns null on miss', async () => {
    const cached = await getCachedPagePayload(kv, 'nonexistent');
    expect(cached).toBeNull();
  });

  it('invalidatePageCache removes page payload', async () => {
    await setCachedPagePayload(kv, 'masjid-al-noor', samplePage);
    await invalidatePageCache(kv, 'masjid-al-noor');
    const cached = await getCachedPagePayload(kv, 'masjid-al-noor');
    expect(cached).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Cache — edge cases', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('handles empty KV store', async () => {
    const cached = await getCachedTimes(kv, 'any-masjid', '2026-07-19');
    expect(cached).toBeNull();
  });

  it('handles large payloads', async () => {
    const largePayload = {
      ...samplePrayerTimes,
      announcements: Array.from({ length: 100 }, (_, i) => ({
        id: `ann-${i}`,
        title: `Announcement ${i}`,
        content_markdown: 'Content '.repeat(50),
      })),
    };

    await setCachedTimes(kv, 'masjid-1', '2026-07-19', largePayload as any);
    const cached = await getCachedTimes(kv, 'masjid-1', '2026-07-19');
    expect(cached).toEqual(largePayload);
  });

  it('handles special characters in masjid IDs', async () => {
    await setCachedTimes(kv, 'masjid-al-noor-123-test', '2026-07-19', samplePrayerTimes);
    const cached = await getCachedTimes(kv, 'masjid-al-noor-123-test', '2026-07-19');
    expect(cached).toEqual(samplePrayerTimes);
  });
});