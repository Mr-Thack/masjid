import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, announcements } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ id: masjids.id, name: masjids.name })
      .from(masjids)
      .where(eq(masjids.slug, params.slug))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const announcement = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.masjidId, masjid.id),
          eq(announcements.slug, params.ann_slug),
          eq(announcements.status, 'published'),
        ),
      )
      .get();

    if (!announcement) {
      return ErrorJsonResponse('NOT_FOUND', 'Announcement not found');
    }

    return JsonResponse({
      id: announcement.id,
      title: announcement.title,
      slug: announcement.slug,
      compiled_html: announcement.compiledHtml,
      is_pinned: announcement.isPinned,
      published_at: announcement.publishedAt,
      expires_at: announcement.expiresAt,
      masjid_slug: params.slug,
      masjid_name: masjid.name,
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch announcement');
  }
};