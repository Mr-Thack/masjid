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

const mockGetProfile = vi.fn().mockResolvedValue({
  name: 'Test Masjid',
  theme: {
    style_system: 'sakeenah',
    style_options: {},
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
  },
});

const mockUpdateProfile = vi.fn().mockResolvedValue({ success: true });
const mockCreateJumuah = vi.fn().mockResolvedValue({ id: 'j1' });
const mockUpdateJumuah = vi.fn().mockResolvedValue({ success: true });
const mockCreateAnnouncement = vi.fn().mockResolvedValue({ id: 'a1' });
const mockUpdateAnnouncement = vi.fn().mockResolvedValue({ success: true });

vi.mock('$lib/api', () => ({
  api: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    getPrayerRules: vi.fn().mockResolvedValue({ rules: [] }),
    createPrayerRule: vi.fn().mockResolvedValue({ id: 'r1' }),
    deletePrayerRule: vi.fn().mockResolvedValue({ success: true }),
    getJumuah: vi.fn().mockResolvedValue({ sessions: [] }),
    createJumuah: (...args: unknown[]) => mockCreateJumuah(...args),
    updateJumuah: (...args: unknown[]) => mockUpdateJumuah(...args),
    deleteJumuah: vi.fn().mockResolvedValue({ success: true }),
    getAnnouncements: vi.fn().mockResolvedValue({ announcements: [] }),
    createAnnouncement: (...args: unknown[]) => mockCreateAnnouncement(...args),
    updateAnnouncement: (...args: unknown[]) => mockUpdateAnnouncement(...args),
    deleteAnnouncement: vi.fn().mockResolvedValue({ success: true }),
    pinAnnouncement: vi.fn().mockResolvedValue({ success: true }),
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
import ProfilePage from '../../routes/admin/[slug]/settings/profile/+page.svelte';

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

// ---------------------------------------------------------------------------
// Regression: Theme save payload includes all theme fields
// ---------------------------------------------------------------------------
describe('Theme page — save payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'sakeenah',
        style_options: {},
        layout_preset: 'glass-dark',
        primary_color: '#1e3a8a',
        accent_color: '#10b981',
        font_heading: 'Inter',
        font_body: 'Inter',
        time_format: '24h',
        label_adhaan: 'Adhaan',
        label_iqaamah: 'Iqaamah',
        label_jumuah: "Jumu'ah",
        label_speech: 'Speech',
        label_sunrise: 'Sunrise',
        label_fajr: 'Fajr',
        label_dhuhr: 'Dhuhr',
        label_asr: 'Asr',
        label_maghrib: 'Maghrib',
        label_isha: 'Isha',
      },
    });
  });

  it('calls updateProfile with theme fields on save', async () => {
    render(ThemePage, { props: slugData });

    const saveBtn = await screen.findByText('Save Changes');
    expect(saveBtn).toBeDisabled();

    const primaryInput = (await screen.findAllByPlaceholderText('#1e3a8a'))[0];
    await fireEvent.input(primaryInput, { target: { value: '#ff0000' } });

    expect(saveBtn).not.toBeDisabled();

    await fireEvent.click(saveBtn);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);

    const callArgs = mockUpdateProfile.mock.calls[0] as [string, Record<string, unknown>];
    const body = callArgs[1];
    expect(body.layout_preset).toBe('glass-dark');
    expect(body.primary_color).toBe('#ff0000');
    expect(body.label_adhaan).toBeDefined();
    expect(body.label_isha).toBeDefined();
  });

  it('sends empty string labels to server (not null/undefined)', async () => {
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'sakeenah',
        style_options: {},
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
        label_speech: '',
      },
    });

    render(ThemePage, { props: slugData });

    const saveBtn = await screen.findByText('Save Changes');
    // Click the accent input to make the form dirty
    const accentInput = (await screen.findAllByPlaceholderText('#10b981'))[0];
    await fireEvent.input(accentInput, { target: { value: '#999999' } });

    await fireEvent.click(saveBtn);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;

    // Empty string labels should be present in the payload (server accepts them)
    expect(body.label_adhaan).toBe('');
    expect(body.label_dhuhr).toBe('');
  });

  it('saves style_system and style_options in payload', async () => {
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'mishkaat',
        style_options: { metal: 'gold', arch: true },
        layout_preset: 'mishkaat',
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
        label_speech: '',
      },
    });

    render(ThemePage, { props: slugData });

    const saveBtn = await screen.findByText('Save Changes');
    // Change accent to make form dirty
    const accentInput = (await screen.findAllByPlaceholderText('#10b981'))[0];
    await fireEvent.input(accentInput, { target: { value: '#999999' } });

    await fireEvent.click(saveBtn);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;
    expect(body.style_system).toBe('mishkaat');
    expect(body.style_options.metal).toBe('gold');
    expect(body.style_options.arch).toBe(true);
    expect(body.layout_preset).toBe('mishkaat');
  });
});

