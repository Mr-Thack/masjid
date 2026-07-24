import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/svelte';

vi.mock('$lib/auth.svelte', () => ({
  auth: {
    admin: null,
    token: null,
    loading: false,
    get isAuthenticated() { return false; },
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn().mockResolvedValue(false),
  },
}));

import LoginPage from '../../routes/login/+page.svelte';

describe('Login page', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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
});
