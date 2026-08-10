import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { computeIqaamah } from '$lib/server/prayer/engine';
import { findNearestIqaamahChanges } from '@masjid/ui-utils';
import type { RequestHandler } from './$types';

const PRAYER_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

export const GET: RequestHandler = async ({ params, url, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select()
      .from(masjids)
      .where(eq(masjids.slug, params.slug))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const masjidConfig = {
      id: masjid.id,
      calculation_method: masjid.calculationMethod,
      fajr_angle: masjid.fajrAngle,
      isha_angle: masjid.ishaAngle,
      adjust_fajr: masjid.adjustFajr,
      adjust_sunrise: masjid.adjustSunrise,
      adjust_dhuhr: masjid.adjustDhuhr,
      adjust_asr: masjid.adjustAsr,
      adjust_maghrib: masjid.adjustMaghrib,
      adjust_isha: masjid.adjustIsha,
      latitude: masjid.latitude,
      longitude: masjid.longitude,
      timezone: masjid.timezone,
      asr_madhab: masjid.asrMadhab ?? 'shafi',
      high_latitude_rule: masjid.highLatitudeRule ?? 'seventh_of_night',
      show_dual_asr: !!masjid.showDualAsr,
    };

    const startParam = url.searchParams.get('start');
    let startDate: Date;
    if (startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam)) {
      startDate = new Date(startParam + 'T12:00:00Z');
    } else {
      startDate = new Date();
    }

    const today = new Date();

    const days = [];
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + offset);
      const dateStr = date.toISOString().slice(0, 10);
      try {
        const times = await computeIqaamah(masjidConfig, date, db);
        days.push({
          date: dateStr,
          times: {
            fajr: times.fajr,
            sunrise: times.sunrise,
            dhuhr: times.dhuhr,
            asr: times.asr,
            asr_secondary: times.asr_secondary ?? null,
            maghrib: times.maghrib,
            isha: times.isha,
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`weekly: failed to compute times for ${params.slug} on ${dateStr}:`, msg);
        days.push({ date: dateStr, times: null, error: msg });
      }
    }

    let changes: Array<{ date: string; prayer: string; from: string; to: string }> = [];
    try {
      const baseTimes = await computeIqaamah(masjidConfig, today, db);
      const baseIqaamahs: Record<string, { iqaamah: string }> = {};
      for (const prayer of PRAYER_ORDER) {
        const entry = baseTimes[prayer];
        baseIqaamahs[prayer] = { iqaamah: entry?.iqaamah ?? '--:--' };
      }

      const futureDays = days
        .map((d) => ({
          date: d.date,
          times: d.times
            ? Object.fromEntries(
                PRAYER_ORDER.map((p) => [p, { iqaamah: (d.times as Record<string, { iqaamah: string }>)[p]?.iqaamah ?? '--:--' }]),
              )
            : {},
        }));

      changes = findNearestIqaamahChanges(baseIqaamahs, futureDays, [...PRAYER_ORDER]);
    } catch (e: unknown) {
      console.error(`weekly: failed to compute changes for ${params.slug}:`, e instanceof Error ? e.message : String(e));
    }

    return JsonResponse({
      start_date: startDate.toISOString().slice(0, 10),
      base_date: today.toISOString().slice(0, 10),
      masjid: {
        slug: masjid.slug,
        name: masjid.name,
      },
      days,
      changes,
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to compute weekly prayer times');
  }
};