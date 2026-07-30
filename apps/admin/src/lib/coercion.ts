const ASR_MADHAB_VALUES = ['shafi', 'hanafi'] as const;
const HIGH_LATITUDE_VALUES = ['seventh_of_night', 'middle_of_night', 'twilight_angle', 'none'] as const;

export type AsrMadhab = (typeof ASR_MADHAB_VALUES)[number];
export type HighLatitudeRule = (typeof HIGH_LATITUDE_VALUES)[number];

export function coerceEnum<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return (typeof val === 'string' && (allowed as readonly string[]).includes(val)) ? val as T : fallback;
}

export function coerceAsrMadhab(val: unknown): AsrMadhab {
  return coerceEnum(val, ASR_MADHAB_VALUES, 'shafi');
}

export function coerceHighLatitudeRule(val: unknown): HighLatitudeRule {
  return coerceEnum(val, HIGH_LATITUDE_VALUES, 'seventh_of_night');
}

export function coerceAngle(val: unknown): number | null {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function coerceBoolean(val: unknown): boolean {
  return Boolean(val);
}
