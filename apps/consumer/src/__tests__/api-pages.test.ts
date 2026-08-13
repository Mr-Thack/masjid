import { describe, it, expect, vi } from 'vitest';
import { fetchCustomPage } from '$lib/api';

function mockFetch(data: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('fetchCustomPage', () => {
  it('calls the correct URL with page slug (via BASE, so VITE_API_URL applies in deployed builds)', async () => {
    const fake = mockFetch({
      title: 'About Us',
      compiled_html: '<p>Welcome.</p>',
      last_updated: '2026-08-01T10:00:00Z',
    });
    await fetchCustomPage('test-masjid', 'about-us', fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test-masjid/pages/about-us');
  });

  it('returns page data', async () => {
    const pagePayload = {
      title: 'About Us',
      compiled_html: '<p>Welcome to our masjid.</p>',
      last_updated: '2026-08-01T10:00:00Z',
    };
    const fake = mockFetch(pagePayload);
    const result = await fetchCustomPage('test-masjid', 'about-us', fake);

    expect(result).toEqual(pagePayload);
    expect(result.title).toBe('About Us');
    expect(result.compiled_html).toBe('<p>Welcome to our masjid.</p>');
  });

  it('throws on 404', async () => {
    const fake = mockFetch({}, false, 404);
    await expect(
      fetchCustomPage('test-masjid', 'no-such-page', fake),
    ).rejects.toThrow('Failed to fetch page: 404');
  });

  it('throws on server error', async () => {
    const fake = mockFetch({}, false, 500);
    await expect(
      fetchCustomPage('test-masjid', 'broken', fake),
    ).rejects.toThrow('Failed to fetch page: 500');
  });
});
