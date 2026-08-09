// These integration tests assert the new homepage contract for
// `+page.svelte`: the masjid name is the main heading; a next-prayer countdown
// card is shown; today's five prayer times are rendered; Jumu'ah, Announcement
// and Donate sections are shown conditionally; and skeleton placeholders appear
// when `prayer_times` is missing.
//
// Note: If `+page.svelte` still follows the pre-refactor layout (city/state
// subtitle, Jumu'ah only on Fridays, etc.), these tests describe the target
// contract and will fail until the page is updated.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { page } from '$app/stores';
import HomePage from '../../routes/[masjid_slug]/+page.svelte';

type MasjidData = {
  name: string;
  city?: string;
  state?: string;
  slug?: string;
  asr_madhab?: string;
  donation_links?: string;
};

type PrayerTimes = Record<string, { adhaan: string; iqaamah: string } | string>;

type JumuahSession = {
  label: string;
  time: string;
  khateeb?: string;
  location?: string;
  speech_time?: string;
};

type PinnedAnnouncement = {
  title: string;
  compiled_html: string;
};

type PageData = {
  masjid: MasjidData | null;
  prayer_times: PrayerTimes | null;
  jumuah: JumuahSession[];
  pinned_announcement: PinnedAnnouncement | null;
};

const emptyData: PageData = {
  masjid: null,
  prayer_times: null,
  jumuah: [],
  pinned_announcement: null,
};

vi.mock('$app/stores', () => {
  const listeners = new Set<(value: { data: PageData }) => void>();
  let value: { data: PageData } = {
    data: {
      masjid: null,
      prayer_times: null,
      jumuah: [],
      pinned_announcement: null,
    },
  };

  const pageStore = {
    subscribe(fn: (value: { data: PageData }) => void) {
      fn(value);
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(newValue: { data: PageData }) {
      value = newValue;
      listeners.forEach((fn) => fn(newValue));
    },
  };

  return { page: pageStore };
});

function setPageData(data: PageData) {
  (page as any).set({ data });
}

describe('homepage', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T10:00:00'));
    setPageData(emptyData);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a fully-loaded homepage', () => {
    setPageData({
      masjid: {
        name: 'Masjid Al-Noor',
        city: 'Dallas',
        state: 'TX',
        slug: 'masjid-al-noor',
        donation_links: JSON.stringify([{ label: 'Donate', url: 'https://donate.example.com' }]),
      },
      prayer_times: {
        fajr: { adhaan: '05:00', iqaamah: '05:15' },
        sunrise: '06:00',
        dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
        asr: { adhaan: '15:00', iqaamah: '15:15' },
        maghrib: { adhaan: '18:00', iqaamah: '18:05' },
        isha: { adhaan: '19:00', iqaamah: '19:15' },
      },
      jumuah: [
        {
          label: 'First Khutbah',
          time: '13:30',
          khateeb: 'Sh. Ahmed',
          location: 'Main Hall',
        },
        {
          label: 'Second Khutbah',
          time: '14:00',
          khateeb: 'Sh. Yusuf',
          location: 'Main Hall',
        },
      ],
      pinned_announcement: {
        title: 'Eid Announcement',
        compiled_html:
          '<p>Join us for Eid prayer <strong>tomorrow</strong> at 8 AM.</p>',
      },
    });

    render(HomePage);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Masjid Al-Noor' }),
    ).toBeInTheDocument();

    expect(screen.getByText('Dhuhr in')).toBeInTheDocument();
    expect(screen.getByText('2:15:00')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Prayer Times' }),
    ).toBeInTheDocument();

    for (const name of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    expect(screen.getByText('05:00')).toBeInTheDocument();
    expect(screen.getByText('05:15')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: "Jumu'ah Timings" }),
    ).toBeInTheDocument();
    expect(screen.getByText('13:30')).toBeInTheDocument();
    expect(screen.getByText('— Sh. Ahmed')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('— Sh. Yusuf')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Announcement' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Eid Announcement')).toBeInTheDocument();
    expect(screen.getByText(/Join us for Eid prayer/)).toBeInTheDocument();
    expect(screen.getByText('tomorrow')).toBeInTheDocument();

    expect(screen.queryByText(/Dallas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/TX/)).not.toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /Support This Masjid/ }),
    ).toHaveAttribute('href', '/masjid-al-noor/donate');
  });

  it('renders minimal data without optional sections', () => {
    setPageData({
      masjid: { name: 'Test Masjid' },
      prayer_times: {
        fajr: { adhaan: '05:30', iqaamah: '05:45' },
        sunrise: '06:15',
        dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
        asr: { adhaan: '15:00', iqaamah: '15:15' },
        maghrib: { adhaan: '18:00', iqaamah: '18:05' },
        isha: { adhaan: '19:00', iqaamah: '19:15' },
      },
      jumuah: [],
      pinned_announcement: null,
    });

    render(HomePage);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Test Masjid' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Prayer Times' }),
    ).toBeInTheDocument();

    for (const name of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    expect(screen.getByText('05:30')).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: "Jumu'ah Timings" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Announcement' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Support This Masjid/ }),
    ).not.toBeInTheDocument();
  });

  it('shows a skeleton placeholder when prayer_times is missing', () => {
    setPageData({
      masjid: { name: 'Loading Masjid' },
      prayer_times: null,
      jumuah: [],
      pinned_announcement: null,
    });

    const { container } = render(HomePage);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Loading Masjid' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Prayer Times' }),
    ).toBeInTheDocument();

    const skeletons = container.querySelectorAll('.animate-shimmer');
    expect(skeletons).toHaveLength(1);
  });

  it('renders dual Asr when asr_secondary is provided on prayer_times', () => {
    setPageData({
      masjid: { name: 'Dual Asr Masjid', asr_madhab: 'hanafi' },
      prayer_times: {
        fajr: { adhaan: '05:00', iqaamah: '05:15' },
        sunrise: '06:00',
        dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
        asr: { adhaan: '18:00', iqaamah: '18:15' },
        asr_secondary: '17:00',
        maghrib: { adhaan: '20:00', iqaamah: '20:05' },
        isha: { adhaan: '21:00', iqaamah: '21:15' },
      },
      jumuah: [],
      pinned_announcement: null,
    });

    render(HomePage);

    // Primary is hanafi, so secondary is Shafi
    expect(screen.getByText('Asr (Shafi): 17:00')).toBeInTheDocument();
  });

  it('does not render dual Asr when asr_secondary is not provided', () => {
    setPageData({
      masjid: { name: 'Single Asr Masjid', asr_madhab: 'shafi' },
      prayer_times: {
        fajr: { adhaan: '05:00', iqaamah: '05:15' },
        sunrise: '06:00',
        dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
        asr: { adhaan: '15:00', iqaamah: '15:15' },
        maghrib: { adhaan: '18:00', iqaamah: '18:05' },
        isha: { adhaan: '19:00', iqaamah: '19:15' },
      },
      jumuah: [],
      pinned_announcement: null,
    });

    render(HomePage);

    expect(screen.queryByText(/Asr \(/)).toBeNull();
  });
});
