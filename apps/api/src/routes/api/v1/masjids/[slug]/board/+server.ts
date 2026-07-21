import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, jumuahSessions, announcements } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { computeIqaamah } from '$lib/server/prayer/engine';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db.select().from(masjids).where(eq(masjids.slug, params.slug)).get();
    if (!masjid) return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');

    const theme = await db
      .select()
      .from(masjidThemes)
      .where(eq(masjidThemes.masjidId, masjid.id))
      .get();

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
      latitude: masjid.latitude,
      longitude: masjid.longitude,
      timezone: masjid.timezone,
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
      }));

    return JsonResponse({
      masjid: {
        slug: masjid.slug,
        name: masjid.name,
        city: masjid.city,
        state: masjid.state,
        external_donation_url: masjid.externalDonationUrl,
      },
      theme: {
        primary_color: theme?.primaryColor ?? '#1e3a8a',
        accent_color: theme?.accentColor ?? '#10b981',
        font_heading: theme?.fontHeading ?? 'Inter',
        font_body: theme?.fontBody ?? 'Inter',
        layout_preset: theme?.layoutPreset ?? 'modern_minimal',
        time_format: theme?.timeFormat ?? '24h',
        label_adhaan: theme?.labelAdhaan ?? 'Adhaan',
        label_iqaamah: theme?.labelIqaamah ?? 'Iqaamah',
        label_jumuah: theme?.labelJumuah ?? "Jumu'ah",
        label_sunrise: theme?.labelSunrise ?? 'Sunrise',
        label_fajr: theme?.labelFajr ?? 'Fajr',
        label_dhuhr: theme?.labelDhuhr ?? 'Dhuhr',
        label_asr: theme?.labelAsr ?? 'Asr',
        label_maghrib: theme?.labelMaghrib ?? 'Maghrib',
        label_isha: theme?.labelIsha ?? 'Isha',
      },
      today: {
        date: today.toISOString().split('T')[0],
        times: todayTimes,
      },
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