import type { Condition, Action } from '@masjid/schemas';

export interface HijriDate {
  month: number;
  day: number;
  year: number;
}

export function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

export function formatTime(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Simplified result type for client-side preview. */
export interface ComputedTimesRef {
  sunrise: string;
  [prayer: string]: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean } | string;
}

export function applyAction(action: Action, time: string, computedTimes?: ComputedTimesRef): string {
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
      break;
    case 'set_offset_from_prayer': {
      if (!computedTimes) throw new Error('set_offset_from_prayer requires computedTimes');
      let refTime: string;
      if (action.from === 'sunrise') {
        refTime = computedTimes.sunrise as string;
      } else {
        const refPrayer = computedTimes[action.prayer];
        if (!refPrayer) throw new Error(`Cannot reference ${action.prayer} before it is computed`);
        refTime = action.from === 'adhaan'
          ? (refPrayer as { adhaan: string }).adhaan
          : (refPrayer as { iqaamah: string }).iqaamah;
      }
      const [refH, refM] = refTime.split(':').map(Number) as [number, number];
      let total = refH * 60 + refM;
      if (action.from === 'sunrise') {
        total -= action.minutes;
      } else {
        total += action.minutes;
      }
      return formatTime(total);
    }
    case 'cap_min': {
      const [ch, cm] = time.split(':').map(Number) as [number, number];
      const [th, tm] = action.time.split(':').map(Number) as [number, number];
      const currentMinutes = ch * 60 + cm;
      const capMinutes = th * 60 + tm;
      if (currentMinutes < capMinutes) return action.time;
      return time;
    }
    case 'cap_max': {
      const [ch, cm] = time.split(':').map(Number) as [number, number];
      const [th, tm] = action.time.split(':').map(Number) as [number, number];
      const currentMinutes = ch * 60 + cm;
      const capMinutes = th * 60 + tm;
      if (currentMinutes > capMinutes) return action.time;
      return time;
    }
  }

  return formatTime(minutes);
}

export function allConditionsMatch(
  conditions: Condition[],
  gregorianDate: Date,
  hijriDate: HijriDate,
  runningTime?: string,
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
      case 'time_of_day': {
        if (!runningTime) return true;
        const [rh, rm] = runningTime.split(':').map(Number) as [number, number];
        const [th, tm] = condition.threshold.split(':').map(Number) as [number, number];
        const runningMinutes = rh * 60 + rm;
        const thresholdMinutes = th * 60 + tm;
        if (condition.operator === 'before') return runningMinutes < thresholdMinutes;
        return runningMinutes >= thresholdMinutes;
      }
      case 'hijri_day_range': {
        if (hijriDate.month !== condition.month) return false;
        return hijriDate.day >= condition.start_day && hijriDate.day <= condition.end_day;
      }
      case 'month_day_range': {
        const m = gregorianDate.getUTCMonth() + 1;
        const d = gregorianDate.getUTCDate();
        const start = condition.start_month * 100 + condition.start_day;
        const end = condition.end_month * 100 + condition.end_day;
        const current = m * 100 + d;
        if (start <= end) return current >= start && current <= end;
        return current >= start || current <= end;
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Hijri date computation — pure Kuwaiti algorithm (no Intl/ICU dependency).
// ---------------------------------------------------------------------------

function gregorianToJulianDay(y: number, m: number, d: number): number {
  let year = y;
  let month = m;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + d + B - 1524;
}

function kuwaitiAlgorithm(jd: number): HijriDate {
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n;
  const j = Math.floor((l2 + 14) / 10631);
  const j2 = Math.floor((l2 + 2) / 10631);
  if (j !== j2) {
    const year = n + 1;
    const daysSince = l - Math.floor(j2 * 10631 + 1);
    const monthsSince = Math.floor((daysSince * 11) / 354);
    const month = monthsSince + 1;
    const daysInMonths = Math.floor((monthsSince * 354 + (monthsSince <= 6 ? 11 : 10)) / 11);
    const day = daysSince - daysInMonths;
    return { month, day: Math.max(1, day + 1), year };
  }
  const year = n;
  const adjusted = l - Math.floor(j2 * 10631 + 1);
  const monthsSince = Math.floor((adjusted * 11) / 355);
  const month = monthsSince + 1;
  const daysInMonths = Math.floor((monthsSince * 355 + 11) / 12);
  const day = adjusted - daysInMonths;
  return { month, day: Math.max(1, day + 1), year };
}

export function computeHijriDate(gregorianDate: Date): HijriDate {
  const y = gregorianDate.getUTCFullYear();
  const m = gregorianDate.getUTCMonth() + 1;
  const d = gregorianDate.getUTCDate();
  return kuwaitiAlgorithm(gregorianToJulianDay(y, m, d));
}