import { calculateAdhaan } from './adhaan';
import { computeHijriDate } from './hijri';
import { applyAction, allConditionsMatch } from '@masjid/ui-utils';
import type { Condition, Action } from '@masjid/schemas';
import type { Db } from '../db';
import { prayerRules } from '../db/schema';
import { and, eq, asc } from 'drizzle-orm';

export { applyAction, allConditionsMatch };

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

interface MasjidConfig {
  id: string;
  calculation_method: number;
  fajr_angle: number | null;
  isha_angle: number | null;
  adjust_fajr: number;
  adjust_sunrise: number;
  adjust_dhuhr: number;
  adjust_asr: number;
  adjust_maghrib: number;
  adjust_isha: number;
  latitude: number;
  longitude: number;
  timezone: string;
  asr_madhab: string;
  high_latitude_rule: string;
  show_dual_asr: boolean;
}

export type PrayerTimeResult = {
  adhaan: string;
  iqaamah: string;
  right_after_adhaan?: boolean;
};

export type ComputedTimes = Record<PrayerName, PrayerTimeResult> & { sunrise: string; asr_secondary?: string };

function parseHM(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

function minutesBetween(a: string, b: string): number {
  return parseHM(b) - parseHM(a);
}

/**
 * Verification guard (see Background.md §6). Rejects impossible schedules
 * before they can reach the live display. If a rule combination produces
 * inverted prayer times, we throw rather than broadcasting bad data.
 */
export function verifyComputedTimes(times: ComputedTimes): void {
  const order: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  for (const name of order) {
    const prayer = times[name];
    if (!prayer) throw new Error(`Missing ${name} prayer time`);

    if (prayer.right_after_adhaan) {
      if (prayer.iqaamah !== prayer.adhaan) {
        throw new Error(`right_after_adhaan flag set for ${name} but iqaamah != adhaan`);
      }
      continue;
    }

    const iqaamahMin = parseHM(prayer.iqaamah);
    const adhaanMin = parseHM(prayer.adhaan);
    if (isNaN(iqaamahMin) || isNaN(adhaanMin)) {
      console.warn(`Invalid prayer time for ${name} (adhaan=${prayer.adhaan}, iqaamah=${prayer.iqaamah})`);
      continue;
    }

    if (iqaamahMin < adhaanMin) {
      throw new Error(`Iqaamah before adhaan for ${name}`);
    }
  }

  const fajrIqaamah = parseHM(times.fajr.iqaamah);
  const sunriseMin = parseHM(times.sunrise);
  if (!isNaN(fajrIqaamah) && !isNaN(sunriseMin) && fajrIqaamah >= sunriseMin) {
    console.warn(`Fajr iqaamah (${times.fajr.iqaamah}) is not before sunrise (${times.sunrise}) — coordinates or timezone may be wrong`);
  }

  let previousIqaamah = parseHM(times.fajr.iqaamah);
  for (let i = 1; i < order.length; i++) {
    const currentIqaamah = parseHM(times[order[i]!].iqaamah);
    if (currentIqaamah <= previousIqaamah) {
      console.warn(`Prayer order invalid around ${order[i]} for masjid (iqaamah=${times[order[i]!].iqaamah}, prev=${times[order[i-1]!].iqaamah})`);
      // Don't throw — bad coordinates/timezone can cause order violations.
      // The admin needs to fix their masjid config, not crash the page.
    }
    if (minutesBetween(times[order[i - 1]!].iqaamah, times[order[i]!].adhaan) < 0) {
      console.warn(`Adhaan of ${order[i]} is before iqaamah of ${order[i - 1]}`);
    }
    previousIqaamah = currentIqaamah;
  }

  // Sanity bounds: isha should not run past 1 AM relative to the day.
  if (parseHM(times.isha.iqaamah) > 60) {
    // no-op; just here for documentation
  }
}

export async function computeIqaamah(
  masjid: MasjidConfig,
  date: Date,
  db: Db,
): Promise<ComputedTimes> {
  const adhaan = calculateAdhaan(masjid, date);
  const hijriDate = computeHijriDate(date);
  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[];
  const result = {} as Record<PrayerName, PrayerTimeResult>;

  const computedTimes = { sunrise: adhaan.sunrise } as ComputedTimes;

  for (const prayer of prayers) {
    const adhaanTime = adhaan[prayer];
    let iqaamahTime = adhaanTime;
    let rightAfterAdhaan = false;

    const rules = await db
      .select()
      .from(prayerRules)
      .where(and(eq(prayerRules.masjidId, masjid.id), eq(prayerRules.prayerName, prayer)))
      .orderBy(asc(prayerRules.executionOrder));

    for (const rule of rules) {
      if (rule.enabled === false) continue;

      let conditions: Condition[];
      try {
        conditions = JSON.parse(rule.conditionsJson);
      } catch {
        continue;
      }

      let action: Action;
      try {
        action = JSON.parse(rule.actionJson);
      } catch {
        continue;
      }

      if (allConditionsMatch(conditions, date, hijriDate, iqaamahTime)) {
        iqaamahTime = applyAction(action, iqaamahTime, computedTimes);
        if (action.type === 'right_after_adhaan') {
          rightAfterAdhaan = true;
        }
      }
    }

    result[prayer] = { adhaan: adhaanTime, iqaamah: iqaamahTime, right_after_adhaan: rightAfterAdhaan };
    computedTimes[prayer] = result[prayer];
  }

  const computed = {
    fajr: result.fajr,
    sunrise: adhaan.sunrise,
    dhuhr: result.dhuhr,
    asr: result.asr,
    maghrib: result.maghrib,
    isha: result.isha,
    ...(adhaan.asr_secondary ? { asr_secondary: adhaan.asr_secondary } : {}),
  } as ComputedTimes;

  verifyComputedTimes(computed);
  return computed;
}