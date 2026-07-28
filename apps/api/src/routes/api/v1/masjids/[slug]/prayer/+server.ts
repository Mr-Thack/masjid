import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { computeIqaamah } from '$lib/server/prayer/engine';
import type { RequestHandler } from './$types';

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

    const dateParam = url.searchParams.get('date');
    let date: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      date = new Date(dateParam + 'T12:00:00Z');
    } else {
      date = new Date();
    }
    const dateStr = date.toISOString().slice(0, 10);

    const times = await computeIqaamah(
      {
        id: masjid.id,
        calculation_method: masjid.calculationMethod,
        latitude: masjid.latitude,
        longitude: masjid.longitude,
        timezone: masjid.timezone,
        asr_madhab: masjid.asrMadhab ?? 'shafi',
        high_latitude_rule: masjid.highLatitudeRule ?? 'seventh_of_night',
        show_dual_asr: !!masjid.showDualAsr,
      },
      date,
      db,
    );

    const methodNames: Record<number, string> = {
      1: 'ISNA',
      2: 'ISNA',
      3: 'MWL',
      4: 'Umm al-Qura',
      5: 'Egyptian',
      6: 'Tehran',
      7: 'Karachi',
      8: 'Turkey',
      9: 'Singapore',
      10: 'Dubai',
      11: 'Kuwait',
      12: 'Qatar',
      13: 'Moonsighting Committee',
    };

    return JsonResponse({
      date: dateStr,
      masjid: {
        slug: masjid.slug,
        name: masjid.name,
      },
      calculation_method: methodNames[masjid.calculationMethod] ?? 'ISNA',
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
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to compute prayer times');
  }
};