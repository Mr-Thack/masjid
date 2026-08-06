import {
  UpdateNavItemSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { navItems } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = UpdateNavItemSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(navItems)
      .where(
        and(
          eq(navItems.masjidId, params.id),
          eq(navItems.id, params.itemId),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Nav item not found');
    }

    if (body.is_highlighted === true) {
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

    const updateData: Record<string, unknown> = {};

    if (body.kind !== undefined) updateData.kind = body.kind;
    if (body.kind === 'route' && body.route_segment !== undefined) {
      updateData.routeSegment = body.route_segment;
    }
    if (body.kind === 'page' && body.page_slug !== undefined) {
      updateData.pageSlug = body.page_slug;
    }
    if (body.kind === 'link' && body.external_url !== undefined) {
      updateData.externalUrl = body.external_url;
    }
    if (body.label !== undefined) updateData.label = body.label;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.is_highlighted !== undefined) updateData.isHighlighted = body.is_highlighted;
    if (body.show_on_desktop_header !== undefined) updateData.showOnDesktopHeader = body.show_on_desktop_header;
    if (body.show_on_mobile_bottom !== undefined) updateData.showOnMobileBottom = body.show_on_mobile_bottom;

    if (Object.keys(updateData).length > 0) {
      await db
        .update(navItems)
        .set(updateData)
        .where(
          and(
            eq(navItems.masjidId, params.id),
            eq(navItems.id, params.itemId),
          ),
        );
    }

    const updated = await db
      .select()
      .from(navItems)
      .where(
        and(
          eq(navItems.masjidId, params.id),
          eq(navItems.id, params.itemId),
        ),
      )
      .get();

    return JsonResponse({
      id: updated!.id,
      masjid_id: updated!.masjidId,
      sort_order: updated!.sortOrder,
      kind: updated!.kind,
      route_segment: updated!.routeSegment,
      page_slug: updated!.pageSlug,
      external_url: updated!.externalUrl,
      label: updated!.label,
      icon: updated!.icon,
      is_highlighted: updated!.isHighlighted,
      show_on_desktop_header: updated!.showOnDesktopHeader,
      show_on_mobile_bottom: updated!.showOnMobileBottom,
      created_at: updated!.createdAt,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update nav item');
  }
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
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
      .from(navItems)
      .where(
        and(
          eq(navItems.masjidId, params.id),
          eq(navItems.id, params.itemId),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Nav item not found');
    }

    await db
      .delete(navItems)
      .where(
        and(
          eq(navItems.masjidId, params.id),
          eq(navItems.id, params.itemId),
        ),
      );

    const remaining = await db
      .select()
      .from(navItems)
      .where(eq(navItems.masjidId, params.id))
      .orderBy(asc(navItems.sortOrder));

    for (let i = 0; i < remaining.length; i++) {
      await db
        .update(navItems)
        .set({ sortOrder: i })
        .where(
          and(
            eq(navItems.masjidId, params.id),
            eq(navItems.id, remaining[i]!.id),
          ),
        );
    }

    return new Response(null, { status: 204 });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to delete nav item');
  }
};