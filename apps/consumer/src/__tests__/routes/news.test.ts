import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
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

function mockFetchError(status: number) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
  };
}

const postsData = {
  masjid_slug: 'test-masjid',
  masjid_name: 'Test Masjid',
  posts: [
    {
      id: 'p1',
      masjid_id: 'm1',
      title: 'Ramadan 2026 Announcement',
      slug: 'ramadan-2026',
      compiled_html:
        '<p>Ramadan starts next week. Prepare your hearts and homes.</p>',
      show_on_homepage: false,
      show_on_info: false,
      is_hidden: false,
      created_at: '2026-02-15T10:00:00Z',
      updated_at: '2026-02-15T10:00:00Z',
    },
    {
      id: 'p2',
      masjid_id: 'm1',
      title: 'Youth Program Enrollment',
      slug: 'youth-program',
      compiled_html: '<p>Enroll your kids in our weekend youth program.</p>',
      show_on_homepage: true,
      show_on_info: false,
      is_hidden: false,
      created_at: '2026-03-01T08:00:00Z',
      updated_at: '2026-03-01T08:00:00Z',
    },
    {
      id: 'p3',
      masjid_id: 'm1',
      title: 'Eid Festival',
      slug: 'eid-festival',
      compiled_html: null,
      show_on_homepage: false,
      show_on_info: false,
      is_hidden: false,
      created_at: '2026-06-20T12:00:00Z',
      updated_at: '2026-06-20T12:00:00Z',
    },
  ],
};

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
        if (url.includes('/posts')) {
          return Promise.resolve(mockFetchResponse(postsData));
        }
        if (url.includes('/announcements')) {
          return Promise.resolve(mockFetchResponse(announcementsData));
        }
        return Promise.resolve(mockFetchResponse({}));
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Posts and Announcements tab buttons', () => {
    render(NewsPage);

    expect(screen.getByRole('button', { name: 'Posts' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Announcements' }),
    ).toBeInTheDocument();
  });

  it('shows a loading spinner while fetching posts', () => {
    const { container } = render(NewsPage);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  it('renders post cards with title, date, and excerpt', async () => {
    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Ramadan 2026 Announcement')).toBeInTheDocument();
    });

    expect(screen.getByText('Youth Program Enrollment')).toBeInTheDocument();
    expect(screen.getByText('February 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('March 1, 2026')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Ramadan starts next week. Prepare your hearts and homes.',
      ),
    ).toBeInTheDocument();
  });

  it('renders post cards with links to /{slug}/posts/{post_slug}', async () => {
    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Ramadan 2026 Announcement')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', {
      name: /Ramadan 2026 Announcement/,
    });
    expect(link).toHaveAttribute('href', '/test-masjid/posts/ramadan-2026');
  });

  it('renders "Read more" link on each post card', async () => {
    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Ramadan 2026 Announcement')).toBeInTheDocument();
    });

    const readMoreLinks = screen.getAllByText('Read more →');
    expect(readMoreLinks).toHaveLength(3);
  });

  it('shows empty state when no posts exist', async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation((url: string) => {
        if (url.includes('/posts')) {
          return Promise.resolve(
            mockFetchResponse({ ...postsData, posts: [] }),
          );
        }
        if (url.includes('/announcements')) {
          return Promise.resolve(mockFetchResponse(announcementsData));
        }
        return Promise.resolve(mockFetchResponse({}));
      });

    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('No Posts Yet')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Check back later for articles and updates.'),
    ).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation((url: string) => {
        if (url.includes('/posts')) {
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('/announcements')) {
          return Promise.resolve(mockFetchResponse(announcementsData));
        }
        return Promise.resolve(mockFetchResponse({}));
      });

    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Failed to load posts.')).toBeInTheDocument();
    });
  });

  it('switches to Announcements tab on click', async () => {
    render(NewsPage);

    // Wait for initial posts to load so state is stable
    await waitFor(() => {
      expect(screen.getByText('Ramadan 2026 Announcement')).toBeInTheDocument();
    });

    const announcementsTab = screen.getByRole('button', {
      name: 'Announcements',
    });
    await fireEvent.click(announcementsTab);

    await waitFor(() => {
      expect(screen.getByText('Parking Lot Closed')).toBeInTheDocument();
    });
  });

  it('renders announcements tab using AnnouncementCard components', async () => {
    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Ramadan 2026 Announcement')).toBeInTheDocument();
    });

    const announcementsTab = screen.getByRole('button', {
      name: 'Announcements',
    });
    await fireEvent.click(announcementsTab);

    await waitFor(() => {
      expect(screen.getByText('Parking Lot Closed')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Volunteer Appreciation Dinner'),
    ).toBeInTheDocument();
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('handles announcements fetch failure gracefully', async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation((url: string) => {
        if (url.includes('/posts')) {
          return Promise.resolve(mockFetchResponse(postsData));
        }
        if (url.includes('/announcements')) {
          return Promise.reject(new Error('Server down'));
        }
        return Promise.resolve(mockFetchResponse({}));
      });

    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Ramadan 2026 Announcement')).toBeInTheDocument();
    });

    const announcementsTab = screen.getByRole('button', {
      name: 'Announcements',
    });
    await fireEvent.click(announcementsTab);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load announcements.'),
      ).toBeInTheDocument();
    });
  });

  it('shows empty state when no announcements exist', async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation((url: string) => {
        if (url.includes('/posts')) {
          return Promise.resolve(mockFetchResponse(postsData));
        }
        if (url.includes('/announcements')) {
          return Promise.resolve(
            mockFetchResponse({ ...announcementsData, announcements: [] }),
          );
        }
        return Promise.resolve(mockFetchResponse({}));
      });

    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Ramadan 2026 Announcement')).toBeInTheDocument();
    });

    const announcementsTab = screen.getByRole('button', {
      name: 'Announcements',
    });
    await fireEvent.click(announcementsTab);

    await waitFor(() => {
      expect(screen.getByText('No Announcements Yet')).toBeInTheDocument();
    });
  });

  it('sets the page title via svelte:head', () => {
    render(NewsPage);

    expect(document.title).toBe('News — Test Masjid');
  });

  it('renders post without compiled_html gracefully', async () => {
    render(NewsPage);

    await waitFor(() => {
      expect(screen.getByText('Eid Festival')).toBeInTheDocument();
    });
  });
});