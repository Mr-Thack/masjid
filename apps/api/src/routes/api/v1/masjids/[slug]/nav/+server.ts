import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, navItems } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
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

    const rows = await db
      .select()
      .from(navItems)
      .where(eq(navItems.masjidId, masjid.id))
      .orderBy(asc(navItems.sortOrder));

    return JsonResponse({
      nav_items: rows.map((n) => ({
        id: n.id,
        sort_order: n.sortOrder,
        kind: n.kind,
        route_segment: n.routeSegment,
        page_slug: n.pageSlug,
        external_url: n.externalUrl,
        label: n.label,
        icon: n.icon,
        is_highlighted: n.isHighlighted,
        show_on_desktop_header: n.showOnDesktopHeader,
        show_on_mobile_bottom: n.showOnMobileBottom,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('GET nav items error:', message, e instanceof Error ? e.stack : '');
    return ErrorJsonResponse('INTERNAL_ERROR', `Failed to fetch nav items: ${message}`);
  }
};