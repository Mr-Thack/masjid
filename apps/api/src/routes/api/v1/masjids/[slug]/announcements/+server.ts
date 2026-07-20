import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, announcements } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
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

    const rows = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.masjidId, masjid.id),
          eq(announcements.status, 'published'),
        ),
      )
      .orderBy(desc(announcements.publishedAt))
      .limit(20);

    return JsonResponse({
      masjid_slug: params.slug,
      masjid_name: masjid.name,
      announcements: rows.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        compiled_html: a.compiledHtml,
        is_pinned: a.isPinned,
        published_at: a.publishedAt,
        expires_at: a.expiresAt,
      })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch announcements');
  }
};