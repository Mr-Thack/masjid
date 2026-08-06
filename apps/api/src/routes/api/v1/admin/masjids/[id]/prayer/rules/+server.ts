import {
  CreatePrayerRuleSchema,
  ErrorJsonResponse,
  JsonResponse,
  formatPrayerRuleError,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { prayerRules, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { invalidateMasjidCache, invalidatePageCache } from '$lib/server/prayer/cache';
import { validateRulesHealth } from '$lib/server/prayer/validate';
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
    const rules = await db
      .select()
      .from(prayerRules)
      .where(eq(prayerRules.masjidId, params.id))
      .orderBy(asc(prayerRules.executionOrder));

    const mapped = rules.map((r) => ({
      id: r.id,
      masjid_id: r.masjidId,
      prayer_name: r.prayerName,
      rule_name: r.ruleName,
      execution_order: r.executionOrder,
      conditions_json: JSON.parse(r.conditionsJson),
      action_json: JSON.parse(r.actionJson),
      enabled: r.enabled ?? true,
    }));

    return JsonResponse({ rules: mapped });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch prayer rules');
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
    const body = CreatePrayerRuleSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const ruleId = crypto.randomUUID();
    await db.insert(prayerRules).values({
      id: ruleId,
      masjidId: params.id,
      prayerName: body.prayer_name,
      ruleName: body.rule_name,
      executionOrder: body.execution_order,
      conditionsJson: JSON.stringify(body.conditions_json),
      actionJson: JSON.stringify(body.action_json),
      enabled: body.enabled !== false,
    });

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const health = await validateRulesHealth(params.id, db);

    const response: Record<string, unknown> = {
      id: ruleId,
      masjid_id: params.id,
      prayer_name: body.prayer_name,
      rule_name: body.rule_name,
      execution_order: body.execution_order,
      conditions_json: body.conditions_json,
      action_json: body.action_json,
      enabled: body.enabled !== false,
    };

    if (health && !health.healthy) {
      response.warning = `This rule produces invalid prayer times for ${health.failingDates.join(', ')}. The display will show --:-- for those days.`;
    }

    return JsonResponse(response, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      const { message, field } = formatPrayerRuleError(e as unknown as import('zod').ZodError);
      return ErrorJsonResponse('VALIDATION_ERROR', `${message} (field: ${field})`);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create prayer rule');
  }
};