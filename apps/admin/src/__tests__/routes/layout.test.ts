import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';

const { mockGoto, mockAdmin, mockGetProfile } = vi.hoisted(() => ({
  mockGoto: vi.fn(() => Promise.resolve()),
  mockAdmin: {
    admin: null as Record<string, unknown> | null,
    token: null as string | null,
    loading: false,
    get isAuthenticated() { return !!(this.admin && this.token); },
    logout: vi.fn(),
    checkAuth: vi.fn(),
  },
  mockGetProfile: vi.fn(),
}));

vi.mock('$lib/auth.svelte', () => ({
  auth: mockAdmin,
}));

vi.mock('$lib/api', () => ({
  api: { getProfile: (...args: unknown[]) => mockGetProfile(...args) },
}));

vi.mock('$app/navigation', () => ({
  goto: mockGoto,
}));

import AdminLayout from '../../routes/admin/[slug]/+layout.svelte';

describe('Admin layout', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAdmin.admin = null;
    mockAdmin.token = null;
    mockAdmin.loading = false;
    mockAdmin.checkAuth = vi.fn();
    mockGetProfile.mockReset();
    localStorage.clear();
  });

  it('calls checkAuth when not authenticated, redirects on failure', async () => {
    mockAdmin.checkAuth.mockResolvedValueOnce(false);

    render(AdminLayout, { props: { data: { masjidSlug: 'masjid-al-noor' }, children: () => 'child' } });

    await vi.waitFor(() => {
      expect(mockAdmin.checkAuth).toHaveBeenCalledOnce();
    });

    await vi.waitFor(() => {
      expect(mockGoto).toHaveBeenCalledWith('/login');
    });
  });

  it('skips checkAuth when already authenticated, loads profile directly', async () => {
    mockAdmin.admin = { id: 'a1', email: 'a@b.org', display_name: 'Admin', masjid_id: 'm1' };
    mockAdmin.token = 'valid-token';
    mockGetProfile.mockResolvedValueOnce({ name: 'Masjid Al-Noor', slug: 'masjid-al-noor' });

    render(AdminLayout, { props: { data: { masjidSlug: 'masjid-al-noor' }, children: () => 'child' } });

    expect(mockAdmin.checkAuth).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledWith('m1');
    });
  });

  it('protects against effect re-entry via initDone guard (checkAuth not called twice)', async () => {
    // Start not authenticated — checkAuth will be called in the effect
    mockAdmin.checkAuth.mockResolvedValueOnce(true);
    mockGetProfile.mockResolvedValueOnce({ name: 'Masjid Al-Noor', slug: 'masjid-al-noor' });

    render(AdminLayout, { props: { data: { masjidSlug: 'masjid-al-noor' }, children: () => 'child' } });

    await vi.waitFor(() => {
      expect(mockAdmin.checkAuth).toHaveBeenCalledOnce();
    });

    // Simulate what checkAuth does internally: set admin + token on success
    mockAdmin.admin = { id: 'a1', email: 'a@b.org', display_name: 'Admin', masjid_id: 'm1' };
    mockAdmin.token = 'valid-token';

    // After initDone guard kicks in, checkAuth should NOT be called again
    // even if auth state subsequently changes
    await new Promise(r => setTimeout(r, 100));
    expect(mockAdmin.checkAuth).toHaveBeenCalledTimes(1);
  });

  it('loads profile when already authenticated without calling checkAuth', async () => {
    mockAdmin.admin = { id: 'a1', email: 'a@b.org', display_name: 'Admin', masjid_id: 'm1' };
    mockAdmin.token = 'valid-token';
    mockGetProfile.mockResolvedValueOnce({ name: 'Masjid Al-Noor', slug: 'masjid-al-noor' });

    render(AdminLayout, { props: { data: { masjidSlug: 'masjid-al-noor' }, children: () => 'child' } });

    // Should NOT call checkAuth since already authenticated
    expect(mockAdmin.checkAuth).not.toHaveBeenCalled();

    // loadProfile should be invoked with the masjid_id
    await vi.waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledWith('m1');
    });
  });

  it('redirects to correct URL when URL slug does not match admin masjid slug', async () => {
    mockAdmin.admin = { id: 'a1', email: 'a@b.org', display_name: 'Admin', masjid_id: 'm1' };
    mockAdmin.token = 'valid-token';
    // Admin's profile slug is 'masjid-al-noor' but URL says 'masjid-al-jabal'
    mockGetProfile.mockResolvedValueOnce({ name: 'Masjid Al-Noor', slug: 'masjid-al-noor' });

    render(AdminLayout, { props: { data: { masjidSlug: 'masjid-al-jabal' }, children: () => 'child' } });

    // Should redirect to the correct masjid URL
    await vi.waitFor(() => {
      expect(mockGoto).toHaveBeenCalledWith('/admin/masjid-al-noor');
    });
  });

  it('does not redirect when URL slug matches admin masjid slug', async () => {
    mockAdmin.admin = { id: 'a1', email: 'a@b.org', display_name: 'Admin', masjid_id: 'm1' };
    mockAdmin.token = 'valid-token';
    mockGetProfile.mockResolvedValueOnce({ name: 'Masjid Al-Noor', slug: 'masjid-al-noor' });

    render(AdminLayout, { props: { data: { masjidSlug: 'masjid-al-noor' }, children: () => 'child' } });

    await vi.waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledWith('m1');
    });

    // No redirect — slug matches
    expect(mockGoto).not.toHaveBeenCalled();
  });
});