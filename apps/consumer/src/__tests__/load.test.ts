import { describe, it, expect, vi } from 'vitest';
import { load } from '../routes/[masjid_slug]/+layout';

describe('load', () => {
  it('destructures page payload into named keys', async () => {
    const payload = {
      masjid: { slug: 'test', name: 'Test', address_line1: null, city: null, state: null, country: null, external_donation_url: null, contact_phone: null, contact_email: null },
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
      recent_announcements: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as Parameters<typeof load>[0]);

    expect(result.masjid).toEqual(payload.masjid);
    expect(result.theme).toEqual(payload.theme);
    expect(result.prayer_times).toEqual(payload.prayer_times);
    expect(result.jumuah).toEqual(payload.jumuah);
    expect(result.pinned_announcement).toEqual(payload.pinned_announcement);
    expect(result.recent_announcements).toEqual(payload.recent_announcements);
  });

  it('passes the slug and fetch to fetchPagePayload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          masjid: { slug: 'test', name: 'Test', address_line1: null, city: null, state: null, country: null, external_donation_url: null, contact_phone: null, contact_email: null },
          theme: { primary_color: '#111', accent_color: '#222', font_heading: 'Inter', font_body: 'Inter', layout_preset: 'modern' },
          prayer_times: { fajr: { adhaan: '05:00', iqaamah: '05:15' }, sunrise: '06:00', dhuhr: { adhaan: '12:00', iqaamah: '12:15' }, asr: { adhaan: '15:00', iqaamah: '15:15' }, maghrib: { adhaan: '18:00', iqaamah: '18:05' }, isha: { adhaan: '19:00', iqaamah: '19:15' } },
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
        }),
    });

    await load({
      params: { masjid_slug: 'my-masjid' },
      fetch: mockFetch,
    } as Parameters<typeof load>[0]);

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/masjids/my-masjid');
  });

  it('throws a 404 SvelteKit error when the masjid is not found', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(
      load({
        params: { masjid_slug: 'nonexistent' },
        fetch: mockFetch,
      } as Parameters<typeof load>[0]),
    ).rejects.toHaveProperty('status', 404);
  });

  it('throws the original error for non-404 failures', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      load({
        params: { masjid_slug: 'test' },
        fetch: mockFetch,
      } as Parameters<typeof load>[0]),
    ).rejects.toThrow('Network error');
  });
});