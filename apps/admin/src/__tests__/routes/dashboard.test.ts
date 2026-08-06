import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';

vi.mock('$lib/auth.svelte', () => ({
  auth: {
    admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' },
    token: 'test-token',
    loading: false,
    get isAuthenticated() { return true; },
    logout: vi.fn(),
  },
}));

const mockGetProfile = vi.fn().mockResolvedValue({ name: 'Masjid Al-Noor', slug: 'masjid-al-noor' });
const mockGetAnnouncements = vi.fn().mockResolvedValue({ announcements: [{ id: 'a1', title: 'Test', status: 'published' }] });
const mockGetJumuah = vi.fn().mockResolvedValue({ sessions: [{ id: 'j1', label: 'English' }] });
const mockGetPrayerRules = vi.fn().mockResolvedValue({ rules: [{ id: 'r1' }, { id: 'r2' }] });
const mockGetDomains = vi.fn().mockResolvedValue({ domain: null });
const mockGetPrayerConfig = vi.fn().mockResolvedValue({ calculation_method: 2, timezone: 'America/Chicago' });
const mockGetBranches = vi.fn().mockResolvedValue({ branches: [] });
const mockGetPrayerHealth = vi.fn().mockResolvedValue({ healthy: true, failingDates: [] });

vi.mock('$lib/api', () => ({
  api: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    getAnnouncements: (...args: unknown[]) => mockGetAnnouncements(...args),
    getJumuah: (...args: unknown[]) => mockGetJumuah(...args),
    getPrayerRules: (...args: unknown[]) => mockGetPrayerRules(...args),
    getDomains: (...args: unknown[]) => mockGetDomains(...args),
    getPrayerConfig: (...args: unknown[]) => mockGetPrayerConfig(...args),
    getBranches: (...args: unknown[]) => mockGetBranches(...args),
    getPrayerHealth: (...args: unknown[]) => mockGetPrayerHealth(...args),
  },
}));

import DashboardPage from '../../routes/admin/[slug]/+page.svelte';

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows masjid name in heading after loading', async () => {
    render(DashboardPage, { props: { data: { masjidSlug: 'masjid-al-noor' } } });
    expect(await screen.findByText('Masjid Al-Noor')).toBeInTheDocument();
  });

  it('shows stat cards with counts', async () => {
    render(DashboardPage, { props: { data: { masjidSlug: 'masjid-al-noor' } } });
    // Wait for data to load and stats to render
    await screen.findByText('Masjid Al-Noor');
    expect(screen.getByText('Announcements')).toBeInTheDocument();
    expect(screen.getByText("Jumu'ah Sessions")).toBeInTheDocument();
    expect(screen.getByText('Prayer Rules')).toBeInTheDocument();
  });

  it('shows quick action buttons', async () => {
    render(DashboardPage, { props: { data: { masjidSlug: 'masjid-al-noor' } } });
    await screen.findByText('Masjid Al-Noor');
    expect(screen.getByText('New Announcement')).toBeInTheDocument();
    expect(screen.getByText('Chat with AI')).toBeInTheDocument();
  });
});
