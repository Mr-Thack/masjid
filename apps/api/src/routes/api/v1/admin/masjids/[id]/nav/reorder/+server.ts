import {
  ReorderNavSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { navItems, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = ReorderNavSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    for (let i = 0; i < body.item_ids.length; i++) {
      await db
        .update(navItems)
        .set({ sortOrder: i })
        .where(
          and(
            eq(navItems.id, body.item_ids[i]!),
            eq(navItems.masjidId, params.id),
          ),
        );
    }

    const updated = await db
      .select()
      .from(navItems)
      .where(eq(navItems.masjidId, params.id))
      .orderBy(navItems.sortOrder);

    return JsonResponse({
      nav_items: updated.map((item) => ({
        id: item.id,
        masjid_id: item.masjidId,
        sort_order: item.sortOrder,
        kind: item.kind,
        route_segment: item.routeSegment,
        page_slug: item.pageSlug,
        external_url: item.externalUrl,
        label: item.label,
        icon: item.icon,
        is_highlighted: item.isHighlighted,
        show_on_desktop_header: item.showOnDesktopHeader,
        show_on_mobile_bottom: item.showOnMobileBottom,
        created_at: item.createdAt,
      })),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to reorder nav items');
  }
};