import type { Condition, Action } from '@masjid/schemas';
import type { PrayerName } from './types';

interface HijriDate {
  month: number;
  day: number;
  year: number;
}

export interface RuleWithDb {
  id: string;
  prayer_name: PrayerName;
  rule_name: string;
  execution_order: number;
  conditions: Condition[];
  action: Action;
}

export interface ConditionEval {
  type: string;
  result: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface RuleTrace {
  order: number;
  rule_name: string;
  matched: boolean;
  skipped?: boolean;
  conditions: ConditionEval[];
  action: Action;
  rule_id?: string;
  time_before?: string;
  time_after?: string;
}

export interface PrayerTrace {
  adhaan: string;
  iqaamah: string;
  trace: RuleTrace[];
}

export interface ValidationWarning {
  severity: 'warn' | 'info';
  prayer?: PrayerName;
  rule_ids?: string[];
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
  suggestions: string[];
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

const HIJRI_EPOCH = 227015;

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

function kuwaitiHijri(gregorianDate: Date): HijriDate {
  const jd = gregorianToJulianDay(gregorianDate.getUTCFullYear(), gregorianDate.getUTCMonth() + 1, gregorianDate.getUTCDate());
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
      break;
    case 'set_offset_from_prayer':
      minutes += action.minutes;
      break;
    case 'cap_min':
      minutes = Math.max(minutes, parseTime(action.time));
      break;
    case 'cap_max':
      minutes = Math.min(minutes, parseTime(action.time));
      break;
  }

