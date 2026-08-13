import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, admins, content } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

import { GET as getAdminContent, POST as postAdminContent } from '../../routes/api/v1/admin/masjids/[id]/content/+server';
import {
  GET as getAdminContentItem,
  PUT as putAdminContent,
  DELETE as deleteAdminContent,
} from '../../routes/api/v1/admin/masjids/[id]/content/[contentSlug]/+server';
import { PUT as putHomepagePin } from '../../routes/api/v1/admin/masjids/[id]/content/[contentSlug]/homepage/+server';
import { PUT as putInfoPin } from '../../routes/api/v1/admin/masjids/[id]/content/[contentSlug]/info/+server';
import { GET as getPublicPosts } from '../../routes/api/v1/masjids/[slug]/posts/+server';
import { GET as getPublicPost } from '../../routes/api/v1/masjids/[slug]/posts/[post_slug]/+server';
import { GET as getPublicPage } from '../../routes/api/v1/masjids/[slug]/pages/[pageSlug]/+server';

let db: ReturnType<typeof getDb>;
let masjidId: string;
let masjidSlug: string;

function createRequest(method: string, path: string, body?: unknown, headers?: Record<string, string>): Request {
  return new Request(new URL(path, 'http://localhost').toString(), {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function adminLocals(masjid_id: string) {
  return {
    admin: { sub: 'test', masjid_id, email: 't@t.com', display_name: 'T' },
  };
}

beforeAll(async () => {
  db = getDb();
  const id = `content-masjid-${Date.now()}`;
  masjidSlug = `content-slug-${Date.now()}`;
  masjidId = id;
  await db.insert(masjids).values({
    id, slug: masjidSlug, name: 'Content Test', latitude: 33, longitude: -84, timezone: 'America/New_York',
  });
  await db.insert(masjidThemes).values({ masjidId: id });
  await db.insert(admins).values({
    id: `content-admin-${Date.now()}`, masjidId: id, email: `a-${Date.now()}@t.com`, passwordHash: 'x',
  });
});

async function seedContent(overrides: Record<string, unknown> = {}) {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const values = {
    id: `c-${tag}`,
    masjidId,
    slug: (overrides.slug as string) ?? `test-${tag}`,
    title: (overrides.title as string) ?? `Test ${tag}`,
    contentMarkdown: (overrides.contentMarkdown as string) ?? '# Hello',
    compiledHtml: (overrides.compiledHtml as string) ?? '<h1>Hello</h1>',
    contentType: (overrides.contentType as string) ?? 'post',
    showOnHomepage: (overrides.showOnHomepage as boolean) ?? false,
    showOnInfo: (overrides.showOnInfo as boolean) ?? false,
    isHidden: (overrides.isHidden as boolean) ?? false,
    createdAt: (overrides.createdAt as string) ?? now,
    updatedAt: (overrides.updatedAt as string) ?? now,
  };
  await db.insert(content).values(values);
  return values;
}

function asJson(res: Response) {
  return res.json();
}

// ── Admin: Create ──────────────────────────────────────────────────────────────

describe('POST /admin/content — create', () => {
  it('creates a post with auto-generated slug', async () => {
    const req = createRequest('POST', `/api/v1/admin/masjids/${masjidId}/content`, {
      title: 'Ramadan Guide',
      content_markdown: '# Ramadan\n\nDetails...',
    });
    const res = await postAdminContent({ params: { id: masjidId }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(res.status).toBe(201);
    expect(body.title).toBe('Ramadan Guide');
    expect(body.slug).toBe('ramadan-guide');
    expect(body.content_type).toBe('post');
    expect(body.compiled_html).toContain('<h1>');
  });

  it('creates a page with admin-chosen slug', async () => {
    const req = createRequest('POST', `/api/v1/admin/masjids/${masjidId}/content`, {
      slug: 'about-us', title: 'About Us', content_markdown: '# About', content_type: 'page',
    });
    const res = await postAdminContent({ params: { id: masjidId }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(res.status).toBe(201);
    expect(body.slug).toBe('about-us');
    expect(body.content_type).toBe('page');
  });

  it('rejects missing markdown', async () => {
    const req = createRequest('POST', `/api/v1/admin/masjids/${masjidId}/content`, { title: 'No markdown' });
    const res = await postAdminContent({ params: { id: masjidId }, request: req, locals: adminLocals(masjidId), platform: {} });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate slug', async () => {
    await seedContent({ slug: 'unique-page', contentType: 'page' });
    const req = createRequest('POST', `/api/v1/admin/masjids/${masjidId}/content`, {
      slug: 'unique-page', title: 'Dup', content_markdown: '# Dup', content_type: 'page',
    });
    const res = await postAdminContent({ params: { id: masjidId }, request: req, locals: adminLocals(masjidId), platform: {} });
    expect(res.status).toBe(409);
  });

  it('pins to homepage, unpinning existing', async () => {
    const old = await seedContent({ showOnHomepage: true });
    const req = createRequest('POST', `/api/v1/admin/masjids/${masjidId}/content`, {
      title: 'New Pin', content_markdown: '# New', show_on_homepage: true,
    });
    await postAdminContent({ params: { id: masjidId }, request: req, locals: adminLocals(masjidId), platform: {} });
    const rows = await db.select().from(content).where(eq(content.masjidId, masjidId));
    const oldRow = rows.find((r) => r.id === old.id);
    expect(oldRow?.showOnHomepage).toBe(false);
  });

  it('requires auth', async () => {
    const req = createRequest('POST', `/api/v1/admin/masjids/${masjidId}/content`, { title: 'X', content_markdown: '# X' });
    const res = await postAdminContent({ params: { id: masjidId }, request: req, locals: {}, platform: {} });
    expect(res.status).toBe(401);
  });
});

// ── Admin: Read ────────────────────────────────────────────────────────────────

describe('GET /admin/content — list', () => {
  it('returns all content', async () => {
    await seedContent({ contentType: 'post' });
    await seedContent({ contentType: 'page' });
    const req = createRequest('GET', `/api/v1/admin/masjids/${masjidId}/content`);
    const res = await getAdminContent({ params: { id: masjidId }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(res.status).toBe(200);
    expect(body.content.length).toBeGreaterThanOrEqual(2);
    expect(body.content.some((c: any) => c.content_type === 'post')).toBe(true);
    expect(body.content.some((c: any) => c.content_type === 'page')).toBe(true);
  });

  it('returns specific content by slug', async () => {
    const c = await seedContent({ slug: 'my-item', title: 'My Item' });
    const req = createRequest('GET', `/api/v1/admin/masjids/${masjidId}/content/my-item`);
    const res = await getAdminContentItem({ params: { id: masjidId, contentSlug: 'my-item' }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(res.status).toBe(200);
    expect(body.title).toBe('My Item');
  });

  it('returns 404 for unknown slug', async () => {
    const req = createRequest('GET', `/api/v1/admin/masjids/${masjidId}/content/nonexistent`);
    const res = await getAdminContentItem({ params: { id: masjidId, contentSlug: 'nonexistent' }, request: req, locals: adminLocals(masjidId), platform: {} });
    expect(res.status).toBe(404);
  });
});

// ── Admin: Update ──────────────────────────────────────────────────────────────

describe('PUT /admin/content/:slug — update', () => {
  it('updates title and content_markdown', async () => {
    const c = await seedContent({ slug: 'edit-me', title: 'Old' });
    const req = createRequest('PUT', `/api/v1/admin/masjids/${masjidId}/content/edit-me`, {
      title: 'New Title', content_markdown: '**updated**',
    });
    const res = await putAdminContent({ params: { id: masjidId, contentSlug: 'edit-me' }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(res.status).toBe(200);
    expect(body.title).toBe('New Title');
    expect(body.content_markdown).toBe('**updated**');
    expect(body.compiled_html).toContain('<strong>');
  });

  it('updates content_type', async () => {
    const c = await seedContent({ slug: 'convert-me', contentType: 'post' });
    const req = createRequest('PUT', `/api/v1/admin/masjids/${masjidId}/content/convert-me`, { content_type: 'page' });
    const res = await putAdminContent({ params: { id: masjidId, contentSlug: 'convert-me' }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(body.content_type).toBe('page');
  });

  it('updates slug', async () => {
    await seedContent({ slug: 'old-slug', title: 'Old' });
    const req = createRequest('PUT', `/api/v1/admin/masjids/${masjidId}/content/old-slug`, { slug: 'new-slug' });
    const res = await putAdminContent({ params: { id: masjidId, contentSlug: 'old-slug' }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(body.slug).toBe('new-slug');
  });

  it('returns 404 for nonexistent', async () => {
    const req = createRequest('PUT', `/api/v1/admin/masjids/${masjidId}/content/no-such`, { title: 'X' });
    const res = await putAdminContent({ params: { id: masjidId, contentSlug: 'no-such' }, request: req, locals: adminLocals(masjidId), platform: {} });
    expect(res.status).toBe(404);
  });
});

// ── Admin: Delete ──────────────────────────────────────────────────────────────

describe('DELETE /admin/content/:slug — delete', () => {
  it('deletes content', async () => {
    const c = await seedContent({ slug: 'delete-me' });
    const req = createRequest('DELETE', `/api/v1/admin/masjids/${masjidId}/content/delete-me`);
    const res = await deleteAdminContent({ params: { id: masjidId, contentSlug: 'delete-me' }, request: req, locals: adminLocals(masjidId), platform: {} });
    expect(res.status).toBe(204);

    const rows = await db.select().from(content).where(eq(content.id, c.id));
    expect(rows).toHaveLength(0);
  });

  it('returns 404 for nonexistent', async () => {
    const req = createRequest('DELETE', `/api/v1/admin/masjids/${masjidId}/content/no-such`);
    const res = await deleteAdminContent({ params: { id: masjidId, contentSlug: 'no-such' }, request: req, locals: adminLocals(masjidId), platform: {} });
    expect(res.status).toBe(404);
  });
});

// ── Admin: Pin Toggles ─────────────────────────────────────────────────────────

describe('PUT /admin/content/:slug/homepage — toggle homepage', () => {
  it('toggles homepage pin on', async () => {
    const c = await seedContent({ slug: 'pin-hp', showOnHomepage: false });
    const req = createRequest('PUT', `/api/v1/admin/masjids/${masjidId}/content/pin-hp/homepage`, {});
    const res = await putHomepagePin({ params: { id: masjidId, contentSlug: 'pin-hp' }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(body.show_on_homepage).toBe(true);
  });

  it('unpins existing when pinning new', async () => {
    const tag = Date.now();
    const old = await seedContent({ slug: `old-pin-${tag}`, showOnHomepage: true });
    const c = await seedContent({ slug: `new-pin-${tag}`, showOnHomepage: false });
    const req = createRequest('PUT', `/api/v1/admin/masjids/${masjidId}/content/${c.slug}/homepage`, {});
    await putHomepagePin({ params: { id: masjidId, contentSlug: c.slug }, request: req, locals: adminLocals(masjidId), platform: {} });

    const rows = await db.select().from(content).where(eq(content.masjidId, masjidId));
    const oldRow = rows.find((r) => r.id === old.id);
    expect(oldRow?.showOnHomepage).toBe(false);
  });
});

describe('PUT /admin/content/:slug/info — toggle info', () => {
  it('toggles info pin on', async () => {
    const c = await seedContent({ slug: 'pin-info', showOnInfo: false });
    const req = createRequest('PUT', `/api/v1/admin/masjids/${masjidId}/content/pin-info/info`, {});
    const res = await putInfoPin({ params: { id: masjidId, contentSlug: 'pin-info' }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(body.show_on_info).toBe(true);
  });

  it('unpins existing when pinning new', async () => {
    await seedContent({ slug: 'old-info', showOnInfo: true });
    const req = createRequest('PUT', `/api/v1/admin/masjids/${masjidId}/content/old-info/info`, {});
    const res = await putInfoPin({ params: { id: masjidId, contentSlug: 'old-info' }, request: req, locals: adminLocals(masjidId), platform: {} });
    const body = await asJson(res);
    expect(body.show_on_info).toBe(false);
  });
});

// ── Public: Backward Compat ────────────────────────────────────────────────────

describe('Public endpoints — backward compat', () => {
  it('GET /posts lists non-hidden posts', async () => {
    await seedContent({ slug: 'visible-post', isHidden: false, contentType: 'post' });
    await seedContent({ slug: 'hidden-post', isHidden: true, contentType: 'post' });
    await seedContent({ slug: 'a-page', contentType: 'page' });

    const req = createRequest('GET', `/api/v1/masjids/${masjidSlug}/posts`);
    const res = await getPublicPosts({ params: { slug: masjidSlug }, platform: {} });
    const body = await asJson(res);
    expect(res.status).toBe(200);
    expect(body.posts.length).toBeGreaterThanOrEqual(1);
    expect(body.posts.every((p: any) => p.slug !== 'hidden-post')).toBe(true);
    expect(body.posts.every((p: any) => p.slug !== 'a-page')).toBe(true);
  });

  it('GET /posts/:slug returns a single post', async () => {
    const c = await seedContent({ slug: 'one-post', title: 'One Post', contentType: 'post' });
    const req = createRequest('GET', `/api/v1/masjids/${masjidSlug}/posts/one-post`);
    const res = await getPublicPost({ params: { slug: masjidSlug, post_slug: 'one-post' }, platform: {} });
    const body = await asJson(res);
    expect(res.status).toBe(200);
    expect(body.title).toBe('One Post');
    expect(body.content_markdown).toBe('# Hello');
  });

  it('GET /posts/:slug returns 404 for hidden post', async () => {
    await seedContent({ slug: 'secret', isHidden: true, contentType: 'post' });
    const req = createRequest('GET', `/api/v1/masjids/${masjidSlug}/posts/secret`);
    const res = await getPublicPost({ params: { slug: masjidSlug, post_slug: 'secret' }, platform: {} });
    expect(res.status).toBe(404);
  });

  it('GET /posts/:slug returns 404 for page (not a post)', async () => {
    await seedContent({ slug: 'not-a-post', contentType: 'page' });
    const req = createRequest('GET', `/api/v1/masjids/${masjidSlug}/posts/not-a-post`);
    const res = await getPublicPost({ params: { slug: masjidSlug, post_slug: 'not-a-post' }, platform: {} });
    expect(res.status).toBe(404);
  });

  it('GET /pages/:slug returns a page', async () => {
    const c = await seedContent({ slug: 'info-page', title: 'Info Page', contentType: 'page' });
    const req = createRequest('GET', `/api/v1/masjids/${masjidSlug}/pages/info-page`);
    const res = await getPublicPage({ params: { slug: masjidSlug, pageSlug: 'info-page' }, platform: {} });
    const body = await asJson(res);
    expect(res.status).toBe(200);
    expect(body.title).toBe('Info Page');
    expect(body.compiled_html).toContain('<h1>');
  });

  it('GET /pages/:slug returns 404 for post (not a page)', async () => {
    await seedContent({ slug: 'not-a-page', contentType: 'post' });
    const req = createRequest('GET', `/api/v1/masjids/${masjidSlug}/pages/not-a-page`);
    const res = await getPublicPage({ params: { slug: masjidSlug, pageSlug: 'not-a-page' }, platform: {} });
    expect(res.status).toBe(404);
  });

  it('GET /pages/:slug returns 404 for nonexistent', async () => {
    const req = createRequest('GET', `/api/v1/masjids/${masjidSlug}/pages/nonexistent`);
    const res = await getPublicPage({ params: { slug: masjidSlug, pageSlug: 'nonexistent' }, platform: {} });
    expect(res.status).toBe(404);
  });
});