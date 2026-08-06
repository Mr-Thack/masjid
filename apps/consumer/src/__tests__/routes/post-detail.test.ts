import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { page } from '$app/stores';
import PostDetailPage from '../../routes/[masjid_slug]/posts/[post_slug]/+page.svelte';

type MasjidData = {
  slug: string;
  name: string;
};

type PageData = {
  masjid: MasjidData | null;
};

vi.mock('$app/stores', () => {
  const listeners = new Set<(value: { data: PageData }) => void>();
  let value: { data: PageData } = {
    data: { masjid: { slug: 'test-masjid', name: 'Test Masjid' } },
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

const mockPost = {
  id: 'p1',
  masjid_id: 'm1',
  title: 'Ramadan 2026 Announcement',
  slug: 'ramadan-2026',
  compiled_html: '<p>Ramadan starts next week. Prepare your <strong>hearts</strong> and homes.</p>',
  content_markdown: 'Ramadan starts next week...',
  show_on_homepage: false,
  show_on_info: false,
  is_hidden: false,
  created_at: '2026-02-15T10:00:00Z',
  updated_at: '2026-02-15T10:00:00Z',
  masjid_slug: 'test-masjid',
  masjid_name: 'Test Masjid',
};

describe('Post detail page', () => {
  beforeEach(() => {
    cleanup();
    setPageData({ masjid: { slug: 'test-masjid', name: 'Test Masjid' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders post title as heading', () => {
    render(PostDetailPage, {
      props: { data: { post: mockPost } },
    });

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Ramadan 2026 Announcement',
      }),
    ).toBeInTheDocument();
  });

  it('renders compiled_html', () => {
    const { container } = render(PostDetailPage, {
      props: { data: { post: mockPost } },
    });

    const article = container.querySelector('article');
    expect(article).not.toBeNull();
    expect(article!.textContent).toContain(
      'Ramadan starts next week. Prepare your hearts and homes.',
    );
    expect(screen.getByText('hearts')).toBeInTheDocument();
  });

  it('renders date', () => {
    render(PostDetailPage, {
      props: { data: { post: mockPost } },
    });

    expect(screen.getByText('Sunday, February 15, 2026')).toBeInTheDocument();
  });

  it('shows back link to /news', () => {
    render(PostDetailPage, {
      props: { data: { post: mockPost } },
    });

    const backLink = screen.getByRole('link', { name: /Back to News/ });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/test-masjid/news');
  });

  it('has correct page title via svelte:head', () => {
    render(PostDetailPage, {
      props: { data: { post: mockPost } },
    });

    expect(document.title).toBe('Ramadan 2026 Announcement — Test Masjid');
  });

  it('shows fallback text when post has no compiled_html', () => {
    render(PostDetailPage, {
      props: {
        data: {
          post: {
            ...mockPost,
            compiled_html: null,
          },
        },
      },
    });

    expect(screen.getByText('This post has no content.')).toBeInTheDocument();
  });
});