// ---------------------------------------------------------------------------
// Style System and Screen Appearance
// ---------------------------------------------------------------------------
describe('Theme page — style system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'sakeenah',
        style_options: {},
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
        label_speech: '',
      },
    });
  });

  it('shows Style section with Mishkaat and Sakeenah cards', async () => {
    render(ThemePage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Style')).toBeInTheDocument();
    });
    expect(screen.getByText('Mishkaat')).toBeInTheDocument();
    expect(screen.getByText('Sakeenah')).toBeInTheDocument();
  });

  it('shows Layout Preset section when Sakeenah is selected', async () => {
    render(ThemePage, { props: slugData });
    await waitFor(() => {
      expect(screen.getByText('Layout Preset')).toBeInTheDocument();
    });
    expect(screen.getByText('Glass Dark')).toBeInTheDocument();
    expect(screen.getByText('Minimal Light')).toBeInTheDocument();
  });

  it('shows Screen Appearance fields when Mishkaat is selected', async () => {
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'mishkaat',
        style_options: {},
        layout_preset: 'mishkaat',
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
        label_speech: '',
      },
    });

    render(ThemePage, { props: slugData });

    await waitFor(() => {
      expect(screen.getByText('Screen Appearance')).toBeInTheDocument();
    });
    expect(screen.getByText('Metal')).toBeInTheDocument();
    expect(screen.getByText('Pattern')).toBeInTheDocument();
    expect(screen.getByText('Arch')).toBeInTheDocument();
    expect(screen.getByText('Numerals')).toBeInTheDocument();
    expect(screen.getByText('Density')).toBeInTheDocument();
  });

  it('shows Day & Night Colors section when Mishkaat', async () => {
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'mishkaat',
        style_options: {},
        layout_preset: 'mishkaat',
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
        label_speech: '',
      },
    });

    render(ThemePage, { props: slugData });

    await waitFor(() => {
      expect(screen.getByText('Day & Night Colors')).toBeInTheDocument();
    });
    expect(screen.getByText('Enable ambient palette')).toBeInTheDocument();
  });

  it('shows Quiet Hours section when Mishkaat', async () => {
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'mishkaat',
        style_options: {},
        layout_preset: 'mishkaat',
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
        label_speech: '',
      },
    });

    render(ThemePage, { props: slugData });

    await waitFor(() => {
      expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
    });
    expect(screen.getByText('Enable quiet hours')).toBeInTheDocument();
  });

  it('shows Screen Panels with checkboxes when Mishkaat', async () => {
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'mishkaat',
        style_options: {},
        layout_preset: 'mishkaat',
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
        label_speech: '',
      },
    });

    render(ThemePage, { props: slugData });

    await waitFor(() => {
      expect(screen.getByText('Screen Panels')).toBeInTheDocument();
    });
    expect(screen.getByText("Jumu'ah Times")).toBeInTheDocument();
    expect(screen.getByText('Hadith of the Day')).toBeInTheDocument();
  });

  it('shows Masjid Logo and Donate Appeal sections when Mishkaat', async () => {
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      theme: {
        style_system: 'mishkaat',
        style_options: {},
        layout_preset: 'mishkaat',
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
        label_speech: '',
      },
    });

    render(ThemePage, { props: slugData });

    await waitFor(() => {
      expect(screen.getByText('Masjid Logo')).toBeInTheDocument();
    });
    const donateElements = screen.getAllByText('Donate Appeal');
    expect(donateElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Medallion (star)')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Regression: Jumuah saves empty speech_time as null
// ---------------------------------------------------------------------------
describe('Jumuah page — save payload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts empty speech_time to null on create', async () => {
    render(JumuahPage, { props: slugData });

    const addBtn = await screen.findByText('Add Session');
    await fireEvent.click(addBtn);

    const labelInput = screen.getByPlaceholderText('e.g. English');
    await fireEvent.input(labelInput, { target: { value: 'English' } });

    const addSubmitBtn = screen.getByText('Add');
    await fireEvent.click(addSubmitBtn);

    expect(mockCreateJumuah).toHaveBeenCalledTimes(1);
    const body = mockCreateJumuah.mock.calls[0][1] as Record<string, unknown>;
    expect(body.speech_time).toBeNull();
    expect(body.label).toBe('English');
  });

  it('sends non-empty speech_time as-is on create', async () => {
    render(JumuahPage, { props: slugData });

    const addBtn = await screen.findByText('Add Session');
    await fireEvent.click(addBtn);

    const labelInput = screen.getByPlaceholderText('e.g. English');
    await fireEvent.input(labelInput, { target: { value: 'English' } });

    const speechInput = screen.getByPlaceholderText('13:00');
    await fireEvent.input(speechInput, { target: { value: '12:45' } });

    const addSubmitBtn = screen.getByText('Add');
    await fireEvent.click(addSubmitBtn);

    expect(mockCreateJumuah).toHaveBeenCalledTimes(1);
    const body = mockCreateJumuah.mock.calls[0][1] as Record<string, unknown>;
    expect(body.speech_time).toBe('12:45');
  });
});

