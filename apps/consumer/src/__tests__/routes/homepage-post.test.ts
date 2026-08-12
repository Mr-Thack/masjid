import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { page } from '$app/stores';
import HomePage from '../../routes/[masjid_slug]/+page.svelte';

type MasjidData = {
  name: string;
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

type HomepagePost = {
  title: string;
  slug: string;
  compiled_html: string | null;
  created_at: string;
};

type PageData = {
  masjid: MasjidData | null;
  prayer_times: PrayerTimes | null;
  jumuah: JumuahSession[];
  pinned_announcement: PinnedAnnouncement | null;
  homepage_post?: HomepagePost | null;
};

const emptyData: PageData = {
  masjid: null,
  prayer_times: null,
  jumuah: [],
  pinned_announcement: null,
  homepage_post: null,
};

const prayerTimes: PrayerTimes = {
  fajr: { adhaan: '05:00', iqaamah: '05:15' },
  sunrise: '06:00',
  dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
  asr: { adhaan: '15:00', iqaamah: '15:15' },
  maghrib: { adhaan: '18:00', iqaamah: '18:05' },
  isha: { adhaan: '19:00', iqaamah: '19:15' },
};

vi.mock('$app/stores', () => {
  const listeners = new Set<(value: { data: PageData }) => void>();
  let value: { data: PageData } = {
    data: { masjid: null, prayer_times: null, jumuah: [], pinned_announcement: null, homepage_post: null },
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

describe('Homepage post pin card', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T10:00:00'));
    setPageData(emptyData);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders homepage_post when data has homepage_post', () => {
    setPageData({
      masjid: { name: 'Test Masjid' },
      prayer_times: prayerTimes,
      jumuah: [],
      pinned_announcement: null,
      homepage_post: {
        title: 'Community Iftar Event',
        slug: 'community-iftar',
        compiled_html: '<p>Join us for a community iftar this Saturday at sunset.</p>',
        created_at: '2026-03-01T10:00:00Z',
      },
    });

    render(HomePage);

    expect(screen.getByText('Community Iftar Event')).toBeInTheDocument();
    expect(
      screen.getByText('Join us for a community iftar this Saturday at sunset.'),
    ).toBeInTheDocument();
  });

  it('does not render when homepage_post is null', () => {
    setPageData({
      masjid: { name: 'Test Masjid' },
      prayer_times: prayerTimes,
      jumuah: [],
      pinned_announcement: null,
      homepage_post: null,
    });

    render(HomePage);

    expect(screen.queryByText('Community Iftar Event')).not.toBeInTheDocument();
  });

  it('renders the post title and compiled_html', () => {
    setPageData({
      masjid: { name: 'Test Masjid' },
      prayer_times: prayerTimes,
      jumuah: [],
      pinned_announcement: null,
      homepage_post: {
        title: 'Youth Halaqa',
        slug: 'youth-halaqa',
        compiled_html:
          '<p>Weekly youth halaqa every Friday after <strong>Maghrib</strong>.</p>',
        created_at: '2026-03-15T08:00:00Z',
      },
    });

    const { container } = render(HomePage);

    expect(screen.getByText('Youth Halaqa')).toBeInTheDocument();

    const postSections = container.querySelectorAll('aside section');
    const postSection = [...postSections].find((s) =>
      s.textContent?.includes('Weekly youth halaqa'),
    );
    expect(postSection).toBeDefined();
    expect(postSection!.querySelector('strong')?.textContent).toBe('Maghrib');
  });

  it('card has accent left border', () => {
    setPageData({
      masjid: { name: 'Test Masjid' },
      prayer_times: prayerTimes,
      jumuah: [],
      pinned_announcement: null,
      homepage_post: {
        title: 'Event',
        slug: 'event',
        compiled_html: '<p>Details here.</p>',
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    const { container } = render(HomePage);

    const postCards = container.querySelectorAll(
      'aside .glass-card.border-l-4',
    );
    expect(postCards.length).toBeGreaterThanOrEqual(1);

    const lastCard = postCards[postCards.length - 1];
    expect(
      (lastCard as HTMLElement).style.getPropertyValue('border-left-color'),
    ).toBeDefined();
  });
});