import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { content, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, locals, platform }) => {
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

    const newValue = !existing.showOnInfo;

    if (newValue) {
      await db
        .update(content)
        .set({ showOnInfo: false })
        .where(
          and(
            eq(content.masjidId, params.id),
            eq(content.showOnInfo, true),
            eq(content.contentType, 'post'),
          ),
        );
    }

    await db
      .update(content)
      .set({ showOnInfo: newValue, updatedAt: new Date().toISOString() })
      .where(and(eq(content.masjidId, params.id), eq(content.slug, params.contentSlug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({ show_on_info: newValue });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to toggle info pin');
  }
};