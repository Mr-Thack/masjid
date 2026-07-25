import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import {
  masjids,
  masjidThemes,
  jumuahSessions,
  announcements,
} from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { computeIqaamah } from '$lib/server/prayer/engine';
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

    const today = new Date();
    const times = await computeIqaamah(
      {
        id: masjid.id,
        calculation_method: masjid.calculationMethod,
        latitude: masjid.latitude,
        longitude: masjid.longitude,
        timezone: masjid.timezone,
      },
      today,
      db,
    );

    return JsonResponse({
      masjid: {
        slug: masjid.slug,
        name: masjid.name,
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
      theme: theme
        ? {
            layout_preset: theme.layoutPreset,
            primary_color: theme.primaryColor,
            accent_color: theme.accentColor,
            font_heading: theme.fontHeading,
            font_body: theme.fontBody,
            time_format: theme.timeFormat,
            label_adhaan: theme.labelAdhaan,
            label_iqaamah: theme.labelIqaamah,
            label_jumuah: theme.labelJumuah,
            label_speech: theme.labelSpeech,
            label_sunrise: theme.labelSunrise,
            label_fajr: theme.labelFajr,
            label_dhuhr: theme.labelDhuhr,
            label_asr: theme.labelAsr,
            label_maghrib: theme.labelMaghrib,
            label_isha: theme.labelIsha,
          }
        : null,
      calculation_method: masjid.calculationMethod,
      timezone: masjid.timezone,
      prayer_times: {
        fajr: times.fajr,
        sunrise: times.sunrise,
        dhuhr: times.dhuhr,
        asr: times.asr,
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