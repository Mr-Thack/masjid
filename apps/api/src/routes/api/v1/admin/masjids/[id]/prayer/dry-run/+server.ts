import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, prayerRules } from '$lib/server/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { computeIqaamah, applyAction, allConditionsMatch } from '$lib/server/prayer/engine';
import { computeHijriDate } from '$lib/server/prayer/hijri';
import { calculateAdhaan } from '$lib/server/prayer/adhaan';
import type { Condition, Action } from '@masjid/schemas';
import type { RequestHandler } from './$types';

const RuleOverrideSchema = z.object({
  prayer_name: z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']),
  execution_order: z.number().int().min(0),
  conditions_json: z.array(z.object({}).passthrough()).min(1),
  action_json: z.object({}).passthrough(),
});

const DryRunSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  calculation_method: z.number().int().min(1).max(13).optional(),
  asr_madhab: z.enum(['shafi', 'hanafi']).optional(),
  high_latitude_rule: z.enum(['seventh_of_night', 'middle_of_night', 'twilight_angle', 'none']).optional(),
  show_dual_asr: z.boolean().optional(),
  fajr_angle: z.number().min(8).max(22).nullable().optional(),
  isha_angle: z.number().min(8).max(22).nullable().optional(),
  adjust_fajr: z.number().int().optional(),
  adjust_sunrise: z.number().int().optional(),
  adjust_dhuhr: z.number().int().optional(),
  adjust_asr: z.number().int().optional(),
  adjust_maghrib: z.number().int().optional(),
  adjust_isha: z.number().int().optional(),
  timezone: z.string().optional(),
  rule_overrides: z.array(RuleOverrideSchema).optional(),
});

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const body = DryRunSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({
        id: masjids.id,
        calculation_method: masjids.calculationMethod,
        fajr_angle: masjids.fajrAngle,
        isha_angle: masjids.ishaAngle,
        adjust_fajr: masjids.adjustFajr,
        adjust_sunrise: masjids.adjustSunrise,
        adjust_dhuhr: masjids.adjustDhuhr,
        adjust_asr: masjids.adjustAsr,
        adjust_maghrib: masjids.adjustMaghrib,
        adjust_isha: masjids.adjustIsha,
        latitude: masjids.latitude,
        longitude: masjids.longitude,
        timezone: masjids.timezone,
        asr_madhab: masjids.asrMadhab,
        high_latitude_rule: masjids.highLatitudeRule,
        show_dual_asr: masjids.showDualAsr,
      })
      .from(masjids)
      .where(eq(masjids.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const config = {
      id: masjid.id,
      calculation_method: body.calculation_method ?? masjid.calculation_method as number,
      fajr_angle: body.fajr_angle !== undefined ? body.fajr_angle : (masjid.fajr_angle as number | null),
      isha_angle: body.isha_angle !== undefined ? body.isha_angle : (masjid.isha_angle as number | null),
      adjust_fajr: body.adjust_fajr ?? masjid.adjust_fajr as number,
      adjust_sunrise: body.adjust_sunrise ?? masjid.adjust_sunrise as number,
      adjust_dhuhr: body.adjust_dhuhr ?? masjid.adjust_dhuhr as number,
      adjust_asr: body.adjust_asr ?? masjid.adjust_asr as number,
      adjust_maghrib: body.adjust_maghrib ?? masjid.adjust_maghrib as number,
      adjust_isha: body.adjust_isha ?? masjid.adjust_isha as number,
      latitude: masjid.latitude as number,
      longitude: masjid.longitude as number,
      timezone: body.timezone ?? masjid.timezone as string,
      asr_madhab: body.asr_madhab ?? masjid.asr_madhab as string ?? 'shafi',
      high_latitude_rule: body.high_latitude_rule ?? masjid.high_latitude_rule as string ?? 'seventh_of_night',
      show_dual_asr: body.show_dual_asr ?? !!masjid.show_dual_asr,
    };

    const date = body.date ? new Date(body.date + 'T12:00:00Z') : new Date();

    if (body.rule_overrides && body.rule_overrides.length > 0) {
      const overrides = body.rule_overrides;
      const computed = await computeTimesWithOverrides(config, date, overrides, db);
      return JsonResponse({ date: date.toISOString().slice(0, 10), ...computed });
    }

    const computed = await computeIqaamah(config, date, db);
    return JsonResponse({ date: date.toISOString().slice(0, 10), ...computed });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    if (e instanceof Error) {
      return ErrorJsonResponse('VALIDATION_ERROR', e.message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to compute dry-run prayer times');
  }
};

async function computeTimesWithOverrides(
  config: { id: string; calculation_method: number; fajr_angle: number | null; isha_angle: number | null; adjust_fajr: number; adjust_sunrise: number; adjust_dhuhr: number; adjust_asr: number; adjust_maghrib: number; adjust_isha: number; latitude: number; longitude: number; timezone: string; asr_madhab: string; high_latitude_rule: string; show_dual_asr: boolean },
  date: Date,
  overrides: z.infer<typeof RuleOverrideSchema>[],
  db: ReturnType<typeof getDb>,
): Promise<Record<string, unknown>> {
  const adhaan = calculateAdhaan(config, date);
  const hijriDate = computeHijriDate(date);
  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  const result: Record<string, { adhaan: string; iqaamah: string; right_after_adhaan?: boolean }> = {};
  const resultObj: Record<string, unknown> = { sunrise: adhaan.sunrise };

  for (const prayer of prayers) {
    const adhaanTime = adhaan[prayer];
    let iqaamahTime = adhaanTime;
    let rightAfterAdhaan = false;

    const dbRules = await db
      .select()
      .from(prayerRules)
      .where(and(eq(prayerRules.masjidId, config.id), eq(prayerRules.prayerName, prayer)))
      .orderBy(asc(prayerRules.executionOrder));

    const allRules: { executionOrder: number; conditions: Condition[]; action: Action }[] = [];

    for (const rule of dbRules) {
      let conditions: Condition[];
      let action: Action;
      try {
        conditions = JSON.parse(rule.conditionsJson);
        action = JSON.parse(rule.actionJson);
      } catch {
        continue;
      }
      allRules.push({ executionOrder: rule.executionOrder, conditions, action });
    }

    for (const override of overrides.filter(o => o.prayer_name === prayer)) {
      allRules.push({
        executionOrder: override.execution_order,
        conditions: override.conditions_json as Condition[],
        action: override.action_json as Action,
      });
    }

    allRules.sort((a, b) => a.executionOrder - b.executionOrder);

    let currentTime = adhaanTime;
    for (const rule of allRules) {
      if (allConditionsMatch(rule.conditions, date, hijriDate)) {
        currentTime = applyAction(rule.action, currentTime);
        if (rule.action.type === 'right_after_adhaan') {
          rightAfterAdhaan = true;
        }
      }
    }
    iqaamahTime = currentTime;

    result[prayer] = { adhaan: adhaanTime, iqaamah: iqaamahTime, right_after_adhaan: rightAfterAdhaan };
    resultObj[prayer] = { adhaan: adhaanTime, iqaamah: iqaamahTime };
  }

  return resultObj;
}