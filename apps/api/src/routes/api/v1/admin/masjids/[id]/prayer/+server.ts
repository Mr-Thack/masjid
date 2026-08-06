import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateMasjidCache, invalidatePageCache } from '$lib/server/prayer/cache';
import { validateRulesHealth } from '$lib/server/prayer/validate';
import type { RequestHandler } from './$types';

const PrayerConfigUpdateSchema = z.object({
  calculation_method: z.number().int().min(1).optional(),
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
        asr_madhab: masjids.asrMadhab,
        high_latitude_rule: masjids.highLatitudeRule,
        show_dual_asr: masjids.showDualAsr,
        fajr_angle: masjids.fajrAngle,
        isha_angle: masjids.ishaAngle,
        adjust_fajr: masjids.adjustFajr,
        adjust_sunrise: masjids.adjustSunrise,
        adjust_dhuhr: masjids.adjustDhuhr,
        adjust_asr: masjids.adjustAsr,
        adjust_maghrib: masjids.adjustMaghrib,
        adjust_isha: masjids.adjustIsha,
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
      asr_madhab: masjid.asr_madhab,
      high_latitude_rule: masjid.high_latitude_rule,
      show_dual_asr: masjid.show_dual_asr,
      fajr_angle: masjid.fajr_angle,
      isha_angle: masjid.isha_angle,
      adjust_fajr: masjid.adjust_fajr,
      adjust_sunrise: masjid.adjust_sunrise,
      adjust_dhuhr: masjid.adjust_dhuhr,
      adjust_asr: masjid.adjust_asr,
      adjust_maghrib: masjid.adjust_maghrib,
      adjust_isha: masjid.adjust_isha,
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
    if (body.asr_madhab !== undefined) updateData.asrMadhab = body.asr_madhab;
    if (body.high_latitude_rule !== undefined) updateData.highLatitudeRule = body.high_latitude_rule;
    if (body.show_dual_asr !== undefined) updateData.showDualAsr = body.show_dual_asr;
    if (body.fajr_angle !== undefined) updateData.fajrAngle = body.fajr_angle;
    if (body.isha_angle !== undefined) updateData.ishaAngle = body.isha_angle;
    if (body.adjust_fajr !== undefined) updateData.adjustFajr = body.adjust_fajr;
    if (body.adjust_sunrise !== undefined) updateData.adjustSunrise = body.adjust_sunrise;
    if (body.adjust_dhuhr !== undefined) updateData.adjustDhuhr = body.adjust_dhuhr;
    if (body.adjust_asr !== undefined) updateData.adjustAsr = body.adjust_asr;
    if (body.adjust_maghrib !== undefined) updateData.adjustMaghrib = body.adjust_maghrib;
    if (body.adjust_isha !== undefined) updateData.adjustIsha = body.adjust_isha;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;

    if (Object.keys(updateData).length > 0) {
      await db.update(masjids).set(updateData).where(eq(masjids.id, params.id));
    }

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select({
        calculation_method: masjids.calculationMethod,
        asr_madhab: masjids.asrMadhab,
        high_latitude_rule: masjids.highLatitudeRule,
        show_dual_asr: masjids.showDualAsr,
        fajr_angle: masjids.fajrAngle,
        isha_angle: masjids.ishaAngle,
        adjust_fajr: masjids.adjustFajr,
        adjust_sunrise: masjids.adjustSunrise,
        adjust_dhuhr: masjids.adjustDhuhr,
        adjust_asr: masjids.adjustAsr,
        adjust_maghrib: masjids.adjustMaghrib,
        adjust_isha: masjids.adjustIsha,
        timezone: masjids.timezone,
      })
      .from(masjids)
      .where(eq(masjids.id, params.id))
      .get();

    const health = await validateRulesHealth(params.id, db);

    const response: Record<string, unknown> = {
      calculation_method: updated?.calculation_method,
      asr_madhab: updated?.asr_madhab,
      high_latitude_rule: updated?.high_latitude_rule,
      show_dual_asr: updated?.show_dual_asr,
      fajr_angle: updated?.fajr_angle,
      isha_angle: updated?.isha_angle,
      adjust_fajr: updated?.adjust_fajr,
      adjust_sunrise: updated?.adjust_sunrise,
      adjust_dhuhr: updated?.adjust_dhuhr,
      adjust_asr: updated?.adjust_asr,
      adjust_maghrib: updated?.adjust_maghrib,
      adjust_isha: updated?.adjust_isha,
      timezone: updated?.timezone,
    };

    if (health && !health.healthy) {
      response.warning = `This prayer config produces invalid prayer times for ${health.failingDates.join(', ')}. The display will show --:-- for those days.`;
    }

    return JsonResponse(response);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update prayer config');
  }
};