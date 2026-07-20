import { describe, it, expect, vi } from 'vitest';
import { fetchBoardPayload } from '$lib/api';

function mockFetch(data: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('fetchBoardPayload', () => {
  it('calls the correct URL', async () => {
    const fake = mockFetch({ masjid: { slug: 'test' } });
    await fetchBoardPayload('test-masjid', fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test-masjid/board');
  });

  it('returns parsed JSON on success', async () => {
    const payload = { masjid: { slug: 'test-masjid', name: 'Test' } };
    const fake = mockFetch(payload);
    const result = await fetchBoardPayload('test-masjid', fake);
    expect(result).toEqual(payload);
  });

  it('throws on non-ok response', async () => {
    const fake = mockFetch({}, false, 404);
    await expect(fetchBoardPayload('bad', fake)).rejects.toThrow(
      'Failed to fetch board: 404',
    );
  });
});