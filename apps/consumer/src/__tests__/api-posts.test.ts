import { describe, it, expect, vi } from 'vitest';
import { fetchPosts, fetchPost, BASE } from '$lib/api';

function mockFetch(data: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('fetchPosts', () => {
  it('calls the correct URL', async () => {
    const fake = mockFetch({
      masjid_slug: 'test',
      masjid_name: 'Test',
      posts: [],
    });
    await fetchPosts('test-masjid', fake);
    expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test-masjid/posts');
  });

  it('returns posts data', async () => {
    const postsPayload = {
      masjid_slug: 'test-masjid',
      masjid_name: 'Test Masjid',
      posts: [
        {
          id: 'p1',
          masjid_id: 'm1',
          title: 'Ramadan 2026',
          slug: 'ramadan-2026',
          compiled_html: '<p>Ramadan starts next week.</p>',
          content_markdown: 'Ramadan starts next week...',
          show_on_homepage: false,
          show_on_info: false,
          is_hidden: false,
          created_at: '2026-02-15T10:00:00Z',
          updated_at: '2026-02-15T10:00:00Z',
        },
        {
          id: 'p2',
          masjid_id: 'm1',
          title: 'Eid Festival',
          slug: 'eid-festival',
          compiled_html: null,
          content_markdown: undefined,
          show_on_homepage: true,
          show_on_info: false,
          is_hidden: false,
          created_at: '2026-06-20T12:00:00Z',
          updated_at: '2026-06-20T12:00:00Z',
        },
      ],
    };
    const fake = mockFetch(postsPayload);
    const result = await fetchPosts('test-masjid', fake);

    expect(result).toEqual(postsPayload);
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0]!.title).toBe('Ramadan 2026');
    expect(result.posts[1]!.title).toBe('Eid Festival');
  });

  it('throws on non-ok response', async () => {
    const fake = mockFetch({}, false, 500);
    await expect(fetchPosts('bad', fake)).rejects.toThrow(
      'Failed to fetch posts: 500',
    );
  });

  it('throws on 404 response', async () => {
    const fake = mockFetch({}, false, 404);
    await expect(fetchPosts('nonexistent', fake)).rejects.toThrow(
      'Failed to fetch posts: 404',
    );
  });
});

describe('fetchPost', () => {
  it('calls the correct URL with post slug', async () => {
    const fake = mockFetch({
      id: 'p1',
      masjid_id: 'm1',
      title: 'Ramadan 2026',
      slug: 'ramadan-2026',
      compiled_html: '<p>Ramadan starts next week.</p>',
      created_at: '2026-02-15T10:00:00Z',
      updated_at: '2026-02-15T10:00:00Z',
      show_on_homepage: false,
      show_on_info: false,
      is_hidden: false,
      masjid_slug: 'test-masjid',
      masjid_name: 'Test Masjid',
    });
    await fetchPost('test-masjid', 'ramadan-2026', fake);
    expect(fake).toHaveBeenCalledWith(
      '/api/v1/masjids/test-masjid/posts/ramadan-2026',
    );
  });

  it('returns a single post', async () => {
    const postData = {
      id: 'p1',
      masjid_id: 'm1',
      title: 'Youth Program',
      slug: 'youth-program',
      compiled_html: '<p>Enroll your kids in our weekend youth program.</p>',
      content_markdown: 'Enroll your kids...',
      show_on_homepage: true,
      show_on_info: false,
      is_hidden: false,
      created_at: '2026-03-01T08:00:00Z',
      updated_at: '2026-03-01T08:00:00Z',
      masjid_slug: 'test-masjid',
      masjid_name: 'Test Masjid',
    };
    const fake = mockFetch(postData);
    const result = await fetchPost('test-masjid', 'youth-program', fake);

    expect(result).toEqual(postData);
    expect(result.title).toBe('Youth Program');
    expect(result.slug).toBe('youth-program');
    expect(result.compiled_html).toBe(
      '<p>Enroll your kids in our weekend youth program.</p>',
    );
    expect(result.masjid_slug).toBe('test-masjid');
  });

  it('throws on 404', async () => {
    const fake = mockFetch({}, false, 404);
    await expect(
      fetchPost('test-masjid', 'no-such-post', fake),
    ).rejects.toThrow('Failed to fetch post: 404');
  });

  it('throws on server error', async () => {
    const fake = mockFetch({}, false, 500);
    await expect(
      fetchPost('test-masjid', 'broken', fake),
    ).rejects.toThrow('Failed to fetch post: 500');
  });

  it('uses globalThis.fetch when no custom fetch provided', async () => {
    const postsPayload = {
      masjid_slug: 'test-masjid',
      masjid_name: 'Test Masjid',
      posts: [],
    };
    const originalFetch = globalThis.fetch;
    const fake = mockFetch(postsPayload);
    globalThis.fetch = fake;

    try {
      await fetchPosts('test-masjid');
      expect(fake).toHaveBeenCalledWith('/api/v1/masjids/test-masjid/posts');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});