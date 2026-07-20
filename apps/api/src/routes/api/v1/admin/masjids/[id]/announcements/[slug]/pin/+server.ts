import {
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { announcements, masjids as masjidsTable } from '$lib/server/db/schema';
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
      .from(announcements)
      .where(
        and(
          eq(announcements.masjidId, params.id),
          eq(announcements.slug, params.slug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Announcement not found');
    }

    const newPinned = !existing.isPinned;

    if (newPinned) {
      await db
        .update(announcements)
        .set({ isPinned: false, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(announcements.masjidId, params.id),
            eq(announcements.isPinned, true),
          ),
        );
    }

    await db
      .update(announcements)
      .set({ isPinned: newPinned, updatedAt: new Date().toISOString() })
      .where(and(eq(announcements.masjidId, params.id), eq(announcements.slug, params.slug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select()
      .from(announcements)
      .where(and(eq(announcements.masjidId, params.id), eq(announcements.slug, params.slug)))
      .get();

    return JsonResponse({
      id: updated?.id,
      masjid_id: updated?.masjidId,
      title: updated?.title,
      slug: updated?.slug,
      is_pinned: updated?.isPinned,
      status: updated?.status,
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to toggle pin');
  }
};