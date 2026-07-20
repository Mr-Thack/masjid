import { describe, it, expect, vi } from 'vitest';
import { load } from '../routes/display/[masjid_slug]/+page';

describe('load', () => {
  it('returns the payload from fetchPagePayload', async () => {
    const payload = {
      masjid: { slug: 'test', name: 'Test', city: null, external_donation_url: null },
      theme: { primary_color: '#111', accent_color: '#222', font_heading: 'Inter', font_body: 'Inter', layout_preset: 'modern' },
      prayer_times: {
        fajr: { adhaan: '05:00', iqaamah: '05:15' },
        sunrise: '06:00',
        dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
        asr: { adhaan: '15:00', iqaamah: '15:15' },
        maghrib: { adhaan: '18:00', iqaamah: '18:05' },
        isha: { adhaan: '19:00', iqaamah: '19:15' },
      },
      jumuah: [],
      pinned_announcement: null,
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
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/masjids/test');
  });
});