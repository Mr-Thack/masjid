import {
  ReorderRulesSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { prayerRules, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { invalidateMasjidCache, invalidatePageCache } from '$lib/server/prayer/cache';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = ReorderRulesSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    for (let i = 0; i < body.order.length; i++) {
      await db
        .update(prayerRules)
        .set({ executionOrder: i })
        .where(eq(prayerRules.id, body.order[i]!))
        .where(eq(prayerRules.masjidId, params.id));
    }

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select()
      .from(prayerRules)
      .where(eq(prayerRules.masjidId, params.id))
      .orderBy(prayerRules.executionOrder);

    const mapped = updated.map((r) => ({
      id: r.id,
      masjid_id: r.masjidId,
      prayer_name: r.prayerName,
      rule_name: r.ruleName,
      execution_order: r.executionOrder,
      conditions_json: JSON.parse(r.conditionsJson),
      action_json: JSON.parse(r.actionJson),
    }));

    return JsonResponse({ rules: mapped });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to reorder rules');
  }
};