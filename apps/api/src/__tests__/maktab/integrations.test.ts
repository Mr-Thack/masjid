import { describe, it, expect, vi, afterEach } from 'vitest';
import { testSquareConnection, testBrevoConnection } from '../../lib/server/maktab/integrations';

function mockSquareResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status });
}

function mockLocationResponse(name: string) {
  return mockSquareResponse({ location: { id: 'L123', name } }, 200);
}

function mockCatalogResponse() {
  return mockSquareResponse({ objects: [] }, 200);
}

function unauthResponse(message?: string) {
  return mockSquareResponse({
    errors: [{ category: 'AUTHENTICATION_ERROR', code: 'UNAUTHORIZED', detail: message || 'This request could not be authorized.' }],
  }, 401);
}

function notFoundResponse(message?: string) {
  return mockSquareResponse({
    errors: [{ category: 'NOT_FOUND', code: 'NOT_FOUND', detail: message || 'Location not found.' }],
  }, 404);
}

function forbiddenResponse(where: string) {
  return mockSquareResponse({
    errors: [{ category: 'FORBIDDEN', code: 'FORBIDDEN', detail: `Missing permission to call ${where}.` }],
  }, 403);
}

describe('testSquareConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects missing token', async () => {
    const result = await testSquareConnection('', 'app123', 'L123');
    expect(result.ok).toBe(false);
  });

  it('reports successful connection', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockLocationResponse('My Store'))
      .mockResolvedValueOnce(mockCatalogResponse()),
    );

    const result = await testSquareConnection('EAAAl_prodtoken123', 'sq0idp-app', 'L123', 'production');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('My Store');
    expect(result.message).toContain('production');
    expect(result.environment).toBe('production');
  });

  it('includes environment label', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockLocationResponse('Store'))
      .mockResolvedValueOnce(mockCatalogResponse()),
    );

    const sandbox = await testSquareConnection('EAAAE_sandtoken', 'sandbox-sq0idb-app', 'L123', 'development');
    expect(sandbox.environment).toBe('sandbox');
  });

  it('hints when sandbox token is used against production env', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(unauthResponse())
      .mockResolvedValueOnce(mockCatalogResponse()),
    );

    const result = await testSquareConnection('EAAAE_sandtoken', 'sq0idp-prod-app', 'L123', 'production');
    expect(result.ok).toBe(false);
    expect(result.hints.some(h => h.includes('sandbox token'))).toBe(true);
    expect(result.hints.some(h => h.includes('sandbox'))).toBe(true);
    expect(result.environment).toBe('production');
  });

  it('hints when sandbox app ID is used against production env', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(unauthResponse())
      .mockResolvedValueOnce(mockCatalogResponse()),
    );

    const result = await testSquareConnection('EAAAl_prodtoken123', 'sandbox-sq0idb-app', 'L123', 'production');
    expect(result.ok).toBe(false);
    expect(result.hints.some(h => h.includes('sandbox app') || h.includes('sandbox app ID') || h.includes('Application ID looks like a sandbox'))).toBe(true);
  });

  it('reports AUTHENTICATION_ERROR with actionable hints', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(unauthResponse())
      .mockResolvedValueOnce(mockCatalogResponse()),
    );

    const result = await testSquareConnection('EAAAl_prodtoken', 'sq0idp-app', 'L123', 'production');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('UNAUTHORIZED');
    expect(result.hints.length).toBeGreaterThanOrEqual(2);
    expect(result.hints.some(h => h.includes('revoked') || h.includes('expired'))).toBe(true);
  });

  it('reports NOT_FOUND with location hints', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(notFoundResponse())
      .mockResolvedValueOnce(mockCatalogResponse()),
    );

    const result = await testSquareConnection('EAAAl_prodtoken', 'sq0idp-app', 'bad-loc', 'production');
    expect(result.ok).toBe(false);
    expect(result.hints.some(h => h.includes('location ID'))).toBe(true);
  });

  it('fails when catalog API is not authorized (scope missing)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockLocationResponse('My Store'))
      .mockResolvedValueOnce(forbiddenResponse('catalog/list')),
    );

    const result = await testSquareConnection('EAAAl_prodtoken', 'sq0idp-app', 'L123', 'production');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('catalog API');
    expect(result.hints.some(h => h.includes('permission'))).toBe(true);
  });

  it('returns hints for unexpected errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockSquareResponse({ errors: [{ category: 'RATE_LIMITED', code: 'TOO_MANY_REQUESTS', detail: 'Too many requests' }] }, 429))
      .mockResolvedValueOnce(mockCatalogResponse()),
    );

    const result = await testSquareConnection('EAAAl_prodtoken', 'sq0idp-app', 'L123', 'production');
    expect(result.ok).toBe(false);
    expect(result.hints.length).toBeGreaterThan(0);
  });

  it('includes category and code when detail is missing', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockSquareResponse({ errors: [{ category: 'AUTHENTICATION_ERROR', code: 'UNAUTHORIZED' }] }, 401))
      .mockResolvedValueOnce(mockCatalogResponse()),
    );

    const result = await testSquareConnection('EAAAl_prodtoken', 'sq0idp-app', 'L123', 'production');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('UNAUTHORIZED');
  });
});

describe('testBrevoConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports successful connection with sender email', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'admin@masjid.org', firstName: 'Admin', lastName: 'User' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: 'abc123' }), { status: 201 })),
    );

    const result = await testBrevoConnection('xkeysib-test', 'sender@masjid.org', 'Masjid');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('admin@masjid.org');
    expect(result.message).toContain('sender@masjid.org');
  });

  it('includes hints on API key rejection', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 })),
    );

    const result = await testBrevoConnection('bad-key', 'sender@masjid.org', '');
    expect(result.ok).toBe(false);
    expect(result.hints.length).toBeGreaterThan(0);
    expect(result.hints[0]).toContain('revoked');
  });

  it('reports partial success when test email fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'admin@masjid.org' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not allowed' }), { status: 403 })),
    );

    const result = await testBrevoConnection('xkeysib-test', 'bad@masjid.org', '');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('verified');
    expect(result.hints.length).toBe(1);
  });
});