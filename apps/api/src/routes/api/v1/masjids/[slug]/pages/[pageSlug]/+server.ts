import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, masjidPages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ id: masjids.id })
      .from(masjids)
      .where(eq(masjids.slug, params.slug))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const page = await db
      .select()
      .from(masjidPages)
      .where(
        and(
          eq(masjidPages.masjidId, masjid.id),
          eq(masjidPages.slug, params.pageSlug),
        ),
      )
      .get();

    if (!page) {
      return ErrorJsonResponse('NOT_FOUND', 'Page not found');
    }

    return JsonResponse({
      title: page.title,
      compiled_html: page.compiledHtml,
      last_updated: page.lastUpdated,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('GET page error:', message, e instanceof Error ? e.stack : '');
    return ErrorJsonResponse('INTERNAL_ERROR', `Failed to fetch page: ${message}`);
  }
};