import { describe, it, expect, vi } from 'vitest';
import { load } from '../routes/display/[masjid_slug]/+page';

describe('load', () => {
  it('calls the board endpoint and returns the payload', async () => {
    const payload = {
      masjid: { slug: 'test', name: 'Test', city: null, external_donation_url: null },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as Parameters<typeof load>[0]);

    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/masjids/test/board');
  });
});