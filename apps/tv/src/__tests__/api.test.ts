import { describe, it, expect, vi } from 'vitest';
import { fetchPagePayload, fetchPrayerTimes } from '$lib/api';

function mockFetch(data: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('fetchPagePayload', () => {
  it('calls the correct URL', async () => {
    const fake = mockFetch({ masjid: { slug: 'test' } });
    await fetchPagePayload('test-masjid', fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test-masjid');
  });

  it('returns parsed JSON on success', async () => {
    const payload = { masjid: { slug: 'test-masjid', name: 'Test' } };
    const fake = mockFetch(payload);
    const result = await fetchPagePayload('test-masjid', fake);
    expect(result).toEqual(payload);
  });

  it('throws on non-ok response', async () => {
    const fake = mockFetch({}, false, 404);
    await expect(fetchPagePayload('bad', fake)).rejects.toThrow(
      'Failed to fetch page payload: 404',
    );
  });
});

describe('fetchPrayerTimes', () => {
  it('calls the correct URL without date', async () => {
    const fake = mockFetch({ date: '2026-01-01', times: {} });
    await fetchPrayerTimes('test-masjid', undefined, fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test-masjid/prayer-times');
  });

  it('appends date query param when provided', async () => {
    const fake = mockFetch({ date: '2026-06-15', times: {} });
    await fetchPrayerTimes('test-masjid', '2026-06-15', fake);
    expect(fake).toHaveBeenCalledWith(
      '/api/v1/masjids/test-masjid/prayer-times?date=2026-06-15',
    );
  });

  it('throws on non-ok response', async () => {
    const fake = mockFetch({}, false, 500);
    await expect(
      fetchPrayerTimes('test', undefined, fake),
    ).rejects.toThrow('Failed to fetch prayer times: 500');
  });
});