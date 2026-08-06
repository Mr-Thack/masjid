import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, posts } from '$lib/server/db/schema';
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
      .from(posts)
      .where(
        and(
          eq(posts.masjidId, masjid.id),
          eq(posts.isHidden, false),
        ),
      )
      .orderBy(desc(posts.createdAt));

    return JsonResponse({
      masjid_slug: params.slug,
      masjid_name: masjid.name,
      posts: rows.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        compiled_html: p.compiledHtml,
        show_on_homepage: p.showOnHomepage,
        show_on_info: p.showOnInfo,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch posts');
  }
};