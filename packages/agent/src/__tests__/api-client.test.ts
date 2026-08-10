import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiClientConfig } from '../types';
import { getMasjidProfile, updateMasjidProfile } from '../api-client';

const baseConfig: ApiClientConfig = {
  apiUrl: 'https://mapi.example.dev',
  jwtSecret: 'test-secret',
  adminId: 'admin-1',
  masjidId: 'masjid-1',
};

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

describe('api-client — fetcher injection', () => {
  it('uses the injected fetcher instead of global fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'masjid-1' }), { status: 200 }),
    );

    await getMasjidProfile({ ...baseConfig, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://mapi.example.dev/api/v1/admin/masjids/masjid-1');
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
  });

  it('falls back to global fetch when no fetcher is provided', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 'masjid-1' }), { status: 200 }));

    await getMasjidProfile(baseConfig);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('api-client — response checking', () => {
  it('parses a 200 JSON body', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ name: 'Masjid' }), { status: 200 }));

    const result = await getMasjidProfile(baseConfig);

    expect(result).toEqual({ name: 'Masjid' });
  });

  it('returns {} for an empty 204 body', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await updateMasjidProfile({ name: 'x' }, baseConfig);

    expect(result).toEqual({});
  });

  it('throws a descriptive error (not SyntaxError) for a non-JSON 200 body — the CF 1042 case', async () => {
    // Cloudflare blocks same-zone Worker→Worker subrequests with this plain-text body.
    mockFetch.mockResolvedValue(new Response('error code: 1042', { status: 200 }));

    const err = await getMasjidProfile(baseConfig).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).not.toBe('SyntaxError');
    expect((err as Error).message).toContain('non-JSON');
    expect((err as Error).message).toContain('GET /api/v1/admin/masjids/masjid-1');
    expect((err as Error).message).toContain('error code: 1042');
  });

  it('throws a descriptive error for a non-ok status', async () => {
    mockFetch.mockResolvedValue(new Response('error code: 1042', { status: 500 }));

    const err = await getMasjidProfile(baseConfig).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('HTTP 500');
    expect((err as Error).message).toContain('error code: 1042');
  });

  it('includes the body snippet but not the whole body in error messages', async () => {
    const hugeBody = `error ${'x'.repeat(1000)}`;
    mockFetch.mockResolvedValue(new Response(hugeBody, { status: 502 }));

    const err = await getMasjidProfile(baseConfig).catch((e: unknown) => e);

    expect((err as Error).message).toContain('HTTP 502');
    expect((err as Error).message.length).toBeLessThan(hugeBody.length);
  });
});
