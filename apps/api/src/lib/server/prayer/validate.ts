import { computeIqaamah } from './engine';
import { masjids } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Db } from '../db';

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

export async function fetchMasjidConfig(masjidId: string, db: Db): Promise<MasjidConfig | null> {
  const row = await db
    .select({
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
    .where(eq(masjids.id, masjidId))
    .get();

  if (!row) return null;

  return {
    id: masjidId,
    calculation_method: row.calculation_method,
    fajr_angle: row.fajr_angle,
    isha_angle: row.isha_angle,
    adjust_fajr: row.adjust_fajr,
    adjust_sunrise: row.adjust_sunrise,
    adjust_dhuhr: row.adjust_dhuhr,
    adjust_asr: row.adjust_asr,
    adjust_maghrib: row.adjust_maghrib,
    adjust_isha: row.adjust_isha,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone,
    asr_madhab: row.asr_madhab,
    high_latitude_rule: row.high_latitude_rule,
    show_dual_asr: row.show_dual_asr,
  };
}

export async function validateRulesHealth(masjidId: string, db: Db): Promise<{ healthy: boolean; failingDates: string[] } | null> {
  const config = await fetchMasjidConfig(masjidId, db);
  if (!config) return null;

  const failingDates: string[] = [];
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  for (let offset = 0; offset < 30; offset++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + offset);
    try {
      await computeIqaamah(config, date, db);
    } catch {
      failingDates.push(date.toISOString().slice(0, 10));
    }
  }

  return { healthy: failingDates.length === 0, failingDates };
}