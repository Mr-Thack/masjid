import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb, fetchThemeRow } from '$lib/server/db';
import { masjids, jumuahSessions, announcements } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { computeIqaamah, type ComputedTimes } from '$lib/server/prayer/engine';
import { parseStyleOptionsJson } from '$lib/server/style-options';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db.select().from(masjids).where(eq(masjids.slug, params.slug)).get();
    if (!masjid) return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');

    const theme = await fetchThemeRow(db, masjid.id, platform?.env?.DB);

    const sessions = await db
      .select()
      .from(jumuahSessions)
      .where(eq(jumuahSessions.masjidId, masjid.id));

    const pinnedAnnouncement = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.masjidId, masjid.id),
          eq(announcements.isPinned, true),
          eq(announcements.status, 'published'),
        ),
      )
      .get();

    const recentAnnouncements = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.masjidId, masjid.id),
          eq(announcements.status, 'published'),
        ),
      )
      .orderBy(desc(announcements.publishedAt))
      .limit(20);

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

    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0];
    let todayTimesData: ComputedTimes | null = null;
    let todayError: string | null = null;
    try {
      todayTimesData = await computeIqaamah(masjidConfig, today, db);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Board: failed to compute today's times for ${params.slug}:`, message);
      todayError = message;
    }

    const upcomingDays = [];
    for (let offset = 1; offset <= 7; offset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      const dateStr = date.toISOString().split('T')[0];
      try {
        const dayTimes = await computeIqaamah(masjidConfig, date, db);
        upcomingDays.push({
          date: dateStr,
          times: dayTimes,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`Board: failed to compute times for ${params.slug} on ${dateStr}:`, message);
        upcomingDays.push({
          date: dateStr,
          times: null,
          error: message,
        });
      }
    }

    const activeSessions = sessions
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s.id,
        label: s.label,
        time: s.time,
        khateeb: s.khateeb,
        speech_time: s.speechTime,
      }));

    return JsonResponse({
      masjid: {
        slug: masjid.slug,
        name: masjid.name,
        city: masjid.city,
        state: masjid.state,
        asr_madhab: masjid.asrMadhab ?? 'shafi',
        external_donation_url: masjid.externalDonationUrl,
      },
      theme: {
        style_system: theme?.style_system ?? 'sakeenah',
        style_options: parseStyleOptionsJson(theme?.style_options),
        primary_color: theme?.primary_color ?? '#1e3a8a',
        accent_color: theme?.accent_color ?? '#10b981',
        font_heading: theme?.font_heading ?? 'Inter',
        font_body: theme?.font_body ?? 'Inter',
        layout_preset: theme?.layout_preset ?? 'modern_minimal',
        time_format: theme?.time_format ?? '24h',
        label_adhaan: theme?.label_adhaan ?? 'Adhaan',
        label_iqaamah: theme?.label_iqaamah ?? 'Iqaamah',
        label_jumuah: theme?.label_jumuah ?? "Jumu'ah",
        label_speech: theme?.label_speech ?? 'Speech',
        label_sunrise: theme?.label_sunrise ?? 'Sunrise',
        label_fajr: theme?.label_fajr ?? 'Fajr',
        label_dhuhr: theme?.label_dhuhr ?? 'Dhuhr',
        label_asr: theme?.label_asr ?? 'Asr',
        label_maghrib: theme?.label_maghrib ?? 'Maghrib',
        label_isha: theme?.label_isha ?? 'Isha',
      },
      today: {
        date: todayDateStr,
        times: todayTimesData,
        ...(todayError ? { error: todayError } : {}),
      },
      // Server-synchronized time (docs/design-language.md §7.7): the TV
      // corrects its clock against this so ceremony states stay honest even
      // when smart-TV hardware clocks drift.
      server_time: today.toISOString(),
      upcoming_days: upcomingDays,
      jumuah: activeSessions,
      pinned_announcement: pinnedAnnouncement
        ? {
            title: pinnedAnnouncement.title,
            compiled_html: pinnedAnnouncement.compiledHtml,
          }
        : null,
      recent_announcements: recentAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        compiled_html: a.compiledHtml,
        status: a.status,
        published_at: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
        expires_at: a.expiresAt ? new Date(a.expiresAt).toISOString() : null,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('GET board error:', message, e instanceof Error ? e.stack : '');
    return ErrorJsonResponse('INTERNAL_ERROR', `Failed to fetch board: ${message}`);
  }
};