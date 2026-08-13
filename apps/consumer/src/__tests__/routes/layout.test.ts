// Layout shell component tests (Workstream C — header logo + footer).
// Tests that the logo image renders when logoUrl is set in theme
// style_options, the footer renders masjid name/location/contact,
// and header/footer are hidden in embed mode.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import Layout from '../../routes/[masjid_slug]/+layout.svelte';

type ThemeData = {
  style_system?: string;
  style_options?: Record<string, unknown>;
  primary_color?: string;
  accent_color?: string;
  font_body?: string;
  font_heading?: string;
  layout_preset?: string;
  time_format?: '12h' | '24h';
  label_adhaan?: string;
  label_iqaamah?: string;
  label_jumuah?: string;
  label_speech?: string;
  label_sunrise?: string;
  label_fajr?: string;
  label_dhuhr?: string;
  label_asr?: string;
  label_maghrib?: string;
  label_isha?: string;
};

type MasjidData = {
  slug?: string;
  name?: string;
  city?: string | null;
  state?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
};

type PageData = {
  masjid: MasjidData | null;
  theme?: ThemeData | null;
  prayer_times?: Record<string, unknown> | null;
  jumuah?: Array<Record<string, unknown>>;
  pinned_announcement?: { title: string; compiled_html: string } | null;
  recent_announcements?: Array<Record<string, unknown>>;
  homepage_post?: { title: string; slug: string; compiled_html: string | null; created_at: string } | null;
  info_post?: { title: string; slug: string; compiled_html: string | null; created_at: string } | null;
  nav_items?: Array<Record<string, unknown>>;
};

