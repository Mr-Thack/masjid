import {
  UpdateContentSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { content, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import { compileMarkdown } from '$lib/server/markdown';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);
    const item = await db
      .select()
      .from(content)
      .where(
        and(
          eq(content.masjidId, params.id),
          eq(content.slug, params.contentSlug),
        ),
      )
      .get();

    if (!item) {
      return ErrorJsonResponse('NOT_FOUND', 'Content not found');
    }

    return JsonResponse({
      id: item.id,
      masjid_id: item.masjidId,
      title: item.title,
      slug: item.slug,
      content_markdown: item.contentMarkdown,
      compiled_html: item.compiledHtml,
      content_type: item.contentType,
      show_on_homepage: item.showOnHomepage,
      show_on_info: item.showOnInfo,
      is_hidden: item.isHidden,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch content');
  }
};

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = UpdateContentSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(content)
      .where(
        and(
          eq(content.masjidId, params.id),
          eq(content.slug, params.contentSlug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Content not found');
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.content_markdown !== undefined) {
      updateData.contentMarkdown = body.content_markdown;
      updateData.compiledHtml = compileMarkdown(body.content_markdown);
    }
    if (body.content_type !== undefined) updateData.contentType = body.content_type;
    if (body.show_on_homepage !== undefined) updateData.showOnHomepage = body.show_on_homepage;
    if (body.show_on_info !== undefined) updateData.showOnInfo = body.show_on_info;
    if (body.is_hidden !== undefined) updateData.isHidden = body.is_hidden;

    await db
      .update(content)
      .set(updateData)
      .where(and(eq(content.masjidId, params.id), eq(content.slug, params.contentSlug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select()
      .from(content)
      .where(and(eq(content.masjidId, params.id), eq(content.slug, (body.slug ?? params.contentSlug))))
      .get();

    return JsonResponse({
      id: updated?.id,
      masjid_id: updated?.masjidId,
      title: updated?.title,
      slug: updated?.slug,
      content_markdown: updated?.contentMarkdown,
      compiled_html: updated?.compiledHtml,
      content_type: updated?.contentType,
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
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update content');
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
      .from(content)
      .where(
        and(
          eq(content.masjidId, params.id),
          eq(content.slug, params.contentSlug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Content not found');
    }

    await db
      .delete(content)
      .where(and(eq(content.masjidId, params.id), eq(content.slug, params.contentSlug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return new Response(null, { status: 204 });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to delete content');
  }
};