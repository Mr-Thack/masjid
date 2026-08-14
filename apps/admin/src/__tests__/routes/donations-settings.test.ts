import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';

vi.mock('$lib/auth.svelte', () => ({
  auth: {
    admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' },
    token: 'test-token',
    loading: false,
    get isAuthenticated() { return true; },
    logout: vi.fn(),
  },
}));

const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn().mockResolvedValue({ success: true });

vi.mock('$lib/api', () => ({
  api: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

import DonationsPage from '../../routes/admin/[slug]/settings/donations/+page.svelte';

const slugData = { data: { masjidSlug: 'masjid-al-noor' } };

const baseProfile = {
  name: 'Test Masjid',
  donation_links: '[]',
  show_donate_qr: true,
  theme: {
    style_system: 'mishkaat',
    style_options: {},
    layout_preset: 'mishkaat',
    primary_color: '#1e3a8a',
    accent_color: '#10b981',
    font_heading: 'Inter',
    font_body: 'Inter',
    time_format: '24h',
  },
};

describe('Donations settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue(baseProfile);
  });

  it('renders the Donations heading', () => {
    render(DonationsPage, { props: slugData });
    expect(screen.getByText('Donations')).toBeInTheDocument();
  });

  it('shows the Save Changes button after loading', async () => {
    render(DonationsPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('renders the donation sections', async () => {
    render(DonationsPage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Donation Links')).toBeInTheDocument();
    });
    expect(screen.getByText('Show Share QR card on donate page')).toBeInTheDocument();
    expect(screen.getByText('Donate Appeal')).toBeInTheDocument();
    expect(screen.getByText('Why Give?')).toBeInTheDocument();
  });

  it('loads donation links from the profile', async () => {
    mockGetProfile.mockResolvedValue({
      ...baseProfile,
      donation_links: JSON.stringify([
        { label: 'PayPal', url: 'https://paypal.me/masjid' },
      ]),
    });

    render(DonationsPage, { props: slugData });

    await waitFor(() => {
      expect(screen.getByDisplayValue('PayPal')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('https://paypal.me/masjid')).toBeInTheDocument();
  });

  it('loads donateAppeal and donateReasons from style_options', async () => {
    mockGetProfile.mockResolvedValue({
      ...baseProfile,
      theme: {
        ...baseProfile.theme,
        style_options: {
          donateAppeal: 'Help us grow',
          donateReasons: [{ icon: '🕌', title: 'Upkeep', desc: 'Keep the lights on' }],
          photoUrl: '/uploads/default-hero.svg',
        },
      },
    });

    render(DonationsPage, { props: slugData });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Help us grow')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Upkeep')).toBeInTheDocument();
  });

  it('saves full style_options with the donation keys (preserves other keys)', async () => {
    mockGetProfile.mockResolvedValue({
      ...baseProfile,
      donation_links: JSON.stringify([{ label: 'PayPal', url: 'https://paypal.me/masjid' }]),
      theme: {
        ...baseProfile.theme,
        style_options: {
          photoUrl: '/uploads/default-hero.svg',
          hideHomeNav: true,
          donateAppeal: 'Every contribution makes a difference',
          donateReasons: [
            { icon: '🕌', title: 'Maintain the House of Allah', desc: 'Keep our masjid clean' },
          ],
        },
      },
    });

    render(DonationsPage, { props: slugData });

    const saveBtn = await screen.findByText('Save Changes');
    expect(saveBtn).toBeDisabled();

    const appealInput = screen.getByDisplayValue('Every contribution makes a difference');
    await fireEvent.input(appealInput, { target: { value: 'New appeal text' } });

    expect(saveBtn).not.toBeDisabled();
    await fireEvent.click(saveBtn);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;

    expect(body.donation_links).toBe(JSON.stringify([{ label: 'PayPal', url: 'https://paypal.me/masjid' }]));
    expect(body.show_donate_qr).toBe(true);
    const styleOptions = body.style_options as Record<string, unknown>;
    expect(styleOptions.donateAppeal).toBe('New appeal text');
    expect(styleOptions.photoUrl).toBe('/uploads/default-hero.svg');
    expect(styleOptions.hideHomeNav).toBe(true);
    expect(Array.isArray(styleOptions.donateReasons)).toBe(true);
  });

  it('toggles show_donate_qr off on save', async () => {
    render(DonationsPage, { props: slugData });

    const qrToggle = await screen.findByLabelText('Show Share QR card on donate page');
    await fireEvent.click(qrToggle);

    const saveBtn = screen.getByText('Save Changes');
    await fireEvent.click(saveBtn);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;
    expect(body.show_donate_qr).toBe(false);
  });

  it('adds a donation link and saves it', async () => {
    render(DonationsPage, { props: slugData });

    await screen.findByText('Save Changes');

    await fireEvent.click(screen.getByText('+ Add Link'));

    const urlInputs = screen.getAllByPlaceholderText('https://');
    const labelInputs = screen.getAllByPlaceholderText('Label');
    await fireEvent.input(labelInputs[0], { target: { value: 'Zelle' } });
    await fireEvent.input(urlInputs[0], { target: { value: 'https://zelle.example' } });

    await fireEvent.click(screen.getByText('Save Changes'));

    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;
    expect(body.donation_links).toBe(JSON.stringify([{ label: 'Zelle', url: 'https://zelle.example' }]));
  });

  it('adds a Why Give card and saves it', async () => {
    render(DonationsPage, { props: slugData });

    await screen.findByText('Save Changes');

    await fireEvent.click(screen.getByText('+ Add Reason'));

    const iconInputs = screen.getAllByPlaceholderText('🕌');
    const titleInputs = screen.getAllByPlaceholderText('Title');
    const descInputs = screen.getAllByPlaceholderText('Description');

    const lastIdx = iconInputs.length - 1;
    await fireEvent.input(iconInputs[lastIdx], { target: { value: '🌙' } });
    await fireEvent.input(titleInputs[lastIdx], { target: { value: 'Ramadan' } });
    await fireEvent.input(descInputs[lastIdx], { target: { value: 'Iftar programs' } });

    await fireEvent.click(screen.getByText('Save Changes'));

    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;
    const styleOptions = body.style_options as Record<string, unknown>;
    const reasons = styleOptions.donateReasons as Array<{ icon: string; title: string; desc: string }>;
    expect(reasons).toContainEqual({ icon: '🌙', title: 'Ramadan', desc: 'Iftar programs' });
  });

  it('filters incomplete donation links before saving', async () => {
    render(DonationsPage, { props: slugData });

    await screen.findByText('Save Changes');

    await fireEvent.click(screen.getByText('+ Add Link'));

    const urlInputs = screen.getAllByPlaceholderText('https://');
    await fireEvent.input(urlInputs[0], { target: { value: '' } });

    await fireEvent.click(screen.getByText('Save Changes'));

    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;
    expect(body.donation_links).toBe('[]');
  });
});
