import { describe, it, expect, vi } from 'vitest';
import {
  fetchPagePayload,
  fetchPrayerTimes,
  fetchAnnouncements,
  fetchJumuah,
} from '$lib/api';

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
    const payload = { masjid: { slug: 'test', name: 'Test' } };
    const fake = mockFetch(payload);
    const result = await fetchPagePayload('test', fake);
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
    const fake = mockFetch({ times: {} });
    await fetchPrayerTimes('test', undefined, fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test/prayer');
  });

  it('appends date query param', async () => {
    const fake = mockFetch({ times: {} });
    await fetchPrayerTimes('test', '2026-06-15', fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test/prayer?date=2026-06-15');
  });
});

describe('fetchAnnouncements', () => {
  it('calls the correct URL', async () => {
    const fake = mockFetch({ announcements: [] });
    await fetchAnnouncements('test', fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test/announcements');
  });

  it('throws on non-ok response', async () => {
    const fake = mockFetch({}, false, 500);
    await expect(fetchAnnouncements('test', fake)).rejects.toThrow(
      'Failed to fetch announcements: 500',
    );
  });
});

describe('fetchJumuah', () => {
  it('calls the correct URL', async () => {
    const fake = mockFetch({ sessions: [] });
    await fetchJumuah('test', fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test/jumuah');
  });

  it('throws on non-ok response', async () => {
    const fake = mockFetch({}, false, 500);
    await expect(fetchJumuah('test', fake)).rejects.toThrow(
      'Failed to fetch jumuah: 500',
    );
  });
});