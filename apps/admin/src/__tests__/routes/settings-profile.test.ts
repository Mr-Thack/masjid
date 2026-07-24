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
  name: 'Masjid Al-Noor',
  slug: 'masjid-al-noor',
  city: 'Chicago',
  state: 'IL',
  address_line1: '123 Main St',
  address_line2: '',
  contact_phone: '555-0123',
  contact_email: 'info@masjid.org',
  website_url: 'https://masjid.example.com',
  facebook_url: '',
  youtube_url: '',
  instagram_url: '',
  external_donation_url: '',
  postal_code: '60601',
  country: 'US',
  calculation_method: 2,
  timezone: 'America/Chicago',
  latitude: 41.8781,
  longitude: -87.6298,
});

vi.mock('$lib/api', () => ({
  api: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    updateProfile: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import ProfilePage from '../../routes/admin/[slug]/settings/profile/+page.svelte';

describe('Profile settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Profile heading', async () => {
    render(ProfilePage, { props: { data: { masjidSlug: 'masjid-al-noor' } } });
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('renders form fields after loading', async () => {
    render(ProfilePage, { props: { data: { masjidSlug: 'masjid-al-noor' } } });
    await waitFor(() => {
      expect(screen.getByLabelText('Masjid Name *')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact Phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Calculation Method')).toBeInTheDocument();
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument();
  });

  it('shows Save Changes button after loading', async () => {
    render(ProfilePage, { props: { data: { masjidSlug: 'masjid-al-noor' } } });
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });
});
