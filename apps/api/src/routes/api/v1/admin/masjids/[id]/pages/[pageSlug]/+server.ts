import {
  UpdatePageSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjidPages, masjids as masjidsTable } from '$lib/server/db/schema';
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
    const page = await db
      .select()
      .from(masjidPages)
      .where(
        and(
          eq(masjidPages.masjidId, params.id),
          eq(masjidPages.slug, params.pageSlug),
        ),
      )
      .get();

    if (!page) {
      return ErrorJsonResponse('NOT_FOUND', 'Page not found');
    }

    return JsonResponse({
      id: page.id,
      masjid_id: page.masjidId,
      slug: page.slug,
      title: page.title,
      compiled_html: page.compiledHtml,
      raw_markdown: page.rawMarkdown,
      last_updated: page.lastUpdated,
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch page');
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
    const body = UpdatePageSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(masjidPages)
      .where(
        and(
          eq(masjidPages.masjidId, params.id),
          eq(masjidPages.slug, params.pageSlug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Page not found');
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { lastUpdated: now };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.raw_markdown !== undefined) {
      updateData.rawMarkdown = body.raw_markdown;
      updateData.compiledHtml = compileMarkdown(body.raw_markdown);
    }

    await db
      .update(masjidPages)
      .set(updateData)
      .where(
        and(
          eq(masjidPages.masjidId, params.id),
          eq(masjidPages.slug, params.pageSlug),
        ),
      );

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select()
      .from(masjidPages)
      .where(
        and(
          eq(masjidPages.masjidId, params.id),
          eq(masjidPages.slug, params.pageSlug),
        ),
      )
      .get();

    return JsonResponse({
      id: updated?.id,
      masjid_id: updated?.masjidId,
      slug: updated?.slug,
      title: updated?.title,
      compiled_html: updated?.compiledHtml,
      raw_markdown: updated?.rawMarkdown,
      last_updated: updated?.lastUpdated,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update page');
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
      .from(masjidPages)
      .where(
        and(
          eq(masjidPages.masjidId, params.id),
          eq(masjidPages.slug, params.pageSlug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Page not found');
    }

    await db
      .delete(masjidPages)
      .where(
        and(
          eq(masjidPages.masjidId, params.id),
          eq(masjidPages.slug, params.pageSlug),
        ),
      );

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return new Response(null, { status: 204 });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to delete page');
  }
};