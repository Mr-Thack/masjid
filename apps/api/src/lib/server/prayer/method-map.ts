import { CalculationMethod, Madhab, HighLatitudeRule } from 'adhan';

export function madhabFromString(madhab: string) {
  return madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
}

export function highLatitudeRuleFromString(rule: string) {
  switch (rule) {
    case 'middle_of_night': return HighLatitudeRule.MiddleOfTheNight;
    case 'seventh_of_night': return HighLatitudeRule.SeventhOfTheNight;
    case 'twilight_angle': return HighLatitudeRule.TwilightAngle;
    default: return HighLatitudeRule.SeventhOfTheNight;
  }
}

export function calculationMethodFromInt(method: number) {
  switch (method) {
    case 1: return CalculationMethod.NorthAmerica();
    case 2: return CalculationMethod.NorthAmerica();
    case 3: return CalculationMethod.MuslimWorldLeague();
    case 4: return CalculationMethod.UmmAlQura();
    case 5: return CalculationMethod.Egyptian();
    case 6: return CalculationMethod.Tehran();
    case 7: return CalculationMethod.Karachi();
    case 8: return CalculationMethod.Turkey();
    case 9: return CalculationMethod.Singapore();
    case 10: return CalculationMethod.Dubai();
    case 11: return CalculationMethod.Kuwait();
    case 12: return CalculationMethod.Qatar();
    case 13: return CalculationMethod.MoonsightingCommittee();
    default: return CalculationMethod.NorthAmerica();
  }
}

export const METHOD_OPTIONS = [
  { value: 2, label: 'ISNA (North America, default)' },
  { value: 3, label: 'Muslim World League' },
  { value: 4, label: 'Umm al-Qura (Makkah)' },
  { value: 5, label: 'Egyptian General Authority' },
  { value: 7, label: 'University of Islamic Sciences, Karachi' },
  { value: 6, label: 'Institute of Geophysics, Tehran' },
  { value: 8, label: 'Turkey (Diyanet)' },
  { value: 9, label: 'Singapore / Malaysia / Indonesia' },
  { value: 10, label: 'Dubai (UAE)' },
  { value: 11, label: 'Kuwait' },
  { value: 12, label: 'Qatar' },
  { value: 13, label: 'Moonsighting Committee (recommended for N. America / UK)' },
];

export const MADHAB_OPTIONS = [
  { value: 'shafi', label: 'Shafi (earlier Asr)' },
  { value: 'hanafi', label: 'Hanafi (later Asr)' },
];

export const HIGH_LATITUDE_OPTIONS = [
  { value: 'seventh_of_night', label: 'Seventh of Night (recommended above 48°N)' },
  { value: 'middle_of_night', label: 'Middle of Night' },
  { value: 'twilight_angle', label: 'Twilight Angle' },
  { value: 'none', label: 'None (use raw angles)' },
];