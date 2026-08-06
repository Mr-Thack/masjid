import {
  CreatePostSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { posts, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import { compileMarkdown } from '$lib/server/markdown';
import type { RequestHandler } from './$types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.masjidId, params.id))
      .orderBy(desc(posts.createdAt));

    return JsonResponse({
      posts: rows.map((p) => ({
        id: p.id,
        masjid_id: p.masjidId,
        title: p.title,
        slug: p.slug,
        content_markdown: p.contentMarkdown,
        compiled_html: p.compiledHtml,
        show_on_homepage: p.showOnHomepage,
        show_on_info: p.showOnInfo,
        is_hidden: p.isHidden,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch posts');
  }
};

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = CreatePostSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const generatedSlug = slugify(body.title);
    const compiledHtml = compileMarkdown(body.content_markdown);
    const now = new Date().toISOString();

    if (body.show_on_homepage) {
      await db
        .update(posts)
        .set({ showOnHomepage: false })
        .where(
          and(
            eq(posts.masjidId, params.id),
            eq(posts.showOnHomepage, true),
          ),
        );
    }

    if (body.show_on_info) {
      await db
        .update(posts)
        .set({ showOnInfo: false })
        .where(
          and(
            eq(posts.masjidId, params.id),
            eq(posts.showOnInfo, true),
          ),
        );
    }

    const postId = crypto.randomUUID();
    await db.insert(posts).values({
      id: postId,
      masjidId: params.id,
      title: body.title,
      slug: generatedSlug,
      contentMarkdown: body.content_markdown,
      compiledHtml,
      showOnHomepage: body.show_on_homepage,
      showOnInfo: body.show_on_info,
      isHidden: body.is_hidden,
      createdAt: now,
      updatedAt: now,
    });

    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({
      id: postId,
      masjid_id: params.id,
      title: body.title,
      slug: generatedSlug,
      content_markdown: body.content_markdown,
      compiled_html: compiledHtml,
      show_on_homepage: body.show_on_homepage,
      show_on_info: body.show_on_info,
      is_hidden: body.is_hidden,
      created_at: now,
      updated_at: now,
    }, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create post');
  }
};