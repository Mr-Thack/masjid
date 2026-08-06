import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, admins, posts } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { GET as getPublicPosts } from '../../routes/api/v1/masjids/[slug]/posts/+server';
import { GET as getPublicPost } from '../../routes/api/v1/masjids/[slug]/posts/[post_slug]/+server';
import { GET as getPagePayload } from '../../routes/api/v1/masjids/[slug]/+server';
import { GET as getAdminPosts, POST as postAdminPosts } from '../../routes/api/v1/admin/masjids/[id]/posts/+server';
import {
  PUT as putAdminPost,
  DELETE as deleteAdminPost,
} from '../../routes/api/v1/admin/masjids/[id]/posts/[slug]/+server';
import { PUT as putHomepage } from '../../routes/api/v1/admin/masjids/[id]/posts/[slug]/homepage/+server';
import { PUT as putInfo } from '../../routes/api/v1/admin/masjids/[id]/posts/[slug]/info/+server';
import { compileMarkdown } from '$lib/server/markdown';

let db: ReturnType<typeof getDb>;

function createRequest(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request(new URL(path, 'http://localhost').toString(), {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function adminLocals(masjidId: string) {
  return {
    admin: {
      sub: 'admin-test',
      masjid_id: masjidId,
      email: 'admin@example.com',
      display_name: 'Test Admin',
    },
  };
}

async function seedMasjid(suffix: string) {
  const id = `post-masjid-${suffix}-${Date.now()}`;
  const slug = `post-slug-${suffix}-${Date.now()}`;
  const adminEmail = `post-admin-${suffix}-${Date.now()}@example.com`;
  await db.insert(masjids).values({
    id,
    slug,
    name: 'Post Test Masjid',
    latitude: 33.9,
    longitude: -84.6,
    timezone: 'America/New_York',
  });
  await db.insert(masjidThemes).values({ masjidId: id });
  await db.insert(admins).values({
    id: `post-admin-${suffix}-${Date.now()}`,
    masjidId: id,
    email: adminEmail,
    passwordHash: 'unused',
  });
  return { id, slug };
}

async function seedPost(masjidId: string, overrides: Record<string, unknown> = {}) {
  const tag = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const id = `post-${tag}`;
  const now = new Date().toISOString();
  await db.insert(posts).values({
    id,
    masjidId,
    slug: (overrides.slug as string) ?? `post-slug-${tag}`,
    title: (overrides.title as string) ?? `Test Post ${tag}`,
    contentMarkdown: (overrides.content_markdown as string) ?? 'Hello **world**',
    compiledHtml: (overrides.compiled_html as string) ?? '<p>Hello <strong>world</strong></p>',
    showOnHomepage: (overrides.show_on_homepage as boolean) ?? false,
    showOnInfo: (overrides.show_on_info as boolean) ?? false,
    isHidden: (overrides.is_hidden as boolean) ?? false,
    createdAt: (overrides.created_at as string) ?? now,
    updatedAt: (overrides.updated_at as string) ?? now,
  });
  return { id, slug: (overrides.slug as string) ?? `post-slug-${tag}`, title: (overrides.title as string) ?? `Test Post ${tag}` };
}

beforeAll(() => {
  db = getDb();
});

// =============================================================================
// Public: GET /api/v1/masjids/{slug}/posts
// =============================================================================
describe('GET /api/v1/masjids/{slug}/posts', () => {
  it('returns empty array when no posts exist', async () => {
    const { slug } = await seedMasjid('empty');
    const req = createRequest('GET', `/api/v1/masjids/${slug}/posts`);
    const res = await getPublicPosts({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toEqual([]);
    expect(body.masjid_slug).toBe(slug);
  });

  it('returns only non-hidden posts', async () => {
    const { id, slug } = await seedMasjid('list');
    await seedPost(id, { title: 'Visible Post', is_hidden: false });
    await seedPost(id, { title: 'Hidden Post', is_hidden: true });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/posts`);
    const res = await getPublicPosts({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].title).toBe('Visible Post');
  });

  it('orders posts by created_at DESC (newest first)', async () => {
    const { id, slug } = await seedMasjid('order');
    const now = Date.now();
    await seedPost(id, {
      title: 'Oldest',
      slug: `old-${now}`,
      created_at: new Date(now - 2000).toISOString(),
    });
    await seedPost(id, {
      title: 'Newest',
      slug: `new-${now}`,
      created_at: new Date(now - 1000).toISOString(),
    });
    await seedPost(id, {
      title: 'Middle',
      slug: `mid-${now}`,
      created_at: new Date(now - 3000).toISOString(),
    });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/posts`);
    const res = await getPublicPosts({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toHaveLength(3);
    expect(body.posts[0].title).toBe('Newest');
    expect(body.posts[1].title).toBe('Oldest');
    expect(body.posts[2].title).toBe('Middle');
  });

  it('returns 404 for unknown masjid', async () => {
    const req = createRequest('GET', '/api/v1/masjids/nonexistent-masjid/posts');
    const res = await getPublicPosts({
      params: { slug: 'nonexistent-masjid' },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// Public: GET /api/v1/masjids/{slug}/posts/{post_slug}
// =============================================================================
describe('GET /api/v1/masjids/{slug}/posts/{post_slug}', () => {
  it('returns a single post by slug', async () => {
    const { id, slug } = await seedMasjid('single');
    const post = await seedPost(id, {
      title: 'My Blog Post',
      slug: 'my-blog-post',
      content_markdown: '# Hello\n\nWorld',
      compiled_html: '<h1>Hello</h1><p>World</p>',
    });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/posts/my-blog-post`);
    const res = await getPublicPost({
      params: { slug, post_slug: 'my-blog-post' },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('My Blog Post');
    expect(body.slug).toBe('my-blog-post');
    expect(body.content_markdown).toBe('# Hello\n\nWorld');
    expect(body.compiled_html).toBe('<h1>Hello</h1><p>World</p>');
    expect(body.masjid_slug).toBe(slug);
  });

  it('returns 404 for hidden posts', async () => {
    const { id, slug } = await seedMasjid('hidden');
    await seedPost(id, {
      title: 'Secret',
      slug: 'secret-post',
      is_hidden: true,
    });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/posts/secret-post`);
    const res = await getPublicPost({
      params: { slug, post_slug: 'secret-post' },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent post slug', async () => {
    const { slug } = await seedMasjid('nopost');

    const req = createRequest('GET', `/api/v1/masjids/${slug}/posts/nope`);
    const res = await getPublicPost({
      params: { slug, post_slug: 'nope' },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// Page payload: homepage_post + info_post
// =============================================================================
describe('page payload — homepage_post', () => {
  it('includes homepage_post when a post has show_on_homepage=true and is not hidden', async () => {
    const { id, slug } = await seedMasjid('hp-visible');
    await seedPost(id, {
      title: 'Homepage Hero',
      slug: 'hp-hero',
      show_on_homepage: true,
      is_hidden: false,
      compiled_html: '<p>Hero content</p>',
    });

    const req = createRequest('GET', `/api/v1/masjids/${slug}`);
    const res = await getPagePayload({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.homepage_post).not.toBeNull();
    expect(body.homepage_post.title).toBe('Homepage Hero');
    expect(body.homepage_post.slug).toBe('hp-hero');
    expect(body.homepage_post.compiled_html).toBe('<p>Hero content</p>');
  });

  it('homepage_post is null when no post is pinned', async () => {
    const { slug } = await seedMasjid('hp-none');
    const req = createRequest('GET', `/api/v1/masjids/${slug}`);
    const res = await getPagePayload({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.homepage_post).toBeNull();
  });

  it('homepage_post is null when pinned post is hidden', async () => {
    const { id, slug } = await seedMasjid('hp-hidden');
    await seedPost(id, {
      title: 'Hidden HP',
      slug: 'hidden-hp',
      show_on_homepage: true,
      is_hidden: true,
    });

    const req = createRequest('GET', `/api/v1/masjids/${slug}`);
    const res = await getPagePayload({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.homepage_post).toBeNull();
  });
});

describe('page payload — info_post', () => {
  it('includes info_post when a post has show_on_info=true and is not hidden', async () => {
    const { id, slug } = await seedMasjid('info-visible');
    await seedPost(id, {
      title: 'Info Page Content',
      slug: 'info-content',
      show_on_info: true,
      is_hidden: false,
      compiled_html: '<p>Info stuff</p>',
    });

    const req = createRequest('GET', `/api/v1/masjids/${slug}`);
    const res = await getPagePayload({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.info_post).not.toBeNull();
    expect(body.info_post.title).toBe('Info Page Content');
    expect(body.info_post.slug).toBe('info-content');
    expect(body.info_post.compiled_html).toBe('<p>Info stuff</p>');
  });

  it('info_post is null when no post is pinned', async () => {
    const { slug } = await seedMasjid('info-none');
    const req = createRequest('GET', `/api/v1/masjids/${slug}`);
    const res = await getPagePayload({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.info_post).toBeNull();
  });

  it('info_post is null when pinned post is hidden', async () => {
    const { id, slug } = await seedMasjid('info-hidden');
    await seedPost(id, {
      title: 'Hidden Info',
      slug: 'hidden-info',
      show_on_info: true,
      is_hidden: true,
    });

    const req = createRequest('GET', `/api/v1/masjids/${slug}`);
    const res = await getPagePayload({
      params: { slug },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.info_post).toBeNull();
  });
});

// =============================================================================
// Admin: auth checks
// =============================================================================
describe('admin posts endpoints — auth', () => {
  it('returns 401 when no admin is authenticated', async () => {
    const { id } = await seedMasjid('noauth');
    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/posts`);
    const res = await getAdminPosts({
      params: { id },
      request: req,
      url: new URL(req.url),
      locals: {},
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when admin tries to access another masjid', async () => {
    const { id: myId } = await seedMasjid('mine');
    const { id: otherId } = await seedMasjid('theirs');
    const req = createRequest('GET', `/api/v1/admin/masjids/${otherId}/posts`);
    const res = await getAdminPosts({
      params: { id: otherId },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(myId),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// Admin: CRUD
// =============================================================================
describe('admin posts CRUD', () => {
  it('GET returns all posts including hidden', async () => {
    const { id } = await seedMasjid('adminlist');
    await seedPost(id, { title: 'Visible', is_hidden: false });
    await seedPost(id, { title: 'Hidden', is_hidden: true });

    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/posts`);
    const res = await getAdminPosts({
      params: { id },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toHaveLength(2);
    const titles = body.posts.map((p: any) => p.title).sort();
    expect(titles).toContain('Visible');
    expect(titles).toContain('Hidden');
  });

  it('POST creates a post and compiles markdown to HTML', async () => {
    const { id } = await seedMasjid('create');
    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/posts`, {
      title: 'Hello World',
      content_markdown: '**bold** and *italic*',
    });
    const res = await postAdminPosts({
      params: { id },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Hello World');
    expect(body.slug).toBe('hello-world');
    expect(body.content_markdown).toBe('**bold** and *italic*');
    expect(body.compiled_html).toBe('<p><strong>bold</strong> and <em>italic</em></p>');
    expect(body.show_on_homepage).toBe(false);
    expect(body.show_on_info).toBe(false);
    expect(body.is_hidden).toBe(false);
    expect(body.created_at).toBeDefined();
    expect(body.updated_at).toBeDefined();
  });

  it('POST slugs the title', async () => {
    const { id } = await seedMasjid('slugify');
    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/posts`, {
      title: '  My Amazing Blog Post!  ',
      content_markdown: 'Content',
    });
    const res = await postAdminPosts({
      params: { id },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe('-my-amazing-blog-post-');
  });

  it('POST returns 400 for missing required fields', async () => {
    const { id } = await seedMasjid('validation');

    const req1 = createRequest('POST', `/api/v1/admin/masjids/${id}/posts`, {
      content_markdown: 'Missing title',
    });
    const res1 = await postAdminPosts({
      params: { id },
      request: req1,
      url: new URL(req1.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res1.status).toBe(400);

    const req2 = createRequest('POST', `/api/v1/admin/masjids/${id}/posts`, {
      title: 'Missing content',
    });
    const res2 = await postAdminPosts({
      params: { id },
      request: req2,
      url: new URL(req2.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res2.status).toBe(400);
  });

  it('POST auto-unpins existing homepage-pinned post when show_on_homepage=true', async () => {
    const { id } = await seedMasjid('unpin-hp');
    const oldPost = await seedPost(id, {
      title: 'Old Homepage',
      slug: 'old-homepage',
      show_on_homepage: true,
    });

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/posts`, {
      title: 'New Homepage',
      content_markdown: 'Fresh content',
      show_on_homepage: true,
    });
    const res = await postAdminPosts({
      params: { id },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.show_on_homepage).toBe(true);

    const oldRow = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'old-homepage')))
      .get();
    expect(oldRow?.showOnHomepage).toBe(false);
  });

  it('POST auto-unpins existing info-pinned post when show_on_info=true', async () => {
    const { id } = await seedMasjid('unpin-info');
    await seedPost(id, {
      title: 'Old Info',
      slug: 'old-info',
      show_on_info: true,
    });

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/posts`, {
      title: 'New Info',
      content_markdown: 'Fresh info',
      show_on_info: true,
    });
    const res = await postAdminPosts({
      params: { id },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.show_on_info).toBe(true);

    const oldRow = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'old-info')))
      .get();
    expect(oldRow?.showOnInfo).toBe(false);
  });

  it('PUT updates post fields', async () => {
    const { id } = await seedMasjid('update');
    const post = await seedPost(id, {
      title: 'Original Title',
      slug: 'original-slug',
      content_markdown: 'Original',
      compiled_html: '<p>Original</p>',
      is_hidden: false,
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/original-slug`, {
      title: 'Updated Title',
      is_hidden: true,
    });
    const res = await putAdminPost({
      params: { id, slug: 'original-slug' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated Title');
    expect(body.is_hidden).toBe(true);
    // content didn't change, so compiled_html should stay the same
    expect(body.compiled_html).toBe('<p>Original</p>');
  });

  it('PUT re-compiles HTML when content_markdown changes', async () => {
    const { id } = await seedMasjid('recompile');
    await seedPost(id, {
      title: 'Recompile Me',
      slug: 'recompile-me',
      content_markdown: 'Old',
      compiled_html: '<p>Old</p>',
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/recompile-me`, {
      content_markdown: '**New** content',
    });
    const res = await putAdminPost({
      params: { id, slug: 'recompile-me' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content_markdown).toBe('**New** content');
    expect(body.compiled_html).toBe('<p><strong>New</strong> content</p>');
  });

  it('PUT returns 404 for non-existent post', async () => {
    const { id } = await seedMasjid('put404');
    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/ghost`, {
      title: 'Nope',
    });
    const res = await putAdminPost({
      params: { id, slug: 'ghost' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(404);
  });

  it('DELETE hard-deletes a post', async () => {
    const { id } = await seedMasjid('delete');
    await seedPost(id, { title: 'To Delete', slug: 'to-delete' });

    const req = createRequest('DELETE', `/api/v1/admin/masjids/${id}/posts/to-delete`);
    const res = await deleteAdminPost({
      params: { id, slug: 'to-delete' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const row = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'to-delete')))
      .get();
    expect(row).toBeUndefined();
  });

  it('DELETE returns 404 for non-existent post', async () => {
    const { id } = await seedMasjid('delete404');
    const req = createRequest('DELETE', `/api/v1/admin/masjids/${id}/posts/ghost`);
    const res = await deleteAdminPost({
      params: { id, slug: 'ghost' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// Admin: pin toggles
// =============================================================================
describe('admin posts pin toggles', () => {
  it('PUT /homepage toggles show_on_homepage on', async () => {
    const { id } = await seedMasjid('hp-on');
    await seedPost(id, {
      title: 'Toggle Me',
      slug: 'toggle-me',
      show_on_homepage: false,
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/toggle-me/homepage`);
    const res = await putHomepage({
      params: { id, slug: 'toggle-me' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.show_on_homepage).toBe(true);

    const row = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'toggle-me')))
      .get();
    expect(row?.showOnHomepage).toBe(true);
  });

  it('PUT /homepage toggles show_on_homepage off', async () => {
    const { id } = await seedMasjid('hp-off');
    await seedPost(id, {
      title: 'Toggle Off',
      slug: 'toggle-off',
      show_on_homepage: true,
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/toggle-off/homepage`);
    const res = await putHomepage({
      params: { id, slug: 'toggle-off' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.show_on_homepage).toBe(false);

    const row = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'toggle-off')))
      .get();
    expect(row?.showOnHomepage).toBe(false);
  });

  it('PUT /homepage unpins previous when toggling new post on', async () => {
    const { id } = await seedMasjid('hp-swap');
    await seedPost(id, {
      title: 'Old Pinned',
      slug: 'old-pinned',
      show_on_homepage: true,
    });
    await seedPost(id, {
      title: 'New Post',
      slug: 'new-post',
      show_on_homepage: false,
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/new-post/homepage`);
    const res = await putHomepage({
      params: { id, slug: 'new-post' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);

    const oldRow = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'old-pinned')))
      .get();
    expect(oldRow?.showOnHomepage).toBe(false);

    const newRow = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'new-post')))
      .get();
    expect(newRow?.showOnHomepage).toBe(true);
  });

  it('PUT /info toggles show_on_info on', async () => {
    const { id } = await seedMasjid('info-on');
    await seedPost(id, {
      title: 'Info Toggle',
      slug: 'info-toggle',
      show_on_info: false,
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/info-toggle/info`);
    const res = await putInfo({
      params: { id, slug: 'info-toggle' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.show_on_info).toBe(true);

    const row = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'info-toggle')))
      .get();
    expect(row?.showOnInfo).toBe(true);
  });

  it('PUT /info toggles show_on_info off', async () => {
    const { id } = await seedMasjid('info-off');
    await seedPost(id, {
      title: 'Info Off',
      slug: 'info-off',
      show_on_info: true,
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/info-off/info`);
    const res = await putInfo({
      params: { id, slug: 'info-off' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.show_on_info).toBe(false);

    const row = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'info-off')))
      .get();
    expect(row?.showOnInfo).toBe(false);
  });

  it('PUT /info unpins previous when toggling new post on', async () => {
    const { id } = await seedMasjid('info-swap');
    await seedPost(id, {
      title: 'Old Info Pinned',
      slug: 'old-info-pinned',
      show_on_info: true,
    });
    await seedPost(id, {
      title: 'New Info Post',
      slug: 'new-info-post',
      show_on_info: false,
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/new-info-post/info`);
    const res = await putInfo({
      params: { id, slug: 'new-info-post' },
      request: req,
      url: new URL(req.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);

    const oldRow = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'old-info-pinned')))
      .get();
    expect(oldRow?.showOnInfo).toBe(false);

    const newRow = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, id), eq(posts.slug, 'new-info-post')))
      .get();
    expect(newRow?.showOnInfo).toBe(true);
  });

  it('pin endpoints return 404 for non-existent post', async () => {
    const { id } = await seedMasjid('pin404');

    const reqHp = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/ghost/homepage`);
    const resHp = await putHomepage({
      params: { id, slug: 'ghost' },
      request: reqHp,
      url: new URL(reqHp.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(resHp.status).toBe(404);

    const reqInfo = createRequest('PUT', `/api/v1/admin/masjids/${id}/posts/ghost/info`);
    const resInfo = await putInfo({
      params: { id, slug: 'ghost' },
      request: reqInfo,
      url: new URL(reqInfo.url),
      locals: adminLocals(id),
      platform: { env: {} },
      cookies: {} as any,
      fetch: globalThis.fetch,
    } as any);
    expect(resInfo.status).toBe(404);
  });
});

// =============================================================================
// Markdown compilation
// =============================================================================
describe('markdown compilation', () => {
  it('compiles bold, italic, and links', () => {
    const html = compileMarkdown('This is **bold** and *italic* and [a link](https://example.com)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<a href="https://example.com">a link</a>');
  });

  it('compiles headings', () => {
    const html = compileMarkdown('# Heading 1\n## Heading 2\n### Heading 3');
    expect(html).toContain('<h1>Heading 1</h1>');
    expect(html).toContain('<h2>Heading 2</h2>');
    expect(html).toContain('<h3>Heading 3</h3>');
  });

  it('compiles horizontal rules', () => {
    const html1 = compileMarkdown('---');
    expect(html1).toContain('<hr>');

    const html2 = compileMarkdown('***');
    expect(html2).toContain('<hr>');

    const html3 = compileMarkdown('___');
    expect(html3).toContain('<hr>');
  });

  it('auto-wraps text in paragraphs', () => {
    const html = compileMarkdown('First paragraph.\n\nSecond paragraph.');
    expect(html).toBe('<p>First paragraph.</p><p>Second paragraph.</p>');
  });

  it('handles mixed content with paragraphs, headings, and formatting', () => {
    const html = compileMarkdown('# Title\n\nSome **bold** text.\n\nAnother para with *italic*.');
    expect(html).toBe(
      '<h1>Title</h1><p>Some <strong>bold</strong> text.</p><p>Another para with <em>italic</em>.</p>',
    );
  });

  it('handles horizontal rule between paragraphs', () => {
    const html = compileMarkdown('Before.\n\n---\n\nAfter.');
    expect(html).toBe('<p>Before.</p><hr><p>After.</p>');
  });
});