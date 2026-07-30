// Mishkaat consumer adaptation (docs/design-language.md §7.11): under the
// Mishkaat style system the homepage gains the mihrab hero niche, the Hadith
// of the Day card, Thursday–Friday Jumu'ah pinning, adhaan/iqaamah hero
// moments, and the current-prayer rosette marker in the prayer table. Under
// Sakeenah none of this renders. (The prayer table itself is shared by both
// style systems — only the Mishkaat extras branch.)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { page } from '$app/stores';
import HomePage from '../../routes/[masjid_slug]/+page.svelte';

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
    // Canonical mihrab geometry: outer + inner echo paths and the apex rosette
    expect(niche!.querySelectorAll('path.c-hero-arch-line')).toHaveLength(2);
    expect(niche!.querySelector('.c-hero-arch-rosette')).not.toBeNull();
    // The Sakeenah blurred-pattern backdrop is gone
    expect(container.querySelector('.geometric-pattern')).toBeNull();

    // Normal countdown content, inside the niche
    expect(niche!.textContent).toContain('Dhuhr in');
    expect(niche!.textContent).toContain('2:15:00');
    expect(niche!.textContent).toContain('Thursday, July 30, 2026');
  });

  it('shows the Hadith of the Day (Arabic + English + source)', () => {
    vi.setSystemTime(new Date('2026-07-30T10:00:00'));
    render(HomePage);

    expect(screen.getByText('Hadith of the Day')).toBeInTheDocument();
    const arabic = document.querySelector('.c-hadith-arabic');
    expect(arabic).not.toBeNull();
    expect(arabic!.getAttribute('dir')).toBe('rtl');
    expect(document.querySelector('.c-hadith-source')?.textContent).toMatch(/\w/);
  });

  it('seeds the Friday hadith from the Jumu\u2019ah occasion pool', () => {
    vi.setSystemTime(new Date('2026-07-31T10:00:00')); // Friday 10:00
    render(HomePage);

    // dayOfYear(2026-07-31) = 212; the jumu'ah pool has 2 entries; 212 % 2 = 0
    expect(
      screen.getByText('The best day on which the sun rises is Friday.'),
    ).toBeInTheDocument();
  });

  it('pins Jumu\u2019ah above the announcement on Thursday and Friday', () => {
    vi.setSystemTime(new Date('2026-07-30T10:00:00')); // Thursday
    const { container } = render(HomePage);
    const order = h2Order(container);
    expect(order.indexOf("Jumu'ah Timings")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("Jumu'ah Timings")).toBeLessThan(order.indexOf('Announcement'));
  });

  it('keeps the announcement first on other weekdays', () => {
    vi.setSystemTime(new Date('2026-07-29T10:00:00')); // Wednesday
    const { container } = render(HomePage);
    const order = h2Order(container);
    expect(order.indexOf('Announcement')).toBeLessThan(order.indexOf("Jumu'ah Timings"));
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
    expect(screen.queryByText('Hadith of the Day')).toBeNull();
    expect(container.querySelector('.c-prayer-rosette')).toBeNull();

    const order = h2Order(container);
    expect(order.indexOf('Announcement')).toBeLessThan(order.indexOf("Jumu'ah Timings"));

    // The classic countdown hero still works
    expect(screen.getByText('Dhuhr in')).toBeInTheDocument();
    expect(screen.getByText('2:15:00')).toBeInTheDocument();
  });
});