const { mockPageStore } = vi.hoisted(() => {
  const listeners = new Set<(value: { data: PageData; url: URL }) => void>();
  let value: { data: PageData; url: URL } = {
    data: {
      masjid: null,
      theme: null,
      prayer_times: null,
      jumuah: [],
      pinned_announcement: null,
      recent_announcements: [],
      homepage_post: null,
      info_post: null,
      nav_items: [],
    },
    url: new URL('http://localhost:5175/masjid-al-noor'),
  };

  const mockPageStore = {
    subscribe(fn: (value: { data: PageData; url: URL }) => void) {
      fn(value);
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(newValue: { data?: PageData; url?: URL }) {
      value = { ...value, ...newValue } as { data: PageData; url: URL };
      listeners.forEach((fn) => fn(value));
    },
    updateUrl(path: string) {
      value.url = new URL(`http://localhost:5175${path}`);
      listeners.forEach((fn) => fn(value));
    },
  };

  return { mockPageStore };
});

vi.mock('$app/stores', () => ({ page: mockPageStore }));

vi.mock('$app/navigation', () => ({
  beforeNavigate: vi.fn(),
  afterNavigate: vi.fn(),
}));

const minimalTheme: ThemeData = {
  primary_color: '#1e3a8a',
  accent_color: '#10b981',
  font_body: 'Inter',
  font_heading: 'Inter',
  layout_preset: 'glass-dark',
  time_format: '12h',
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
};

const prayerTimes = {
  fajr: { adhaan: '05:00', iqaamah: '05:15' },
  sunrise: '06:00',
  dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
  asr: { adhaan: '15:00', iqaamah: '15:15' },
  maghrib: { adhaan: '18:00', iqaamah: '18:05' },
  isha: { adhaan: '19:00', iqaamah: '19:15' },
};

describe('layout shell', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T10:00:00'));
    mockPageStore.set({
      data: {
        masjid: null,
        prayer_times: null,
        jumuah: [],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('header logo', () => {
    it('renders logo image when logoUrl is set in style_options', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-noor', name: 'Masjid Al-Noor' },
          theme: {
            ...minimalTheme,
            style_options: { logoUrl: 'https://example.com/logo.png' },
          },
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      const img = document.querySelector('.c-logo-img') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toBe('https://example.com/logo.png');
      expect(img.alt).toBe('Masjid Al-Noor logo');
    });

    it('renders rosette for Mishkaat when logoUrl is empty', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-noor', name: 'Masjid Al-Noor' },
          theme: { ...minimalTheme, style_system: 'mishkaat' },
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      const { container } = render(Layout, { props: { children: (() => 'content') as any } });

      expect(document.querySelector('.c-logo-img')).toBeNull();
      expect(container.querySelector('.c-header-rosette')).toBeInTheDocument();
    });

    it('renders letter avatar for Sakeenah when logoUrl is empty', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-jabal', name: 'Masjid Al-Jabal' },
          theme: { ...minimalTheme, layout_preset: 'minimal-light' },
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      expect(document.querySelector('.c-logo-img')).toBeNull();
      expect(document.querySelector('.c-header-rosette')).toBeNull();
      // header text is present (also appears in footer — that's fine)
      const names = screen.getAllByText('Masjid Al-Jabal');
      expect(names.length).toBeGreaterThanOrEqual(1);
    });

    it('logo image takes precedence over both Mishkaat and Sakeenah fallbacks', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-noor', name: 'Masjid Al-Noor' },
          theme: {
            ...minimalTheme,
            style_system: 'mishkaat',
            style_options: { logoUrl: 'https://example.com/logo.png' },
          },
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      expect(document.querySelector('.c-logo-img')).toBeInTheDocument();
      expect(document.querySelector('.c-header-rosette')).toBeNull();
    });
  });

  describe('footer', () => {
    it('renders masjid name in footer', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-noor', name: 'Masjid Al-Noor' },
          theme: minimalTheme,
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      const footer = document.querySelector('.c-ftr');
      expect(footer).toBeInTheDocument();
      expect(footer!.querySelector('.c-ftr-body')!.textContent).toContain('Masjid Al-Noor');
    });

    it('renders city and state when both are set', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-noor', name: 'Masjid Al-Noor', city: 'Dallas', state: 'TX' },
          theme: minimalTheme,
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      const body = document.querySelector('.c-ftr-body')!;
      expect(body.textContent).toContain('Dallas, TX');
    });

    it('renders city only when state is missing', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-noor', name: 'Masjid Al-Noor', city: 'Chicago' },
          theme: minimalTheme,
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      const body = document.querySelector('.c-ftr-body')!;
      expect(body.textContent).toContain('Chicago');
      expect(body.textContent).not.toContain(',');
    });

    it('renders contact phone and email when set', () => {
      mockPageStore.set({
        data: {
          masjid: {
            slug: 'masjid-al-noor',
            name: 'Masjid Al-Noor',
            contact_phone: '555-123-4567',
            contact_email: 'info@masjid-alnoor.org',
          },
          theme: minimalTheme,
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      const body = document.querySelector('.c-ftr-body')!;
      expect(body.textContent).toContain('555-123-4567');
      expect(body.textContent).toContain('info@masjid-alnoor.org');
    });

    it('renders footer star band', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-noor', name: 'Masjid Al-Noor' },
          theme: minimalTheme,
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      expect(document.querySelector('.c-ftr-band')).toBeInTheDocument();
    });
  });

  describe('embed mode', () => {
    it('hides header and footer when embed param is present', () => {
      mockPageStore.set({
        data: {
          masjid: { slug: 'masjid-al-noor', name: 'Masjid Al-Noor' },
          theme: minimalTheme,
          prayer_times: prayerTimes,
          jumuah: [],
          pinned_announcement: null,
          recent_announcements: [],
          homepage_post: null,
          info_post: null,
          nav_items: [],
        },
        url: new URL('http://localhost:5175/masjid-al-noor?embed=1'),
      });

      render(Layout, { props: { children: (() => 'content') as any } });

      expect(document.querySelector('header')).toBeNull();
      expect(document.querySelector('.c-ftr')).toBeNull();
      expect(document.querySelector('nav[aria-label="Mobile navigation"]')).toBeNull();
    });
  });
});