// Mishkaat style system the homepage gains the mihrab hero niche, the Hadith
// of the Day card, adhaan/iqaamah hero moments, and the current-prayer
// rosette marker in the prayer table. Under Sakeenah none of this renders.
// (The prayer table itself is shared by both style systems — only the
// Mishkaat extras branch.)
//
// Note (2026-08-13): HadithCard was removed from the homepage per the
// consumer homepage overhaul. The announcement is front-and-center in the
// left content column (.c-announce-prominent); the hero, prayer table, and
// Jumu'ah form the right-hand timings column — with the prayer table always
// above Jumu'ah (2026-08-13: Thursday/Friday Jumu'ah pinning was removed
// because daily prayer times are more important).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { page } from '$app/stores';
import HomePage from '../../routes/[masjid_slug]/+page.svelte';

const PRAYER_HEADING = 'Today\u2019s Prayer Times';

type ThemeData = {
  style_system?: string;
  style_options?: Record<string, unknown>;
};

type PageData = {
  masjid: { name: string } | null;
  theme?: ThemeData | null;
  prayer_times: Record<string, { adhaan: string; iqaamah: string } | string> | null;
  jumuah: Array<{ label: string; time: string; khateeb?: string }>;
  pinned_announcement: { title: string; compiled_html: string } | null;
};

const prayerTimes = {
  fajr: { adhaan: '05:00', iqaamah: '05:15' },
  sunrise: '06:00',
  dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
  asr: { adhaan: '15:00', iqaamah: '15:15' },
  maghrib: { adhaan: '18:00', iqaamah: '18:05' },
  isha: { adhaan: '19:00', iqaamah: '19:15' },
};

const mishkaatData: PageData = {
  masjid: { name: 'Masjid Al-Noor' },
  theme: { style_system: 'mishkaat' },
  prayer_times: prayerTimes,
  jumuah: [{ label: 'First Khutbah', time: '13:30', khateeb: 'Sh. Ahmed' }],
  pinned_announcement: { title: 'Eid Announcement', compiled_html: '<p>Eid Mubarak</p>' },
};

