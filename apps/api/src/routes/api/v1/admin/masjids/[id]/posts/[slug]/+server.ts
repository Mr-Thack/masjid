import {
  UpdatePostSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { posts, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import { compileMarkdown } from '$lib/server/markdown';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = UpdatePostSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.masjidId, params.id),
          eq(posts.slug, params.slug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Post not found');
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.content_markdown !== undefined) {
      updateData.contentMarkdown = body.content_markdown;
      updateData.compiledHtml = compileMarkdown(body.content_markdown);
    }
    if (body.show_on_homepage !== undefined) updateData.showOnHomepage = body.show_on_homepage;
    if (body.show_on_info !== undefined) updateData.showOnInfo = body.show_on_info;
    if (body.is_hidden !== undefined) updateData.isHidden = body.is_hidden;

    await db
      .update(posts)
      .set(updateData)
      .where(and(eq(posts.masjidId, params.id), eq(posts.slug, params.slug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select()
      .from(posts)
      .where(and(eq(posts.masjidId, params.id), eq(posts.slug, params.slug)))
      .get();

    return JsonResponse({
      id: updated?.id,
      masjid_id: updated?.masjidId,
      title: updated?.title,
      slug: updated?.slug,
      content_markdown: updated?.contentMarkdown,
      compiled_html: updated?.compiledHtml,
      show_on_homepage: updated?.showOnHomepage,
      show_on_info: updated?.showOnInfo,
      is_hidden: updated?.isHidden,
      created_at: updated?.createdAt,
      updated_at: updated?.updatedAt,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update post');
  }
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.masjidId, params.id),
          eq(posts.slug, params.slug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Post not found');
    }

    await db
      .delete(posts)
      .where(and(eq(posts.masjidId, params.id), eq(posts.slug, params.slug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({ success: true });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to delete post');
  }
};