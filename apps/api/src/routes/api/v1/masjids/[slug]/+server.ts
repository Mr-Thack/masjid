import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb, fetchThemeRow } from '$lib/server/db';
import {
  masjids,
  jumuahSessions,
  announcements,
} from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { computeIqaamah } from '$lib/server/prayer/engine';
import { parseStyleOptionsJson } from '$lib/server/style-options';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
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

    const rawTheme = await fetchThemeRow(db, masjid.id, platform?.env?.DB);

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

    const today = new Date();
    const times = await computeIqaamah(
      {
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
      },
      today,
      db,
    );

    return JsonResponse({
      masjid: {
        slug: masjid.slug,
        name: masjid.name,
        asr_madhab: masjid.asrMadhab ?? 'shafi',
        address_line1: masjid.addressLine1,
        address_line2: masjid.addressLine2,
        city: masjid.city,
        state: masjid.state,
        postal_code: masjid.postalCode,
        country: masjid.country,
        contact_phone: masjid.contactPhone,
        contact_email: masjid.contactEmail,
        facebook_url: masjid.facebookUrl,
        youtube_url: masjid.youtubeUrl,
        instagram_url: masjid.instagramUrl,
        website_url: masjid.websiteUrl,
        external_donation_url: masjid.externalDonationUrl,
      },
      theme: rawTheme
        ? {
            style_system: rawTheme.style_system,
            style_options: parseStyleOptionsJson(rawTheme.style_options),
            layout_preset: rawTheme.layout_preset,
            primary_color: rawTheme.primary_color,
            accent_color: rawTheme.accent_color,
            font_heading: rawTheme.font_heading,
            font_body: rawTheme.font_body,
            time_format: rawTheme.time_format,
            label_adhaan: rawTheme.label_adhaan,
            label_iqaamah: rawTheme.label_iqaamah,
            label_jumuah: rawTheme.label_jumuah,
            label_speech: rawTheme.label_speech,
            label_sunrise: rawTheme.label_sunrise,
            label_fajr: rawTheme.label_fajr,
            label_dhuhr: rawTheme.label_dhuhr,
            label_asr: rawTheme.label_asr,
            label_maghrib: rawTheme.label_maghrib,
            label_isha: rawTheme.label_isha,
          }
        : null,
      calculation_method: masjid.calculationMethod,
      timezone: masjid.timezone,
      prayer_times: {
        fajr: times.fajr,
        sunrise: times.sunrise,
        dhuhr: times.dhuhr,
        asr: times.asr,
        asr_secondary: times.asr_secondary ?? null,
        maghrib: times.maghrib,
        isha: times.isha,
      },
      jumuah: sessions
        .filter((s) => s.isActive)
        .map((s) => ({
          id: s.id,
          label: s.label,
          time: s.time,
          khateeb: s.khateeb,
          speech_time: s.speechTime,
        })),
      pinned_announcement: pinnedAnnouncement
        ? {
            title: pinnedAnnouncement.title,
            slug: pinnedAnnouncement.slug,
            compiled_html: pinnedAnnouncement.compiledHtml,
            published_at: pinnedAnnouncement.publishedAt,
          }
        : null,
      recent_announcements: recentAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        compiled_html: a.compiledHtml,
        status: a.status,
        published_at: a.publishedAt,
        expires_at: a.expiresAt,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('GET masjid page error:', message, e instanceof Error ? e.stack : '');
    return ErrorJsonResponse('INTERNAL_ERROR', `Failed to fetch masjid page: ${message}`);
  }
};