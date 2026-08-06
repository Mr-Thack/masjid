import { z } from 'zod';

export interface FormattedZodError {
  message: string;
  field?: string;
  path: string;
  code: string;
  provided?: unknown;
  allowed?: unknown[];
}

export function formatZodError(zodError: z.ZodError): FormattedZodError {
  const issue = zodError.issues[0];

  if (!issue) {
    return { message: 'Unknown validation error', path: '', code: 'unknown' };
  }

  const path = issue.path.join('.');
  const code = issue.code;
  const message = formatZodIssue(issue);

  const result: FormattedZodError = { message, path, code };

  if (issue.code === 'invalid_enum_value' || issue.code === 'invalid_type') {
    result.provided = (issue as Record<string, unknown>).received;
  }

  if (issue.code === 'invalid_enum_value') {
    const enumIssue = issue as { options: unknown[] };
    result.allowed = enumIssue.options || [];
  }

  return result;
}

function formatZodIssue(issue: z.ZodIssue): string {
  const path = issue.path.join('.');

  if (issue.code === 'custom') {
    return `${path ? path + ': ' : ''}${issue.message}`;
  }

  if (issue.code === 'invalid_type') {
    const typeIssue = issue as { expected: string; received: string };
    if (typeIssue.expected === 'string' && typeIssue.received === 'undefined') {
      return `${path} is required`;
    }
    return `${path} must be a ${typeIssue.expected}, received ${typeIssue.received}`;
  }

  if (issue.code === 'invalid_enum_value') {
    const enumIssue = issue as { received: unknown; options: unknown[] };
    const opts = enumIssue.options || [];
    return `${path} value "${String(enumIssue.received)}" is invalid. Allowed: ${opts.join(', ')}`;
  }

  if (issue.code === 'invalid_literal') {
    const litIssue = issue as { expected: unknown; received: unknown };
    return `${path} must be "${String(litIssue.expected)}", received "${String(litIssue.received)}"`;
  }

  if (issue.code === 'too_small') {
    const smallIssue = issue as { minimum: number; inclusive: boolean; type: string };
    return `${path} must be at least ${smallIssue.minimum}`;
  }

  if (issue.code === 'too_big') {
    const bigIssue = issue as { maximum: number; inclusive: boolean; type: string };
    return `${path} must be at most ${bigIssue.maximum}`;
  }

  if (issue.code === 'invalid_string') {
    const strIssue = issue as { validation: string };
    if (strIssue.validation === 'regex') {
      return `${path} has an invalid format`;
    }
    if (strIssue.validation === 'email') {
      return `${path} must be a valid email address`;
    }
    return `${path}: ${issue.message}`;
  }

  return `${path ? path + ': ' : ''}${issue.message}`;
}

/**
 * Convert a ZodError into a human-readable error message specifically
 * for prayer rule validation. Handles common prayer rule field patterns.
 */
export function formatPrayerRuleError(zodError: z.ZodError): { message: string; field: string } {
  const issue = zodError.issues[0];
  if (!issue) return { message: 'Unknown validation error', field: '' };

  const path = issue.path.join('.');
  const code = issue.code;
  const message = issue.message;

  if (path === 'prayer_name' || path.includes('prayer_name')) {
    return { message: formatPrayerNameError(issue), field: 'prayer_name' };
  }

  if (path.includes('conditions_json') && path.includes('type')) {
    return { message: formatConditionTypeError(issue), field: 'conditions_json[].type' };
  }

  if (path === 'action_json.type' || path.includes('action_json.type')) {
    return { message: formatActionTypeError(issue), field: 'action_json.type' };
  }

  if (path.includes('action_json.minutes')) {
    return { message: formatMinutesError(issue), field: 'action_json.minutes' };
  }

  if (path.includes('action_json.increment')) {
    return { message: formatIncrementError(issue), field: 'action_json.increment' };
  }

  if (path.includes('action_json.time')) {
    return { message: formatTimeError(issue), field: 'action_json.time' };
  }

  if (path.includes('days')) {
    return { message: formatDayError(issue), field: 'day_of_week.days' };
  }

  if (path.includes('months') && !path.includes('hijri')) {
    return { message: formatMonthError(issue), field: 'month.months' };
  }

  if (path.includes('hijri_month') && path.includes('months')) {
    return { message: formatHijriMonthError(issue), field: 'hijri_month.months' };
  }

  if (path.includes('date_range')) {
    return { message: formatDateRangeError(issue), field: `date_range.${path.includes('start') ? 'start' : 'end'}` };
  }

  if (code === 'custom' || code === 'invalid_type') {
    return { message: formatZodIssue(issue), field: path };
  }

  return { message, field: path };
}

function formatPrayerNameError(issue: z.ZodIssue): string {
  const received = (issue as Record<string, unknown>).received as string | undefined;
  return `Invalid prayer name '${received || 'unknown'}'. Must be one of: fajr, dhuhr, asr, maghrib, isha.`;
}

function formatConditionTypeError(issue: z.ZodIssue): string {
  const received = (issue as Record<string, unknown>).received as string | undefined;
  return `Unknown condition type '${received || 'unknown'}'. Must be one of: always, day_of_week, month, hijri_month, date_range, month_day_range, hijri_day_range, time_of_day.`;
}

function formatActionTypeError(issue: z.ZodIssue): string {
  const received = (issue as Record<string, unknown>).received as string | undefined;
  return `Unknown action type '${received || 'unknown'}'. Must be one of: add_minutes, round_up, round_down, round_nearest, set_fixed_time, right_after_adhaan, set_offset_from_prayer, cap_min, cap_max.`;
}

function formatMinutesError(issue: z.ZodIssue): string {
  const code = issue.code;
  if (code === 'too_small') {
    return `add_minutes requires a positive whole number. Negative values are not allowed.`;
  }
  if (code === 'invalid_type') {
    return `add_minutes requires a number.`;
  }
  return `Invalid minutes value: ${issue.message}`;
}

function formatIncrementError(issue: z.ZodIssue): string {
  if (issue.code === 'custom') {
    return `Rounding increment must be one of 1, 5, 10, 15, 20, 30, or 60. ${issue.message}`;
  }
  return `Rounding increment must be one of 1, 5, 10, 15, 20, 30, or 60.`;
}

function formatTimeError(issue: z.ZodIssue): string {
  return `Invalid time format. Use HH:MM 24-hour format (e.g., 13:30).`;
}

function formatDayError(issue: z.ZodIssue): string {
  return `Day of week values must be between 0 (Sunday) and 6 (Saturday).`;
}

function formatMonthError(issue: z.ZodIssue): string {
  return `Month values must be between 1 (January) and 12 (December).`;
}

function formatHijriMonthError(issue: z.ZodIssue): string {
  return `Hijri month values must be between 1 (Muharram) and 12 (Dhul Hijjah).`;
}

function formatDateRangeError(issue: z.ZodIssue): string {
  return `Invalid date format. Use YYYY-MM-DD format (e.g., 2026-08-05).`;
}