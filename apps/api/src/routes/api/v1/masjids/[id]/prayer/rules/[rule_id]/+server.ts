import {
  UpdatePrayerRuleSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { prayerRules, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
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
    const body = UpdatePrayerRuleSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(prayerRules)
      .where(eq(prayerRules.id, params.rule_id))
      .get();

    if (!existing || existing.masjidId !== params.id) {
      return ErrorJsonResponse('NOT_FOUND', 'Prayer rule not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.prayer_name !== undefined) updateData.prayerName = body.prayer_name;
    if (body.rule_name !== undefined) updateData.ruleName = body.rule_name;
    if (body.execution_order !== undefined) updateData.executionOrder = body.execution_order;
    if (body.conditions_json !== undefined) updateData.conditionsJson = JSON.stringify(body.conditions_json);
    if (body.action_json !== undefined) updateData.actionJson = JSON.stringify(body.action_json);

    if (Object.keys(updateData).length > 0) {
      await db.update(prayerRules).set(updateData).where(eq(prayerRules.id, params.rule_id));
    }

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select()
      .from(prayerRules)
      .where(eq(prayerRules.id, params.rule_id))
      .get();

    return JsonResponse({
      id: updated?.id,
      masjid_id: updated?.masjidId,
      prayer_name: updated?.prayerName,
      rule_name: updated?.ruleName,
      execution_order: updated?.executionOrder,
      conditions_json: JSON.parse(updated?.conditionsJson ?? '[]'),
      action_json: JSON.parse(updated?.actionJson ?? '{}'),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update prayer rule');
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
      .from(prayerRules)
      .where(eq(prayerRules.id, params.rule_id))
      .get();

    if (!existing || existing.masjidId !== params.id) {
      return ErrorJsonResponse('NOT_FOUND', 'Prayer rule not found');
    }

    await db.delete(prayerRules).where(eq(prayerRules.id, params.rule_id));

    const remaining = await db
      .select()
      .from(prayerRules)
      .where(eq(prayerRules.masjidId, params.id))
      .orderBy(asc(prayerRules.executionOrder));

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i]!.executionOrder !== i) {
        await db
          .update(prayerRules)
          .set({ executionOrder: i })
          .where(eq(prayerRules.id, remaining[i]!.id));
      }
    }

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({ success: true });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to delete prayer rule');
  }
};