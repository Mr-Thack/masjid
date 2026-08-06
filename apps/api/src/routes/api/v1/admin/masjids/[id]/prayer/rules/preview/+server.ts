import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, prayerRules } from '$lib/server/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { computeIqaamah, type ComputedTimes, type PrayerName, type PrayerTimeResult } from '$lib/server/prayer/engine';
import { calculateAdhaan } from '$lib/server/prayer/adhaan';
import { computeHijriDate } from '$lib/server/prayer/hijri';
import { applyAction, allConditionsMatch } from '@masjid/ui-utils';
import type { Condition, Action } from '@masjid/schemas';
import type { RequestHandler } from './$types';

interface RuleChainEntry {
  id: string;
  order: number;
  rule_name: string;
  conditions_json: Condition[];
  action_json: Action;
  enabled: boolean;
  matched: boolean;
  input_time: string;
  output_time: string;
}

interface PrayerChain {
  adhaan: string;
  iqaamah: string;
  right_after_adhaan: boolean;
  rules: RuleChainEntry[];
}

export const GET: RequestHandler = async ({ params, url, locals, platform }) => {
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
      calculation_method: masjid.calculation_method as number,
      fajr_angle: masjid.fajr_angle as number | null,
      isha_angle: masjid.isha_angle as number | null,
      adjust_fajr: masjid.adjust_fajr as number,
      adjust_sunrise: masjid.adjust_sunrise as number,
      adjust_dhuhr: masjid.adjust_dhuhr as number,
      adjust_asr: masjid.adjust_asr as number,
      adjust_maghrib: masjid.adjust_maghrib as number,
      adjust_isha: masjid.adjust_isha as number,
      latitude: masjid.latitude as number,
      longitude: masjid.longitude as number,
      timezone: masjid.timezone as string,
      asr_madhab: masjid.asr_madhab as string ?? 'shafi',
      high_latitude_rule: masjid.high_latitude_rule as string ?? 'seventh_of_night',
      show_dual_asr: !!masjid.show_dual_asr,
    };

    const dateStr = url.searchParams.get('date');
    const date = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
    const hijriDate = computeHijriDate(date);
    const adhaan = calculateAdhaan(config, date);

    const prayers: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const chains: Record<string, PrayerChain> = {};

    const computedTimes = { sunrise: adhaan.sunrise } as ComputedTimes;

    for (const prayer of prayers) {
      const adhaanTime = adhaan[prayer];
      let iqaamahTime = adhaanTime;
      let rightAfterAdhaan = false;

      const rules = await db
        .select()
        .from(prayerRules)
        .where(and(eq(prayerRules.masjidId, params.id), eq(prayerRules.prayerName, prayer)))
        .orderBy(asc(prayerRules.executionOrder));

      const ruleEntries: RuleChainEntry[] = [];
      let currentTime = adhaanTime;

      for (const rule of rules) {
        let conditions: Condition[];
        let action: Action;

        try {
          conditions = JSON.parse(rule.conditionsJson);
          action = JSON.parse(rule.actionJson);
        } catch {
          continue;
        }

        const enabled = rule.enabled !== false;
        const matched = enabled && allConditionsMatch(conditions, date, hijriDate, currentTime);
        const nextTime = matched ? applyAction(action, currentTime, computedTimes) : currentTime;

        if (matched && action.type === 'right_after_adhaan') {
          rightAfterAdhaan = true;
        }

        ruleEntries.push({
          id: rule.id,
          order: rule.executionOrder,
          rule_name: rule.ruleName,
          conditions_json: conditions,
          action_json: action,
          enabled,
          matched,
          input_time: currentTime,
          output_time: nextTime,
        });

        if (matched) {
          currentTime = nextTime;
        }
      }

      iqaamahTime = currentTime;
      chains[prayer] = {
        adhaan: adhaanTime,
        iqaamah: iqaamahTime,
        right_after_adhaan: rightAfterAdhaan,
        rules: ruleEntries,
      };

      const result: PrayerTimeResult = { adhaan: adhaanTime, iqaamah: iqaamahTime, right_after_adhaan: rightAfterAdhaan };
      computedTimes[prayer] = result;
    }

    return JsonResponse({
      date: date.toISOString().slice(0, 10),
      hijri: hijriDate,
      sunrise: adhaan.sunrise,
      ...(adhaan.asr_secondary ? { asr_secondary: adhaan.asr_secondary } : {}),
      chains,
    });
  } catch (e: unknown) {
    if (e instanceof Error) {
      return ErrorJsonResponse('INTERNAL_ERROR', e.message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to compute rule chain preview');
  }
};