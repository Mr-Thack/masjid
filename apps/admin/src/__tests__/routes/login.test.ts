import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/svelte';

const { mockGoto, mockAuth } = vi.hoisted(() => {
  const auth = {
    admin: null as Record<string, unknown> | null,
    token: null as string | null,
    loading: false,
    get isAuthenticated() { return !!(this.admin && this.token); },
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn().mockResolvedValue(false),
  };
  return {
    mockGoto: vi.fn(() => Promise.resolve()),
    mockAuth: auth,
  };
});

vi.mock('$lib/auth.svelte', () => ({
  auth: mockAuth,
}));

vi.mock('$app/navigation', () => ({
  goto: mockGoto,
}));

import LoginPage from '../../routes/login/+page.svelte';

describe('Login page', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuth.admin = null;
    mockAuth.token = null;
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });

  it('renders login form with email, password, and submit button', () => {
    render(LoginPage);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('shows Masjid Admin heading', () => {
    render(LoginPage);
    expect(screen.getByText('Masjid Admin')).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    render(LoginPage);
    await fireEvent.click(screen.getByText('Sign In'));
    expect(await screen.findByText('Please enter your email and password.')).toBeInTheDocument();
  });

  it('does nothing when there is no stored token in localStorage', async () => {
    render(LoginPage);
    expect(screen.getByText('Masjid Admin')).toBeInTheDocument();
    expect(mockGoto).not.toHaveBeenCalled();
  });

  it('redirects to dashboard when valid token exists in localStorage', async () => {
    localStorage.setItem('admin_token', 'valid-token');
    localStorage.setItem('admin_user', JSON.stringify({ id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' }));

    const mockRes = {
      ok: true,
      json: () => Promise.resolve({ slug: 'masjid-al-noor', name: 'Masjid Al-Noor' }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockRes as Response);

    render(LoginPage);

    await vi.waitFor(() => {
      expect(mockGoto).toHaveBeenCalledWith('/admin/masjid-al-noor');
    });
    expect(mockAuth.admin).toEqual({ id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' });
    expect(mockAuth.token).toBe('valid-token');
  });

  it('clears localStorage and stays on page when stored token is invalid (401)', async () => {
    localStorage.setItem('admin_token', 'expired-token');
    localStorage.setItem('admin_user', JSON.stringify({ id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' }));

    const mockRes = { ok: false, status: 401 };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockRes as Response);

    render(LoginPage);

    await new Promise(r => setTimeout(r, 100));
    expect(mockGoto).not.toHaveBeenCalled();
    expect(mockAuth.admin).toBeNull();
    expect(localStorage.getItem('admin_token')).toBeNull();
  });

  it('stays on page when fetch throws network error', async () => {
    localStorage.setItem('admin_token', 'some-token');
    localStorage.setItem('admin_user', JSON.stringify({ id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' }));

    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'));

    render(LoginPage);

    await new Promise(r => setTimeout(r, 100));
    expect(mockGoto).not.toHaveBeenCalled();
    expect(mockAuth.admin).toBeNull();
  });

  it('does NOT call checkAuth() from within the effect (prevents infinite loop)', () => {
    render(LoginPage);
    expect(mockAuth.checkAuth).not.toHaveBeenCalled();
  });
});