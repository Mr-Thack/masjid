import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';

vi.mock('$lib/auth.svelte', () => ({
  auth: {
    admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' },
    token: 'test-token',
    loading: false,
    get isAuthenticated() { return true; },
    logout: vi.fn(),
  },
}));

const mockGetProfile = vi.fn().mockResolvedValue({
  name: 'Test Masjid',
  layout_preset: 'glass-dark',
  primary_color: '#1e3a8a',
  accent_color: '#10b981',
  font_heading: 'Inter',
  font_body: 'Inter',
  time_format: '24h',
  label_adhaan: '',
  label_iqaamah: '',
  label_jumuah: '',
  label_sunrise: '',
  label_fajr: '',
  label_dhuhr: '',
  label_asr: '',
  label_maghrib: '',
  label_isha: '',
});

vi.mock('$lib/api', () => ({
  api: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    updateProfile: vi.fn().mockResolvedValue({ success: true }),
    getPrayerRules: vi.fn().mockResolvedValue({ rules: [] }),
    createPrayerRule: vi.fn().mockResolvedValue({ id: 'r1' }),
    deletePrayerRule: vi.fn().mockResolvedValue({ success: true }),
    getJumuah: vi.fn().mockResolvedValue({ sessions: [] }),
    createJumuah: vi.fn().mockResolvedValue({ id: 'j1' }),
    deleteJumuah: vi.fn().mockResolvedValue({ success: true }),
    getAnnouncements: vi.fn().mockResolvedValue({ announcements: [] }),
    createAnnouncement: vi.fn().mockResolvedValue({ id: 'a1' }),
    deleteAnnouncement: vi.fn().mockResolvedValue({ success: true }),
    getDomains: vi.fn().mockResolvedValue({ domain: null }),
    createDomain: vi.fn().mockResolvedValue({ domain: { domain: 'test.com' } }),
    deleteDomain: vi.fn().mockResolvedValue({ success: true }),
    changePassword: vi.fn().mockResolvedValue({ success: true }),
    rollback: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import ThemePage from '../../routes/admin/[slug]/settings/theme/+page.svelte';
import PrayerPage from '../../routes/admin/[slug]/settings/prayer/+page.svelte';
import JumuahPage from '../../routes/admin/[slug]/settings/jumuah/+page.svelte';
import AnnouncementsPage from '../../routes/admin/[slug]/settings/announcements/+page.svelte';
import DomainPage from '../../routes/admin/[slug]/settings/domain/+page.svelte';
import SnapshotsPage from '../../routes/admin/[slug]/settings/snapshots/+page.svelte';
import AccountPage from '../../routes/admin/[slug]/settings/account/+page.svelte';

const slugData = { data: { masjidSlug: 'masjid-al-noor' } };

describe('Theme settings page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Theme heading', () => {
    render(ThemePage, { props: slugData });
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });

  it('shows preset cards after loading', async () => {
    render(ThemePage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Glass Dark')).toBeInTheDocument();
    });
    expect(screen.getByText('Minimal Light')).toBeInTheDocument();
  });

  it('renders Save Changes button after loading', async () => {
    render(ThemePage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });
});

describe('Prayer rules settings page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Prayer Rules heading', () => {
    render(PrayerPage, { props: slugData });
    expect(screen.getByText('Prayer Rules')).toBeInTheDocument();
  });

  it('shows empty state when no rules', async () => {
    render(PrayerPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText(/Define iqaamah adjustment rules/)).toBeInTheDocument();
    });
  });

  it('has Add Rule button', async () => {
    render(PrayerPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Add Rule')).toBeInTheDocument();
    });
  });
});

describe('Jumuah settings page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Jumuah heading', () => {
    render(JumuahPage, { props: slugData });
    expect(screen.getByText("Jumu'ah Sessions")).toBeInTheDocument();
  });

  it('shows empty state when no sessions', async () => {
    render(JumuahPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText("No Jumu'ah sessions defined.")).toBeInTheDocument();
    });
  });

  it('has Add Session button', async () => {
    render(JumuahPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Add Session')).toBeInTheDocument();
    });
  });
});

describe('Announcements settings page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Announcements heading', () => {
    render(AnnouncementsPage, { props: slugData });
    expect(screen.getByText('Announcements')).toBeInTheDocument();
  });

  it('shows filter tabs', async () => {
    render(AnnouncementsPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
    });
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('shows New button', async () => {
    render(AnnouncementsPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });
});

describe('Domain settings page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Domain heading', () => {
    render(DomainPage, { props: slugData });
    expect(screen.getByText('Domain')).toBeInTheDocument();
  });

  it('shows no domain message when none configured', async () => {
    render(DomainPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('No custom domain configured')).toBeInTheDocument();
    });
  });

  it('has Add Domain button', async () => {
    render(DomainPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Add Domain')).toBeInTheDocument();
    });
  });
});

describe('Snapshots settings page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Snapshots heading', () => {
    render(SnapshotsPage, { props: slugData });
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
  });

  it('shows description text', () => {
    render(SnapshotsPage, { props: slugData });
    expect(screen.getByText(/Restore your masjid configuration/)).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    render(SnapshotsPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('No snapshots available yet')).toBeInTheDocument();
    });
  });
});

describe('Account settings page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Account heading', () => {
    render(AccountPage, { props: slugData });
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('renders password fields', () => {
    render(AccountPage, { props: slugData });
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
  });

  it('renders Change Password button', () => {
    render(AccountPage, { props: slugData });
    expect(screen.getByText('Change Password')).toBeInTheDocument();
  });
});
