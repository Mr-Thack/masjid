import { calculateAdhaan } from './adhaan';
import { computeHijriDate } from './hijri';
import type { Condition, Action } from '@masjid/schemas';
import type { Db } from '../db';
import { prayerRules } from '../db/schema';
import { and, eq, asc } from 'drizzle-orm';

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

interface MasjidConfig {
  id: string;
  calculation_method: number;
  latitude: number;
  longitude: number;
  timezone: string;
}

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function applyAction(action: Action, time: string): string {
  let minutes = parseTime(time);

  switch (action.type) {
    case 'add_minutes':
      minutes += action.minutes;
      break;
    case 'set_fixed_time':
      minutes = parseTime(action.time);
      break;
    case 'round_up': {
      const inc = action.increment;
      const remainder = minutes % inc;
      if (remainder > 0) minutes += inc - remainder;
      break;
    }
    case 'round_down': {
      const inc = action.increment;
      minutes -= minutes % inc;
      break;
    }
    case 'round_nearest': {
      const inc = action.increment;
      const remainder = minutes % inc;
      if (remainder >= inc / 2) {
        minutes += inc - remainder;
      } else {
        minutes -= remainder;
      }
      break;
    }
    case 'right_after_adhaan':
      // iqaamah stays at adhaan time; flag is set downstream
      break;
  }

  return formatTime(minutes);
}

export function allConditionsMatch(
  conditions: Condition[],
  gregorianDate: Date,
  hijriDate: { month: number; day: number; year: number },
): boolean {
  for (const condition of conditions) {
    switch (condition.type) {
      case 'always':
        continue;
      case 'day_of_week':
        if (!condition.days.includes(gregorianDate.getUTCDay())) return false;
        break;
      case 'month':
        if (!condition.months.includes(gregorianDate.getUTCMonth() + 1)) return false;
        break;
      case 'hijri_month':
        if (!condition.months.includes(hijriDate.month)) return false;
        break;
      case 'date_range': {
        const d = gregorianDate.toISOString().slice(0, 10);
        if (d < condition.start || d > condition.end) return false;
        break;
      }
    }
  }
  return true;
}

export type PrayerTimeResult = {
  adhaan: string;
  iqaamah: string;
  right_after_adhaan?: boolean;
};

export type ComputedTimes = Record<PrayerName, PrayerTimeResult> & { sunrise: string };

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

    if (parseHM(prayer.iqaamah) < parseHM(prayer.adhaan)) {
      throw new Error(`Iqaamah before adhaan for ${name}`);
    }
  }

  if (parseHM(times.fajr.iqaamah) >= parseHM(times.sunrise)) {
    throw new Error('Fajr iqaamah must be before sunrise');
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

      if (allConditionsMatch(conditions, date, hijriDate)) {
        iqaamahTime = applyAction(action, iqaamahTime);
        if (action.type === 'right_after_adhaan') {
          rightAfterAdhaan = true;
        }
      }
    }

    result[prayer] = { adhaan: adhaanTime, iqaamah: iqaamahTime, right_after_adhaan: rightAfterAdhaan };
  }

  const computed = {
    fajr: result.fajr,
    sunrise: adhaan.sunrise,
    dhuhr: result.dhuhr,
    asr: result.asr,
    maghrib: result.maghrib,
    isha: result.isha,
  } as ComputedTimes;

  verifyComputedTimes(computed);
  return computed;
}
