import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('auth store', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('$lib/auth.svelte');
    mod.auth.logout();
  });

  it('is not authenticated by default', async () => {
    const mod = await import('$lib/auth.svelte');
    expect(mod.auth.isAuthenticated).toBe(false);
  });

  it('loading is true by default', async () => {
    const mod = await import('$lib/auth.svelte');
    expect(mod.auth.loading).toBe(true);
  });

  it('login() calls the correct API endpoint and stores token', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.logout();

    const mockRes = {
      ok: true,
      json: () => Promise.resolve({
        token: 'jwt123',
        admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' },
      }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockRes as Response);

    await auth.login('admin@test.org', 'password123');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.org', password: 'password123' }),
    });
    expect(auth.token).toBe('jwt123');
    expect(auth.admin?.email).toBe('admin@test.org');
    expect(auth.isAuthenticated).toBe(true);
  });

  it('login() throws on failed response', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.logout();

    const mockRes = {
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Invalid credentials' }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockRes as Response);

    await expect(auth.login('bad@test.org', 'wrong')).rejects.toThrow('Invalid credentials');
    expect(auth.isAuthenticated).toBe(false);
  });

  it('logout() clears state and localStorage', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.token = 'some-token';
    auth.admin = { id: 'a1', email: 'a@b.org', display_name: 'A', masjid_id: 'm1' };

    auth.logout();

    expect(auth.token).toBeNull();
    expect(auth.admin).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('checkAuth() returns true when valid token exists', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.logout();

    localStorage.setItem('admin_token', 'valid-jwt');
    localStorage.setItem('admin_user', JSON.stringify({ id: 'a1', email: 'a@b.org', display_name: 'A', masjid_id: 'm1' }));

    const mockRes = {
      ok: true,
      json: () => Promise.resolve({ id: 'm1' }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockRes as Response);

    const result = await auth.checkAuth();
    expect(result).toBe(true);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.loading).toBe(false);
  });

  it('checkAuth() returns false when no stored token', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.logout();

    const result = await auth.checkAuth();
    expect(result).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.loading).toBe(false);
  });

  it('checkAuth() clears state when API returns 401', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.logout();

    localStorage.setItem('admin_token', 'expired-jwt');
    localStorage.setItem('admin_user', JSON.stringify({ id: 'a1', email: 'a@b.org', display_name: 'A', masjid_id: 'm1' }));

    const mockRes = { ok: false, status: 401 };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockRes as Response);

    const result = await auth.checkAuth();
    expect(result).toBe(false);
    expect(auth.token).toBeNull();
    expect(auth.admin).toBeNull();
  });

  it('checkAuth() handles network errors gracefully', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.logout();

    localStorage.setItem('admin_token', 'some-token');
    localStorage.setItem('admin_user', JSON.stringify({ id: 'a1', email: 'a@b.org', display_name: 'A', masjid_id: 'm1' }));

    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await auth.checkAuth();
    expect(result).toBe(false);
    expect(auth.token).toBeNull();
    expect(auth.loading).toBe(false);
  });

  it('isAuthenticated reflects login state changes', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.logout();

    expect(auth.isAuthenticated).toBe(false);

    auth.token = 't';
    auth.admin = { id: 'a1', email: 'a@b.org', display_name: 'A', masjid_id: 'm1' };
    expect(auth.isAuthenticated).toBe(true);
  });

  it('login() stores credentials in localStorage', async () => {
    const mod = await import('$lib/auth.svelte');
    const auth = mod.auth;
    auth.logout();

    const mockRes = {
      ok: true,
      json: () => Promise.resolve({
        token: 'jwt456',
        admin: { id: 'a2', email: 'test@org.com', display_name: 'Test', masjid_id: 'm2' },
      }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockRes as Response);

    await auth.login('test@org.com', 'pass');

    expect(localStorage.setItem).toHaveBeenCalledWith('admin_token', 'jwt456');
    expect(localStorage.setItem).toHaveBeenCalledWith('admin_user', JSON.stringify({ id: 'a2', email: 'test@org.com', display_name: 'Test', masjid_id: 'm2' }));
  });
});
