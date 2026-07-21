import {
  UpdateJumuahSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { jumuahSessions, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = UpdateJumuahSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(jumuahSessions)
      .where(eq(jumuahSessions.id, params.session_id))
      .get();

    if (!existing || existing.masjidId !== params.id) {
      return ErrorJsonResponse('NOT_FOUND', 'Jumuah session not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.label !== undefined) updateData.label = body.label;
    if (body.time !== undefined) updateData.time = body.time;
    if (body.khateeb !== undefined) updateData.khateeb = body.khateeb;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.is_active !== undefined) updateData.isActive = body.is_active;

    if (Object.keys(updateData).length > 0) {
      await db.update(jumuahSessions).set(updateData).where(eq(jumuahSessions.id, params.session_id));
    }

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select()
      .from(jumuahSessions)
      .where(eq(jumuahSessions.id, params.session_id))
      .get();

    return JsonResponse({
      id: updated?.id,
      masjid_id: updated?.masjidId,
      label: updated?.label,
      time: updated?.time,
      khateeb: updated?.khateeb,
      location: updated?.location,
      is_active: updated?.isActive,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update jumuah session');
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
      .from(jumuahSessions)
      .where(eq(jumuahSessions.id, params.session_id))
      .get();

    if (!existing || existing.masjidId !== params.id) {
      return ErrorJsonResponse('NOT_FOUND', 'Jumuah session not found');
    }

    await db.delete(jumuahSessions).where(eq(jumuahSessions.id, params.session_id));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({ success: true });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to delete jumuah session');
  }
};