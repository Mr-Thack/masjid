import { Coordinates, PrayerTimes, Madhab } from 'adhan';
import { calculationMethodFromInt, madhabFromString, highLatitudeRuleFromString } from './method-map';

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface MasjidLocation {
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

function utcDateToLocalHM(utcDate: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(utcDate);

  const hourPart = parts.find((p) => p.type === 'hour')?.value;
  const minutePart = parts.find((p) => p.type === 'minute')?.value;
  if (!hourPart || !minutePart) return '--:--';

  let hour = Number(hourPart);
  if (hour === 24) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minutePart}`;
}

export function calculateAdhaan(
  masjid: MasjidLocation,
  date: Date,
): Record<Exclude<PrayerName, 'sunrise'> | 'sunrise', string> & { asr_secondary?: string } {
  const coordinates = new Coordinates(masjid.latitude, masjid.longitude);
  const params = calculationMethodFromInt(masjid.calculation_method);
  params.madhab = madhabFromString(masjid.asr_madhab);
  params.highLatitudeRule = highLatitudeRuleFromString(masjid.high_latitude_rule);
  if (masjid.fajr_angle != null) params.fajrAngle = masjid.fajr_angle;
  if (masjid.isha_angle != null) params.ishaAngle = masjid.isha_angle;
  params.adjustments.fajr = masjid.adjust_fajr;
  params.adjustments.sunrise = masjid.adjust_sunrise;
  params.adjustments.dhuhr = masjid.adjust_dhuhr;
  params.adjustments.asr = masjid.adjust_asr;
  params.adjustments.maghrib = masjid.adjust_maghrib;
  params.adjustments.isha = masjid.adjust_isha;

  const prayerDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    12, 0, 0,
  ));

  const pt = new PrayerTimes(coordinates, prayerDate, params);

  const result: Record<string, string> = {
    fajr: utcDateToLocalHM(pt.fajr, masjid.timezone),
    sunrise: utcDateToLocalHM(pt.sunrise, masjid.timezone),
    dhuhr: utcDateToLocalHM(pt.dhuhr, masjid.timezone),
    asr: utcDateToLocalHM(pt.asr, masjid.timezone),
    maghrib: utcDateToLocalHM(pt.maghrib, masjid.timezone),
    isha: utcDateToLocalHM(pt.isha, masjid.timezone),
  };

  if (masjid.show_dual_asr) {
    const otherMadhab = masjid.asr_madhab === 'hanafi' ? Madhab.Shafi : Madhab.Hanafi;
    const secondaryParams = calculationMethodFromInt(masjid.calculation_method);
    secondaryParams.madhab = otherMadhab;
    secondaryParams.highLatitudeRule = highLatitudeRuleFromString(masjid.high_latitude_rule);
    if (masjid.fajr_angle != null) secondaryParams.fajrAngle = masjid.fajr_angle;
    if (masjid.isha_angle != null) secondaryParams.ishaAngle = masjid.isha_angle;
    const secondaryPt = new PrayerTimes(coordinates, prayerDate, secondaryParams);
    result.asr_secondary = utcDateToLocalHM(secondaryPt.asr, masjid.timezone);
  }

  return result;
}