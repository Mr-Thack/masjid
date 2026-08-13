import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { page } from '$app/stores';
import NewsPage from '../../routes/[masjid_slug]/news/+page.svelte';

type PageData = {
  masjid: { slug: string; name: string } | null;
};

vi.mock('$app/stores', () => {
  const listeners = new Set<(value: { data: PageData }) => void>();
  let value: { data: PageData } = { data: { masjid: null } };

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

function mockFetchResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  };
}

const announcementsData = {
  masjid_slug: 'test-masjid',
  masjid_name: 'Test Masjid',
  announcements: [
    {
      id: 'a1',
      masjid_id: 'm1',
      title: 'Parking Lot Closed',
      slug: 'parking-closed',
      compiled_html: '<p>Main parking lot closed for repaving this weekend.</p>',
      status: 'published',
      is_pinned: false,
      published_at: '2026-07-01T09:00:00Z',
      expires_at: null,
      created_at: '2026-07-01T09:00:00Z',
      updated_at: '2026-07-01T09:00:00Z',
    },
    {
      id: 'a2',
      masjid_id: 'm1',
      title: 'Volunteer Appreciation Dinner',
      slug: 'volunteer-dinner',
      compiled_html:
        '<p>All volunteers are invited to a dinner on August 10th.</p>',
      status: 'published',
      is_pinned: true,
      published_at: '2026-07-15T14:00:00Z',
      expires_at: null,
      created_at: '2026-07-15T14:00:00Z',
      updated_at: '2026-07-15T14:00:00Z',
    },
  ],
};

describe('News page', () => {
  beforeEach(() => {
    cleanup();
    setPageData({ masjid: { slug: 'test-masjid', name: 'Test Masjid' } });

    globalThis.fetch = vi
      .fn()
      .mockImplementation((url: string) => {
        if (url.includes('/announcements')) {
          return Promise.resolve(mockFetchResponse(announcementsData));
        }
        return Promise.resolve(mockFetchResponse({}));
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading spinner while fetching announcements', () => {
    const { container } = render(NewsPage);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  it('renders announcements once loaded', async () => {
    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Parking Lot Closed')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Volunteer Appreciation Dinner'),
    ).toBeInTheDocument();
  });

  it('renders announcements using AnnouncementCard components', async () => {
    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Parking Lot Closed')).toBeInTheDocument();
    });

    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('shows empty state when no announcements exist', async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation((url: string) => {
        if (url.includes('/announcements')) {
          return Promise.resolve(
            mockFetchResponse({ ...announcementsData, announcements: [] }),
          );
        }
        return Promise.resolve(mockFetchResponse({}));
      });

    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('No Announcements Yet')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Check back for updates and community news.'),
    ).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation((url: string) => {
        if (url.includes('/announcements')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(mockFetchResponse({}));
      });

    render(NewsPage);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load announcements.'),
      ).toBeInTheDocument();
    });
  });

  it('sets the page title via svelte:head', () => {
    render(NewsPage);

    expect(document.title).toBe('Announcements — Test Masjid');
  });
});