vi.mock('$app/stores', () => {
  const listeners = new Set<(value: { data: PageData }) => void>();
  let value: { data: PageData } = {
    data: { masjid: null, prayer_times: null, jumuah: [], pinned_announcement: null },
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

function h2Order(container: HTMLElement): string[] {
  return [...container.querySelectorAll('h2')].map((h) => h.textContent?.trim() ?? '');
}

describe('homepage — Mishkaat (§7.11)', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    setPageData(mishkaatData);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('frames the hero countdown in the mihrab niche', () => {
    vi.setSystemTime(new Date('2026-07-30T10:00:00')); // Thursday 10:00
    const { container } = render(HomePage);

    const niche = container.querySelector('.c-hero-niche');
    expect(niche).not.toBeNull();
    expect(niche!.querySelector('svg.c-hero-arch')).not.toBeNull();
    expect(niche!.querySelectorAll('path.c-hero-arch-line')).toHaveLength(2);
    expect(niche!.querySelector('.c-hero-arch-rosette')).not.toBeNull();
    expect(container.querySelector('.geometric-pattern')).toBeNull();

    expect(niche!.textContent).toContain('Dhuhr in');
    expect(niche!.textContent).toContain('2:15:00');
    expect(niche!.textContent).toContain('Thursday, July 30, 2026');
  });

  it('renders the announcement prominently in the main content column', () => {
    vi.setSystemTime(new Date('2026-07-30T10:00:00')); // Thursday

    render(HomePage);

    expect(screen.getByRole('heading', { name: 'Announcement' })).toBeInTheDocument();
    expect(screen.getByText('Eid Announcement')).toBeInTheDocument();
    expect(screen.getByText('Eid Mubarak')).toBeInTheDocument();

    const prominent = document.querySelector('.c-announce-prominent');
    expect(prominent).not.toBeNull();
    expect(prominent!.textContent).toContain('Eid Announcement');
  });

  it('renders Jumu\u2019ah below the prayer table on Thursday (prayer always first)', () => {
    vi.setSystemTime(new Date('2026-07-30T10:00:00')); // Thursday
    const { container } = render(HomePage);

    expect(
      screen.getByRole('heading', { name: "Jumu'ah Timings" }),
    ).toBeInTheDocument();
    expect(screen.getByText('13:30')).toBeInTheDocument();

    // Content column (Announcement) precedes the timings column; within the
    // timings column the prayer table always sits above Jumu'ah — even on
    // Thursday/Friday, because daily prayer times are more important.
    const order = h2Order(container);
    const annIdx = order.indexOf('Announcement');
    const prayerIdx = order.indexOf(PRAYER_HEADING);
    const jumIdx = order.indexOf("Jumu'ah Timings");

    expect(annIdx).toBeGreaterThanOrEqual(0);
    expect(prayerIdx).toBeGreaterThan(annIdx);
    expect(jumIdx).toBeGreaterThan(prayerIdx);
  });

  it('renders Jumu\u2019ah below the prayer table on Wednesday (standard position)', () => {
    vi.setSystemTime(new Date('2026-07-29T10:00:00')); // Wednesday
    const { container } = render(HomePage);

    expect(
      screen.getByRole('heading', { name: "Jumu'ah Timings" }),
    ).toBeInTheDocument();

    const order = h2Order(container);
    const annIdx = order.indexOf('Announcement');
    const prayerIdx = order.indexOf(PRAYER_HEADING);
    const jumIdx = order.indexOf("Jumu'ah Timings");

    // Announcement in the content column, then prayer table, then Jumu'ah.
    expect(annIdx).toBeGreaterThanOrEqual(0);
    expect(prayerIdx).toBeGreaterThan(annIdx);
    expect(jumIdx).toBeGreaterThan(prayerIdx);
  });

  it('names the prayer during the adhaan moment', () => {
    vi.setSystemTime(new Date('2026-07-30T12:00:10')); // 10s after Dhuhr adhaan
    const { container } = render(HomePage);

    const niche = container.querySelector('.c-hero-niche')!;
    expect(niche.querySelector('.c-hero-label')?.textContent).toBe('Adhaan');
    expect(niche.querySelector('.c-hero-moment')?.textContent).toBe('Dhuhr');
    expect(niche.querySelector('.c-hero-countdown')).toBeNull();
  });

  it('counts down to iqaamah between adhaan and iqaamah', () => {
    vi.setSystemTime(new Date('2026-07-30T12:01:00'));
    const { container } = render(HomePage);

    const niche = container.querySelector('.c-hero-niche')!;
    expect(niche.querySelector('.c-hero-label')?.textContent).toBe('Dhuhr Iqaamah in');
    expect(niche.querySelector('.c-hero-countdown')?.textContent).toBe('0:14:00');
  });

  it('marks the current prayer row with a rosette', () => {
    vi.setSystemTime(new Date('2026-07-30T12:30:00')); // Dhuhr is current
    const { container } = render(HomePage);

    expect(container.querySelectorAll('.c-prayer-rosette')).toHaveLength(1);
  });

  it('renders nothing Mishkaat under Sakeenah', () => {
    vi.setSystemTime(new Date('2026-07-31T10:00:00')); // a Friday, to prove no pinning either
    setPageData({ ...mishkaatData, theme: { style_system: 'sakeenah' } });
    const { container } = render(HomePage);

    expect(container.querySelector('.c-hero-niche')).toBeNull();
    expect(container.querySelector('.geometric-pattern')).not.toBeNull();
    expect(container.querySelector('.c-prayer-rosette')).toBeNull();

    // Announcement (content col) before Jumu'ah (timings col)
    const order = h2Order(container);
    expect(order.indexOf('Announcement')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('Announcement')).toBeLessThan(order.indexOf("Jumu'ah Timings"));

    // The classic countdown hero still works
    expect(screen.getByText('Dhuhr in')).toBeInTheDocument();
    expect(screen.getByText('2:15:00')).toBeInTheDocument();
  });

  it('uses the photo hero when photoUrl is set in style_options', () => {
    vi.setSystemTime(new Date('2026-07-30T10:00:00'));
    setPageData({
      ...mishkaatData,
      theme: {
        style_system: 'mishkaat',
        style_options: { photoUrl: 'https://example.com/masjid.jpg' },
      },
    });

    const { container } = render(HomePage);

    const hero = container.querySelector('.c-hero-photo');
    expect(hero).not.toBeNull();
    expect((hero as HTMLElement).style.backgroundImage).toContain('masjid.jpg');

    const overlay = container.querySelector('.c-hero-photo-overlay');
    expect(overlay).not.toBeNull();

    const title = container.querySelector('.c-hero-photo-title');
    expect(title?.textContent).toBe('Masjid Al-Noor');

    // The mihrab niche should NOT render when photo hero is active
    expect(container.querySelector('.c-hero-niche')).toBeNull();
  });
});