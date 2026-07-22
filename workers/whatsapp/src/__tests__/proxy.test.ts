import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../types';

const testEnv: Env = {
  DB: {} as D1Database,
  ASSETS: {} as R2Bucket,
  API_URL: 'http://localhost:5173',
  JWT_SECRET: 'test-secret',
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_PHONE_ID: 'test-phone-id',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
};

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

describe('apiCall', () => {
  it('includes Authorization Bearer header', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { apiCall } = await import('../proxy');
    await apiCall('GET', '/test', null, testEnv, 'admin-1', 'masjid-1');

    const headers = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer /);
  });

  it('includes Content-Type for POST with body', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { apiCall } = await import('../proxy');
    await apiCall('POST', '/test', { key: 'value' }, testEnv, 'admin-1', 'masjid-1');

    const headers = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('omits Content-Type for GET with null body', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { apiCall } = await import('../proxy');
    await apiCall('GET', '/test', null, testEnv, 'admin-1', 'masjid-1');

    const headers = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('constructs correct URL from env.API_URL + path', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { apiCall } = await import('../proxy');
    await apiCall('GET', '/api/v1/test', null, testEnv, 'admin-1', 'masjid-1');

    const url = mockFetch.mock.calls[0]?.[0];
    expect(url).toBe('http://localhost:5173/api/v1/test');
  });

  it('passes correct method', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { apiCall } = await import('../proxy');
    await apiCall('DELETE', '/test', null, testEnv, 'admin-1', 'masjid-1');

    const method = mockFetch.mock.calls[0]?.[1]?.method;
    expect(method).toBe('DELETE');
  });
});

describe('proxy function URLs', () => {
  function assertURL(path: string) {
    return () => {
      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain(path);
    };
  }

  it('getMasjidProfile calls GET /api/v1/admin/masjids/{id}', async () => {
    mockFetch.mockResolvedValue(new Response('{"theme":{}}', { status: 200 }));
    const { getMasjidProfile } = await import('../proxy');
    await getMasjidProfile(testEnv, 'admin-1', 'masjid-1');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toBe('http://localhost:5173/api/v1/admin/masjids/masjid-1');
  });

  it('getPrayerConfig calls GET /api/v1/admin/masjids/{id}/prayer', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { getPrayerConfig } = await import('../proxy');
    await getPrayerConfig(testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/masjid-1/prayer');
  });

  it('updateMasjidProfile calls PUT /api/v1/admin/masjids/{id}', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { updateMasjidProfile } = await import('../proxy');
    await updateMasjidProfile({ name: 'test' }, testEnv, 'admin-1', 'masjid-1');
    const method = mockFetch.mock.calls[0]?.[1]?.method;
    expect(method).toBe('PUT');
  });

  it('updatePrayerConfig calls PATCH', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { updatePrayerConfig } = await import('../proxy');
    await updatePrayerConfig({ calculation_method: 2 }, testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('PATCH');
  });

  it('getPrayerRulesList calls correct URL', async () => {
    mockFetch.mockResolvedValue(new Response('[]', { status: 200 }));
    const { getPrayerRulesList } = await import('../proxy');
    await getPrayerRulesList(testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/prayer/rules');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('createPrayerRule calls POST', async () => {
    mockFetch.mockResolvedValue(new Response('{"id":"rule-1"}', { status: 201 }));
    const { createPrayerRule } = await import('../proxy');
    await createPrayerRule({ prayer_name: 'dhuhr' }, testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('updatePrayerRule calls PUT with ruleId in URL', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { updatePrayerRule } = await import('../proxy');
    await updatePrayerRule('rule-1', { prayer_name: 'dhuhr' }, testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/rules/rule-1');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('PUT');
  });

  it('deletePrayerRule calls DELETE', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { deletePrayerRule } = await import('../proxy');
    await deletePrayerRule('rule-1', testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });

  it('reorderPrayerRules calls PUT with { order } body', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { reorderPrayerRules } = await import('../proxy');
    await reorderPrayerRules(['r1', 'r2'], testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/reorder');
    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.order).toEqual(['r1', 'r2']);
  });

  it('getJumuahSessions calls correct URL', async () => {
    mockFetch.mockResolvedValue(new Response('[]', { status: 200 }));
    const { getJumuahSessions } = await import('../proxy');
    await getJumuahSessions(testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/jumuah');
  });

  it('createJumuahSession calls POST', async () => {
    mockFetch.mockResolvedValue(new Response('{"id":"s1"}', { status: 201 }));
    const { createJumuahSession } = await import('../proxy');
    await createJumuahSession({ label: 'Test', time: '13:00' }, testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('updateJumuahSession calls PUT with sessionId', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { updateJumuahSession } = await import('../proxy');
    await updateJumuahSession('s1', { time: '14:00' }, testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/jumuah/s1');
  });

  it('deleteJumuahSession calls DELETE', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { deleteJumuahSession } = await import('../proxy');
    await deleteJumuahSession('s1', testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });

  it('getAnnouncements calls correct URL', async () => {
    mockFetch.mockResolvedValue(new Response('[]', { status: 200 }));
    const { getAnnouncements } = await import('../proxy');
    await getAnnouncements(testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/announcements');
  });

  it('createAnnouncement calls POST', async () => {
    mockFetch.mockResolvedValue(new Response('{"slug":"eid"}', { status: 201 }));
    const { createAnnouncement } = await import('../proxy');
    await createAnnouncement({ title: 'Test', content_markdown: '# hi' }, testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('updateAnnouncement calls PUT with slug', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { updateAnnouncement } = await import('../proxy');
    await updateAnnouncement('eid', { title: 'Updated' }, testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/announcements/eid');
  });

  it('pinAnnouncement calls PUT with empty body', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { pinAnnouncement } = await import('../proxy');
    await pinAnnouncement('eid', testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/pin');
    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body).toEqual({});
  });

  it('dryRunPrayerTimes calls POST with body', async () => {
    mockFetch.mockResolvedValue(new Response('{"fajr":{"adhaan":"05:00","iqaamah":"05:30"}}', { status: 200 }));
    const { dryRunPrayerTimes } = await import('../proxy');
    const result = await dryRunPrayerTimes({ date: '2026-07-21' }, testEnv, 'admin-1', 'masjid-1');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/prayer/dry-run');
    expect(result).toHaveProperty('fajr');
  });

  it('dryRunPrayerTimes passes Content-Type header', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { dryRunPrayerTimes } = await import('../proxy');
    await dryRunPrayerTimes({ date: '2026-07-21', rule_overrides: [] }, testEnv, 'admin-1', 'masjid-1');
    const headers = mockFetch.mock.calls[0]?.[1]?.headers;
    expect(headers['Content-Type']).toBe('application/json');
  });
});