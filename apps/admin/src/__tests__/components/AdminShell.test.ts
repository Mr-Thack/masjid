import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/svelte';

vi.mock('$lib/auth.svelte', () => ({
  auth: {
    admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' },
    token: 'test-token',
    loading: false,
    get isAuthenticated() { return true; },
    logout: vi.fn(),
  },
}));

import AdminShell from '$lib/components/AdminShell.svelte';
import { goto } from '$app/navigation';

function createChildrenSnippet() {
  return (node: Element) => {
    const span = document.createElement('span');
    span.textContent = 'page content';
    span.setAttribute('data-testid', 'page-content');
    return {
      mount(target: Element) { target.appendChild(span); },
      update() {},
      destroy() { span.remove(); },
    };
  };
}

describe('AdminShell', () => {
  it('renders masjid name in sidebar', () => {
    render(AdminShell, {
      props: {
        masjidSlug: 'masjid-al-noor',
        masjidName: 'Masjid Al-Noor',
        children: createChildrenSnippet(),
      },
    });
    const headings = screen.getAllByText('Masjid Al-Noor');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders all main nav items', () => {
    render(AdminShell, {
      props: { masjidSlug: 'masjid-al-noor', children: createChildrenSnippet() },
    });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('has a logout button that calls auth.logout and goto', async () => {
    const { auth } = await import('$lib/auth.svelte');
    render(AdminShell, {
      props: { masjidSlug: 'masjid-al-noor', children: createChildrenSnippet() },
    });
    const signOutBtn = screen.getByText('Sign Out');
    await fireEvent.click(signOutBtn);
    expect(auth.logout).toHaveBeenCalled();
    expect(goto).toHaveBeenCalledWith('/login');
  });

  it('renders settings nav items', () => {
    render(AdminShell, {
      props: { masjidSlug: 'masjid-al-noor', children: createChildrenSnippet() },
    });
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Prayer Rules')).toBeInTheDocument();
    expect(screen.getByText("Jumu'ah")).toBeInTheDocument();
    expect(screen.getByText('Announcements')).toBeInTheDocument();
  });
});
