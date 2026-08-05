import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, jumuahSessions, announcements } from '$lib/server/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { computeIqaamah } from '$lib/server/prayer/engine';
import { parseStyleOptionsJson } from '$lib/server/style-options';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db.select().from(masjids).where(eq(masjids.slug, params.slug)).get();
    if (!masjid) return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');

    // Use raw SQL to avoid Drizzle column-position mismatch on D1
    const themeRows = await db.all(sql`
      SELECT style_system, style_options, layout_preset, primary_color,
             accent_color, font_heading, font_body, time_format,
             label_adhaan, label_iqaamah, label_jumuah, label_speech,
             label_sunrise, label_fajr, label_dhuhr, label_asr,
             label_maghrib, label_isha
      FROM masjid_themes WHERE masjid_id = ${masjid.id}
    `) as Array<{
      style_system: string; style_options: string; layout_preset: string;
      primary_color: string; accent_color: string; font_heading: string;
      font_body: string; time_format: string; label_adhaan: string;
      label_iqaamah: string; label_jumuah: string; label_speech: string;
      label_sunrise: string; label_fajr: string; label_dhuhr: string;
      label_asr: string; label_maghrib: string; label_isha: string;
    }>;
    const theme = themeRows[0] ?? null;

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
    const todayTimes = await computeIqaamah(masjidConfig, today, db);

    const upcomingDays = [];
    for (let offset = 1; offset <= 7; offset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      const dayTimes = await computeIqaamah(masjidConfig, date, db);
      upcomingDays.push({
        date: date.toISOString().split('T')[0],
        times: dayTimes,
      });
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
        date: today.toISOString().split('T')[0],
        times: todayTimes,
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
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch board');
  }
};