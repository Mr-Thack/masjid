import {
  CreateNavItemSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { navItems, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, asc, and } from 'drizzle-orm';
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
    const rows = await db
      .select()
      .from(navItems)
      .where(eq(navItems.masjidId, params.id))
      .orderBy(asc(navItems.sortOrder));

    return JsonResponse({
      nav_items: rows.map((item) => ({
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
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch nav items');
  }
};

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = CreateNavItemSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const existing = await db
      .select({ sortOrder: navItems.sortOrder })
      .from(navItems)
      .where(eq(navItems.masjidId, params.id))
      .orderBy(asc(navItems.sortOrder));

    const maxSort = existing.length > 0 ? existing[existing.length - 1]!.sortOrder : -1;
    const newSortOrder = maxSort + 1;

    if (body.is_highlighted) {
      await db
        .update(navItems)
        .set({ isHighlighted: false })
        .where(
          and(
            eq(navItems.masjidId, params.id),
            eq(navItems.isHighlighted, true),
          ),
        );
    }

    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(navItems).values({
      id: itemId,
      masjidId: params.id,
      sortOrder: newSortOrder,
      kind: body.kind,
      routeSegment: body.kind === 'route' ? body.route_segment : null,
      pageSlug: body.kind === 'page' ? body.page_slug : null,
      externalUrl: body.kind === 'link' ? body.external_url : null,
      label: body.label,
      icon: body.icon ?? null,
      isHighlighted: body.is_highlighted,
      showOnDesktopHeader: body.show_on_desktop_header,
      showOnMobileBottom: body.show_on_mobile_bottom,
      createdAt: now,
    });

    return JsonResponse({
      id: itemId,
      masjid_id: params.id,
      sort_order: newSortOrder,
      kind: body.kind,
      route_segment: body.kind === 'route' ? body.route_segment : null,
      page_slug: body.kind === 'page' ? body.page_slug : null,
      external_url: body.kind === 'link' ? body.external_url : null,
      label: body.label,
      icon: body.icon ?? null,
      is_highlighted: body.is_highlighted,
      show_on_desktop_header: body.show_on_desktop_header,
      show_on_mobile_bottom: body.show_on_mobile_bottom,
      created_at: now,
    }, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create nav item');
  }
};