import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { page } from '$app/stores';
import InfoPage from '../../routes/[masjid_slug]/info/+page.svelte';

type MasjidData = {
  slug: string;
  name: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  instagram_url?: string | null;
};

type InfoPost = {
  title: string;
  slug: string;
  compiled_html: string | null;
  created_at: string;
};

type ThemeData = {
  style_options?: Record<string, unknown>;
};

type PageData = {
  masjid: MasjidData | null;
  info_post?: InfoPost | null;
  theme?: ThemeData;
};

const emptyData: PageData = {
  masjid: null,
  info_post: null,
};

vi.mock('$app/stores', () => {
  const listeners = new Set<(value: { data: PageData }) => void>();
  let value: { data: PageData } = {
    data: { masjid: null, info_post: null },
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

describe('Info page post pin card', () => {
  beforeEach(() => {
    cleanup();
    setPageData(emptyData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders info_post card when data has info_post', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
      },
      info_post: {
        title: 'Masjid History',
        slug: 'masjid-history',
        compiled_html:
          '<p>Founded in 1995, our masjid has served the community for over 30 years.</p>',
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    render(InfoPage);

    expect(screen.getByText('Masjid History')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Founded in 1995, our masjid has served the community for over 30 years.',
      ),
    ).toBeInTheDocument();
  });

  it('does not render when info_post is null', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
      },
      info_post: null,
    });

    render(InfoPage);

    expect(screen.queryByText('Masjid History')).not.toBeInTheDocument();
  });

  it('does not render when info_post is undefined', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
      },
    });

    render(InfoPage);

    const container = document.querySelector('.max-w-2xl.mx-auto');
    expect(container).not.toBeNull();
  });

  it('renders the post title', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
      },
      info_post: {
        title: 'Parking Instructions',
        slug: 'parking',
        compiled_html: '<p>Please park in designated areas only.</p>',
        created_at: '2026-02-01T00:00:00Z',
      },
    });

    render(InfoPage);

    const heading = screen.getByText('Parking Instructions');
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H2');
  });

  it('renders compiled_html', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
      },
      info_post: {
        title: 'About Us',
        slug: 'about',
        compiled_html:
          '<p>Welcome to our community. We offer <strong>daily prayers</strong> and weekend programs.</p>',
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    const { container } = render(InfoPage);

    expect(screen.getByText('daily prayers')).toBeInTheDocument();
    const infoSections = container.querySelectorAll('section.glass-card');
    const infoSection = [...infoSections].find((s) =>
      s.textContent?.includes('About Us'),
    );
    expect(infoSection?.textContent).toContain('and weekend programs');
  });

  it('stays after the social links section', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
        website_url: 'https://example.com',
        facebook_url: 'https://facebook.com/example',
      },
      info_post: {
        title: 'Community Guidelines',
        slug: 'guidelines',
        compiled_html: '<p>Please respect the masjid and its visitors.</p>',
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    const { container } = render(InfoPage);

    const sections = container.querySelectorAll('section.glass-card');
    const lastSection = sections[sections.length - 1];
    expect(lastSection).not.toBeNull();
    expect(lastSection!.textContent).toContain('Community Guidelines');
    expect(lastSection!.textContent).toContain(
      'Please respect the masjid and its visitors.',
    );
  });

  it('renders alongside address and other info sections', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
        address_line1: '123 Main St',
        city: 'Chicago',
        state: 'IL',
        postal_code: '60601',
        country: 'USA',
        contact_email: 'info@testmasjid.org',
        website_url: 'https://testmasjid.org',
      },
      info_post: {
        title: 'About Our Masjid',
        slug: 'about',
        compiled_html: '<p>A place of worship and community.</p>',
        created_at: '2026-01-01T00:00:00Z',
      },
    });

    render(InfoPage);

    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('Chicago, IL, 60601')).toBeInTheDocument();
    expect(screen.getByText('USA')).toBeInTheDocument();
    expect(screen.getByText('info@testmasjid.org')).toBeInTheDocument();
    expect(screen.getByText('Website')).toBeInTheDocument();
    expect(screen.getByText('About Our Masjid')).toBeInTheDocument();
  });

  it('shows WhatsApp link when whatsappGroupUrl is set', () => {
    setPageData({
      masjid: { slug: 'test-masjid', name: 'Test Masjid' },
      theme: {
        style_options: { whatsappGroupUrl: 'https://chat.whatsapp.com/abc123' },
      },
    });

    render(InfoPage);

    const link = screen.getByText('Join Our WhatsApp Group');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')?.getAttribute('href')).toBe('https://chat.whatsapp.com/abc123');
  });

  it('does not show WhatsApp link when whatsappGroupUrl is empty', () => {
    setPageData({
      masjid: { slug: 'test-masjid', name: 'Test Masjid' },
      theme: {
        style_options: {},
      },
    });

    render(InfoPage);

    expect(screen.queryByText('Join Our WhatsApp Group')).not.toBeInTheDocument();
  });

  it('shows WhatsApp link alongside social links', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
        website_url: 'https://testmasjid.org',
      },
      theme: {
        style_options: { whatsappGroupUrl: 'https://chat.whatsapp.com/abc123' },
      },
    });

    render(InfoPage);

    expect(screen.getByText('Website')).toBeInTheDocument();
    expect(screen.getByText('Join Our WhatsApp Group')).toBeInTheDocument();
  });

  it('does not crash when theme is undefined (resolver defaults kick in)', () => {
    setPageData({
      masjid: {
        slug: 'test-masjid',
        name: 'Test Masjid',
        website_url: 'https://testmasjid.org',
      },
    });

    render(InfoPage);

    expect(screen.queryByText('Join Our WhatsApp Group')).not.toBeInTheDocument();
    expect(screen.getByText('Website')).toBeInTheDocument();
  });
});