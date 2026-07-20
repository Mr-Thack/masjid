import { calculateAdhaan } from './adhaan';
import { computeHijriDate } from './hijri';
import type { Condition, Action } from '@masjid/schemas';
import type { Db } from '../db';
import { prayerRules } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

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

export async function computeIqaamah(
  masjid: MasjidConfig,
  date: Date,
  db: Db,
): Promise<Record<Exclude<PrayerName, 'sunrise'> | 'sunrise', { adhaan: string; iqaamah: string }>> {
  const adhaan = calculateAdhaan(masjid, date);
  const hijriDate = computeHijriDate(date);
  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[];
  const result = {} as Record<PrayerName, { adhaan: string; iqaamah: string }>;

  for (const prayer of prayers) {
    const adhaanTime = adhaan[prayer];
    let iqaamahTime = adhaanTime;

    const rules = await db
      .select()
      .from(prayerRules)
      .where(eq(prayerRules.masjidId, masjid.id))
      .where(eq(prayerRules.prayerName, prayer))
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
      }
    }

    result[prayer] = { adhaan: adhaanTime, iqaamah: iqaamahTime };
  }

  return {
    fajr: result.fajr,
    sunrise: adhaan.sunrise,
    dhuhr: result.dhuhr,
    asr: result.asr,
    maghrib: result.maghrib,
    isha: result.isha,
  } as Record<Exclude<PrayerName, 'sunrise'> | 'sunrise', { adhaan: string; iqaamah: string }>;
}