import { describe, it, expect, vi } from 'vitest';
import { load } from '../routes/[masjid_slug]/+layout';

describe('layout load with posts', () => {
  const basePayload = {
    masjid: {
      slug: 'test',
      name: 'Test Masjid',
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      contact_phone: null,
      contact_email: null,
      website_url: null,
      facebook_url: null,
      youtube_url: null,
      instagram_url: null,
    },
    theme: {
      primary_color: '#111',
      accent_color: '#222',
      font_heading: 'Inter',
      font_body: 'Inter',
      layout_preset: 'modern',
      time_format: '24h' as const,
      label_adhaan: 'Adhaan',
      label_iqaamah: 'Iqaamah',
      label_jumuah: "Jumu'ah",
      label_speech: 'Speech',
      label_sunrise: 'Sunrise',
      label_fajr: 'Fajr',
      label_dhuhr: 'Dhuhr',
      label_asr: 'Asr',
      label_maghrib: 'Maghrib',
      label_isha: 'Isha',
    },
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
    homepage_post: null,
    info_post: null,
  };

  it('returns homepage_post from payload', async () => {
    const homepagePost = {
      title: 'Ramadan Iftar',
      slug: 'ramadan-iftar',
      compiled_html: '<p>Join us for iftar every Saturday.</p>',
      created_at: '2026-03-01T10:00:00Z',
    };

    const payload = {
      ...basePayload,
      homepage_post: homepagePost,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as any);

    expect(result.homepage_post).toEqual(homepagePost);
    expect(result.homepage_post!.title).toBe('Ramadan Iftar');
    expect(result.homepage_post!.slug).toBe('ramadan-iftar');
  });

  it('returns info_post from payload', async () => {
    const infoPost = {
      title: 'Masjid History',
      slug: 'masjid-history',
      compiled_html: '<p>Founded in 1995.</p>',
      created_at: '2026-01-01T00:00:00Z',
    };

    const payload = {
      ...basePayload,
      info_post: infoPost,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as any);

    expect(result.info_post).toEqual(infoPost);
    expect(result.info_post!.title).toBe('Masjid History');
    expect(result.info_post!.compiled_html).toBe('<p>Founded in 1995.</p>');
  });

  it('returns null for homepage_post when payload has null', async () => {
    const payload = {
      ...basePayload,
      homepage_post: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as any);

    expect(result.homepage_post).toBeNull();
  });

  it('returns null for info_post when payload has null', async () => {
    const payload = {
      ...basePayload,
      info_post: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as any);

    expect(result.info_post).toBeNull();
  });

  it('returns undefined for homepage_post when not in payload', async () => {
    const payload = { ...basePayload };
    delete (payload as any).homepage_post;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as any);

    expect(result.homepage_post).toBeUndefined();
  });

  it('returns undefined for info_post when not in payload', async () => {
    const payload = { ...basePayload };
    delete (payload as any).info_post;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as any);

    expect(result.info_post).toBeUndefined();
  });

  it('returns both homepage_post and info_post simultaneously', async () => {
    const homepagePost = {
      title: 'Eid Mubarak',
      slug: 'eid-mubarak',
      compiled_html: '<p>Eid prayer at 8 AM.</p>',
      created_at: '2026-04-10T00:00:00Z',
    };
    const infoPost = {
      title: 'Contact Us',
      slug: 'contact',
      compiled_html: '<p>Reach us at info@masjid.org.</p>',
      created_at: '2026-01-01T00:00:00Z',
    };

    const payload = {
      ...basePayload,
      homepage_post: homepagePost,
      info_post: infoPost,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await load({
      params: { masjid_slug: 'test' },
      fetch: mockFetch,
    } as any);

    expect(result.homepage_post).toEqual(homepagePost);
    expect(result.info_post).toEqual(infoPost);
  });
});