  return formatTime(minutes);
}

export function evaluateCondition(
  condition: Condition,
  gregorianDate: Date,
  hijriDate: HijriDate,
): ConditionEval {
  const details: Record<string, unknown> = {};

  switch (condition.type) {
    case 'always':
      return { type: 'always', result: true };

    case 'day_of_week': {
      const currentDay = gregorianDate.getUTCDay();
      const days = condition.days;
      details.days = days;
      details.current_day = currentDay;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (days.includes(currentDay)) {
        return { type: 'day_of_week', result: true, reason: `Today is ${dayNames[currentDay]} (day ${currentDay}), which is in the rule's day list`, details };
      }
      return {
        type: 'day_of_week',
        result: false,
        reason: `Today is ${dayNames[currentDay]} (day ${currentDay}), not in the rule's day list [${days.join(',')}]`,
        details,
      };
    }

    case 'month': {
      const currentMonth = gregorianDate.getUTCMonth() + 1;
      const months = condition.months;
      details.months = months;
      details.current_month = currentMonth;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      if (months.includes(currentMonth)) {
        return { type: 'month', result: true, reason: `${monthNames[currentMonth]} (month ${currentMonth}) matches the rule's month list`, details };
      }
      return {
        type: 'month',
        result: false,
        reason: `${monthNames[currentMonth]} (month ${currentMonth}) is not in the rule's month list [${months.join(',')}]`,
        details,
      };
    }

    case 'hijri_month': {
      const currentMonth = hijriDate.month;
      const months = condition.months;
      details.months = months;
      details.current_hijri_month = currentMonth;
      if (months.includes(currentMonth)) {
        return { type: 'hijri_month', result: true, reason: `Current Hijri month (${currentMonth}) matches the rule's month list`, details };
      }
      return {
        type: 'hijri_month',
        result: false,
        reason: `Current Hijri month (${currentMonth}) is not in the rule's month list [${months.join(',')}]`,
        details,
      };
    }

    case 'date_range': {
      const d = gregorianDate.toISOString().slice(0, 10);
      const start = condition.start;
      const end = condition.end;
      details.start = start;
      details.end = end;
      details.current_date = d;
      if (d < start) {
        return { type: 'date_range', result: false, reason: `${d} is before the start date ${start}`, details };
      }
      if (d > end) {
        return { type: 'date_range', result: false, reason: `${d} is after the end date ${end}`, details };
      }
      return { type: 'date_range', result: true, reason: `${d} is within ${start} to ${end}`, details };
    }

    case 'month_day_range': {
      const currentMonth = gregorianDate.getUTCMonth() + 1;
      const currentDay = gregorianDate.getUTCDate();
      const sm = condition.start_month;
      const sd = condition.start_day;
      const em = condition.end_month;
      const ed = condition.end_day;
      details.start = `${sm}/${sd}`;
      details.end = `${em}/${ed}`;
      details.current = `${currentMonth}/${currentDay}`;
      const startJd = sm * 100 + sd;
      const endJd = em * 100 + ed;
      const currentJd = currentMonth * 100 + currentDay;
      if (startJd <= endJd) {
        if (currentJd >= startJd && currentJd <= endJd) {
          return { type: 'month_day_range', result: true, reason: `${currentMonth}/${currentDay} is within ${sm}/${sd} to ${em}/${ed}`, details };
        }
        return { type: 'month_day_range', result: false, reason: `${currentMonth}/${currentDay} is outside ${sm}/${sd} to ${em}/${ed}`, details };
      }
      if (currentJd >= startJd || currentJd <= endJd) {
        return { type: 'month_day_range', result: true, reason: `${currentMonth}/${currentDay} is within ${sm}/${sd} to ${em}/${ed} (wraps across year)`, details };
      }
      return { type: 'month_day_range', result: false, reason: `${currentMonth}/${currentDay} is outside ${sm}/${sd} to ${em}/${ed}`, details };
    }

    case 'hijri_day_range': {
      const hm = condition.month;
      const sd = condition.start_day;
      const ed = condition.end_day;
      details.hijri_month = hm;
      details.start_day = sd;
      details.end_day = ed;
      const currentDay = hijriDate.day;
      details.current_hijri_day = currentDay;
      if (hijriDate.month !== hm) {
        return { type: 'hijri_day_range', result: false, reason: `Current Hijri month ${hijriDate.month} doesn't match required month ${hm}`, details };
      }
      if (currentDay >= sd && currentDay <= ed) {
        return { type: 'hijri_day_range', result: true, reason: `Hijri day ${currentDay} is within ${sd} to ${ed} of month ${hm}`, details };
      }
      return { type: 'hijri_day_range', result: false, reason: `Hijri day ${currentDay} is outside ${sd} to ${ed} of month ${hm}`, details };
    }

    case 'time_of_day': {
      const adhaanTime = details.adhaan_time as string || '00:00';
      const threshold = condition.threshold;
      const op = condition.operator;
      details.threshold = threshold;
      details.operator = op;
      details.adhaan_time = adhaanTime;
      if (adhaanTime === '00:00') {
        return { type: 'time_of_day', result: false, reason: 'Adhaan time not yet computed for this condition evaluation period', details };
      }
      const adhaanMin = parseTime(adhaanTime);
      const thresholdMin = parseTime(threshold);
      const isMatch = op === 'before' ? adhaanMin < thresholdMin : adhaanMin > thresholdMin;
      if (isMatch) {
        return { type: 'time_of_day', result: true, reason: `Adhaan (${adhaanTime}) is ${op} ${threshold}`, details };
      }
      return { type: 'time_of_day', result: false, reason: `Adhaan (${adhaanTime}) is not ${op} ${threshold}`, details };
    }
  }
}

export function replayRules(
  rules: RuleWithDb[],
  adhaanTime: string,
  gregorianDate: Date,
  hijriDate: HijriDate,
): { finalIqaamah: string; trace: RuleTrace[]; rightAfterAdhaan: boolean } {
  const trace: RuleTrace[] = [];
  let currentTime = adhaanTime;
  let rightAfterAdhaan = false;

  const sorted = [...rules].sort((a, b) => a.execution_order - b.execution_order);

  for (const rule of sorted) {
    const condEvals: ConditionEval[] = [];
    let allMatch = true;

    for (const condition of rule.conditions) {
      const evalResult = evaluateCondition(condition, gregorianDate, hijriDate);
      condEvals.push(evalResult);
      if (!evalResult.result) {
        allMatch = false;
      }
    }

    const timeBefore = currentTime;

    if (allMatch) {
      currentTime = applyAction(rule.action, currentTime);
      if (rule.action.type === 'right_after_adhaan') {
        rightAfterAdhaan = true;
      }
      trace.push({
        order: rule.execution_order,
        rule_name: rule.rule_name,
        matched: true,
        conditions: condEvals,
        action: rule.action,
        rule_id: rule.id,
        time_before: timeBefore,
        time_after: currentTime,
      });
    } else {
      trace.push({
        order: rule.execution_order,
        rule_name: rule.rule_name,
        matched: false,
        skipped: true,
        conditions: condEvals,
        action: rule.action,
        rule_id: rule.id,
      });
    }
  }

  return { finalIqaamah: currentTime, trace, rightAfterAdhaan };
}

export function explainAllPrayers(
  rules: RuleWithDb[],
  adhaanTimes: Record<PrayerName, string>,
  date: Date,
  hijriDate: HijriDate,
): Record<PrayerName, PrayerTrace> {
  const prayers: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const result: Record<string, PrayerTrace> = {};

  for (const prayer of prayers) {
    const prayerRules = rules.filter(r => r.prayer_name === prayer);
    const adhaan = adhaanTimes[prayer] || '00:00';
    const { finalIqaamah, trace } = replayRules(prayerRules, adhaan, date, hijriDate);
    result[prayer] = { adhaan, iqaamah: finalIqaamah, trace };
  }

  return result as Record<PrayerName, PrayerTrace>;
}

export function validateRules(rules: RuleWithDb[]): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];
  const prayers: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  for (const prayer of prayers) {
    const prayerRules = rules
      .filter(r => r.prayer_name === prayer)
      .sort((a, b) => a.execution_order - b.execution_order);

    if (prayerRules.length === 0) {
      warnings.push({
        severity: 'info',
        prayer,
        message: `No rules defined for ${prayerLabel(prayer)}. Iqaamah will equal adhaan time.`,
      });
      suggestions.push(`Add a default rule for ${prayerLabel(prayer)} (e.g., add_minutes: 10) to create a gap between adhaan and iqaamah.`);
      continue;
    }

    for (let i = 0; i < prayerRules.length; i++) {
      const rule = prayerRules[i]!;

      const hasAlways = rule.conditions.some(c => c.type === 'always');
      const hasSetFixed = rule.action.type === 'set_fixed_time';

      if (hasAlways && hasSetFixed) {
        for (let j = i + 1; j < prayerRules.length; j++) {
          const nextRule = prayerRules[j]!;
          const nextHasAlways = nextRule.conditions.some(c => c.type === 'always');
          if (nextHasAlways) {
            warnings.push({
              severity: 'warn',
              prayer,
              rule_ids: [rule.id, nextRule.id],
              message: `Rule '${rule.rule_name}' (order ${rule.execution_order}) always overrides the result of '${nextRule.rule_name}' (order ${nextRule.execution_order}). Rule ${nextRule.rule_name}'s action will never run.`,
            });
          }
        }
      }

      if (rule.action.type === 'right_after_adhaan') {
        for (let j = i + 1; j < prayerRules.length; j++) {
          const nextRule = prayerRules[j]!;
          if (nextRule.action.type === 'add_minutes' || nextRule.action.type === 'set_fixed_time' || nextRule.action.type.startsWith('round_')) {
            warnings.push({
              severity: 'warn',
              prayer,
              rule_ids: [rule.id, nextRule.id],
              message: `Rule '${rule.rule_name}' sets right_after_adhaan, but '${nextRule.rule_name}' (order ${nextRule.execution_order}) changes the time. The right_after_adhaan flag may not apply as expected.`,
            });
            break;
          }
        }
      }
    }

    const orderNumbers = prayerRules.map(r => r.execution_order);
    const expected = Array.from({ length: orderNumbers.length }, (_, i) => i);
    const isSequential = orderNumbers.every((n, i) => n === i);
    const hasGaps = new Set(orderNumbers).size !== orderNumbers.length || !isSequential;
    if (hasGaps && prayerRules.length > 1) {
      warnings.push({
        severity: 'info',
        prayer,
        message: `Rule execution order for ${prayerLabel(prayer)} is not sequential (${orderNumbers.join(', ')}). This won't cause errors but may be confusing.`,
      });
    }

    const ruleNames = prayerRules.map(r => r.rule_name);
    const uniqueNames = new Set(ruleNames);
    if (uniqueNames.size !== ruleNames.length) {
      warnings.push({
        severity: 'info',
        prayer,
        message: `Two or more rules for ${prayerLabel(prayer)} share the same name. Consider giving each rule a unique name.`,
      });
    }

    for (const r of prayerRules) {
      for (const c of r.conditions) {
        if (c.type === 'date_range') {
          const today = new Date().toISOString().slice(0, 10);
          if (c.end < today) {
            warnings.push({
              severity: 'info',
              prayer,
              rule_ids: [r.id],
              message: `Rule '${r.rule_name}' has a date_range condition ending ${c.end}, which is in the past. This rule will never match again.`,
            });
          }
        }
      }
    }
  }

  return {
    valid: warnings.filter(w => w.severity === 'warn').length === 0,
    warnings,
    suggestions,
  };
}

function prayerLabel(p: PrayerName): string {
  const labels: Record<PrayerName, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  return labels[p] || p;
}