// ---------------------------------------------------------------------------
// Regression: Announcements saves empty expires_at as null
// ---------------------------------------------------------------------------
describe('Announcements page — save payload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts empty expires_at to ISO string on create', async () => {
    render(AnnouncementsPage, { props: slugData });

    const newBtn = await screen.findByText('New');
    await fireEvent.click(newBtn);

    const textboxes = screen.getAllByRole('textbox');
    await fireEvent.input(textboxes[0], { target: { value: 'Test Announcement' } });
    await fireEvent.input(textboxes[1], { target: { value: 'Test content' } });

    const createBtn = screen.getByText('Create');
    await fireEvent.click(createBtn);

    expect(mockCreateAnnouncement).toHaveBeenCalledTimes(1);
    const body = mockCreateAnnouncement.mock.calls[0][1] as Record<string, unknown>;
    expect(body.expires_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Regression: Profile page save sends valid enum values (not field names)
// ---------------------------------------------------------------------------
describe('Profile page — save payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({
      name: 'Test Masjid',
      address_line1: '123 Main St',
      address_line2: null,
      city: 'Chicago',
      state: 'IL',
      postal_code: '60601',
      country: 'US',
      contact_phone: '+15551234567',
      contact_email: 'admin@test.org',
      facebook_url: null,
      youtube_url: null,
      instagram_url: null,
      website_url: null,
      external_donation_url: null,
      calculation_method: 2,
      asr_madhab: 'shafi',
      high_latitude_rule: 'seventh_of_night',
      show_dual_asr: false,
      fajr_angle: null,
      isha_angle: null,
      adjust_fajr: 0,
      adjust_sunrise: 0,
      adjust_dhuhr: 0,
      adjust_asr: 0,
      adjust_maghrib: 0,
      adjust_isha: 0,
      timezone: 'America/Chicago',
      latitude: 41.8781,
      longitude: -87.6298,
      theme: null,
    });
  });

  it('sends valid asr_madhab and high_latitude_rule on save', async () => {
    render(ProfilePage, { props: slugData });

    const saveBtn = await screen.findByText('Save Changes');
    expect(saveBtn).toBeDisabled();

    const cityInput = screen.getByLabelText('City');
    await fireEvent.input(cityInput, { target: { value: 'Evanston' } });

    expect(saveBtn).not.toBeDisabled();
    await fireEvent.click(saveBtn);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;

    expect(body.asr_madhab).toBe('shafi');
    expect(body.high_latitude_rule).toBe('seventh_of_night');
    expect(body.name).toBe('Test Masjid');
    expect(body.city).toBe('Evanston');
    expect(body.latitude).toBe(41.8781);
    expect(body.longitude).toBe(-87.6298);
  });

  it('sends correct asr_madhab when Show Both Asr is toggled', async () => {
    render(ProfilePage, { props: slugData });

    await screen.findByText('Save Changes');

    const dualAsrCheckbox = screen.getByLabelText('Show both Asr times (Shafi + Hanafi)');
    await fireEvent.click(dualAsrCheckbox);

    const saveBtn = screen.getByText('Save Changes');
    await fireEvent.click(saveBtn);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;

    expect(body.show_dual_asr).toBe(true);
    expect(body.asr_madhab).toBe('shafi');
    expect(body.asr_madhab).not.toBe('asr_madhab');
    expect(body.high_latitude_rule).toBe('seventh_of_night');
    expect(body.high_latitude_rule).not.toBe('high_latitude_rule');
  });

  it('sends changed asr_madhab value from select', async () => {
    render(ProfilePage, { props: slugData });

    const saveBtn = await screen.findByText('Save Changes');

    const asrSelect = screen.getByLabelText('Asr Madhab');
    await fireEvent.change(asrSelect, { target: { value: 'hanafi' } });

    expect(saveBtn).not.toBeDisabled();
    await fireEvent.click(saveBtn);

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const body = mockUpdateProfile.mock.calls[0][1] as Record<string, unknown>;

    expect(body.asr_madhab).toBe('hanafi');
  });
});
