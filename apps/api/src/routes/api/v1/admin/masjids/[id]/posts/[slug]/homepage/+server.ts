import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { posts, masjids as masjidsTable } from '$lib/server/db/schema';
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

    const newValue = !existing.showOnHomepage;

    if (newValue) {
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

    await db
      .update(posts)
      .set({ showOnHomepage: newValue, updatedAt: new Date().toISOString() })
      .where(and(eq(posts.masjidId, params.id), eq(posts.slug, params.slug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({ show_on_homepage: newValue });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to toggle homepage pin');
  }
};