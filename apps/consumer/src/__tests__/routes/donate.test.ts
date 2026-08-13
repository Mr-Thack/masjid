import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { page } from '$app/stores';
import DonatePage from '../../routes/[masjid_slug]/donate/+page.svelte';

type MasjidData = {
  slug: string;
  name: string;
  donation_links?: string | null;
};

type ThemeData = {
  style_options?: Record<string, unknown>;
};

type PageData = {
  masjid: MasjidData | null;
  theme?: ThemeData;
};

const emptyData: PageData = {
  masjid: null,
};

vi.mock('$app/stores', () => {
  const listeners = new Set<(value: { data: PageData }) => void>();
  let value: { data: PageData } = {
    data: { masjid: null },
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

describe('Donate page', () => {
  beforeEach(() => {
    cleanup();
    setPageData(emptyData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the default donate reasons when no theme options are set', () => {
    setPageData({
      masjid: { slug: 'test-masjid', name: 'Test Masjid' },
    });

    render(DonatePage);

    expect(screen.getByText('Maintain the House of Allah')).toBeInTheDocument();
    expect(screen.getByText('Support Education')).toBeInTheDocument();
    expect(screen.getByText('Serve the Community')).toBeInTheDocument();
    expect(screen.getByText('Keep our masjid clean, safe, and welcoming')).toBeInTheDocument();
    expect(screen.getByText('Fund classes, lectures, and youth programs')).toBeInTheDocument();
    expect(screen.getByText('Help those in need through outreach programs')).toBeInTheDocument();
  });

  it('renders custom donate reasons from style_options', () => {
    setPageData({
      masjid: { slug: 'test-masjid', name: 'Test Masjid' },
      theme: {
        style_options: {
          donateReasons: [
            { icon: '💚', title: 'Green Initiative', desc: 'Make our masjid eco-friendly' },
            { icon: '📖', title: 'Quran Classes', desc: 'Free classes for all ages' },
          ],
        },
      },
    });

    render(DonatePage);

    expect(screen.getByText('Green Initiative')).toBeInTheDocument();
    expect(screen.getByText('Make our masjid eco-friendly')).toBeInTheDocument();
    expect(screen.getByText('Quran Classes')).toBeInTheDocument();
    expect(screen.getByText('Free classes for all ages')).toBeInTheDocument();
    expect(screen.queryByText('Maintain the House of Allah')).not.toBeInTheDocument();
  });

  it('renders the page title', () => {
    setPageData({
      masjid: { slug: 'test-masjid', name: 'Test Masjid' },
    });

    render(DonatePage);

    expect(screen.getByText('Support Test Masjid')).toBeInTheDocument();
  });
});