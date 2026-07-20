import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateMasjidCache, invalidatePageCache } from '$lib/server/prayer/cache';
import type { RequestHandler } from './$types';

const PrayerConfigUpdateSchema = z.object({
  calculation_method: z.number().int().min(1).optional(),
  timezone: z.string().min(1).optional(),
});

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);
    const masjid = await db
      .select({
        calculation_method: masjids.calculationMethod,
        timezone: masjids.timezone,
      })
      .from(masjids)
      .where(eq(masjids.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    return JsonResponse({
      calculation_method: masjid.calculation_method,
      timezone: masjid.timezone,
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch prayer config');
  }
};

export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only update your own masjid');
  }

  try {
    const body = PrayerConfigUpdateSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjids.slug })
      .from(masjids)
      .where(eq(masjids.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.calculation_method !== undefined) updateData.calculationMethod = body.calculation_method;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;

    if (Object.keys(updateData).length > 0) {
      await db.update(masjids).set(updateData).where(eq(masjids.id, params.id));
    }

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select({
        calculation_method: masjids.calculationMethod,
        timezone: masjids.timezone,
      })
      .from(masjids)
      .where(eq(masjids.id, params.id))
      .get();

    return JsonResponse({
      calculation_method: updated?.calculation_method,
      timezone: updated?.timezone,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update prayer config');
  }
};