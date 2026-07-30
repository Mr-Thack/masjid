import {
  UpdateMasjidSchema,
  UpdateThemeSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateMasjidCache, invalidatePageCache } from '$lib/server/prayer/cache';
import { parseStyleOptionsJson } from '$lib/server/style-options';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);
    const masjid = await db
      .select()
      .from(masjids)
      .where(eq(masjids.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const theme = await db
      .select()
      .from(masjidThemes)
      .where(eq(masjidThemes.masjidId, params.id))
      .get();

    return JsonResponse({
      id: masjid.id,
      slug: masjid.slug,
      name: masjid.name,
      latitude: masjid.latitude,
      longitude: masjid.longitude,
      timezone: masjid.timezone,
      calculation_method: masjid.calculationMethod,
      asr_madhab: masjid.asrMadhab,
      high_latitude_rule: masjid.highLatitudeRule,
      show_dual_asr: !!masjid.showDualAsr,
      tenant_status: masjid.tenantStatus,
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
      created_at: masjid.createdAt,
      theme: theme
        ? {
            style_system: theme.styleSystem,
            style_options: parseStyleOptionsJson(theme.styleOptions),
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
    });
  } catch (e: unknown) {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch masjid profile');
  }
};

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only update your own masjid');
  }

  try {
    const body = await request.json();
    const masjidUpdate = UpdateMasjidSchema.parse(body);
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select({ slug: masjids.slug })
      .from(masjids)
      .where(eq(masjids.id, params.id))
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const now = new Date().toISOString();
    const masjidData: Record<string, unknown> = {};

    if (masjidUpdate.name !== undefined) masjidData.name = masjidUpdate.name;
    if (masjidUpdate.address_line1 !== undefined) masjidData.addressLine1 = masjidUpdate.address_line1;
    if (masjidUpdate.address_line2 !== undefined) masjidData.addressLine2 = masjidUpdate.address_line2;
    if (masjidUpdate.city !== undefined) masjidData.city = masjidUpdate.city;
    if (masjidUpdate.state !== undefined) masjidData.state = masjidUpdate.state;
    if (masjidUpdate.postal_code !== undefined) masjidData.postalCode = masjidUpdate.postal_code;
    if (masjidUpdate.country !== undefined) masjidData.country = masjidUpdate.country;
    if (masjidUpdate.contact_phone !== undefined) masjidData.contactPhone = masjidUpdate.contact_phone;
    if (masjidUpdate.contact_email !== undefined) masjidData.contactEmail = masjidUpdate.contact_email;
    if (masjidUpdate.facebook_url !== undefined) masjidData.facebookUrl = masjidUpdate.facebook_url;
    if (masjidUpdate.youtube_url !== undefined) masjidData.youtubeUrl = masjidUpdate.youtube_url;
    if (masjidUpdate.instagram_url !== undefined) masjidData.instagramUrl = masjidUpdate.instagram_url;
    if (masjidUpdate.website_url !== undefined) masjidData.websiteUrl = masjidUpdate.website_url;
    if (masjidUpdate.external_donation_url !== undefined) masjidData.externalDonationUrl = masjidUpdate.external_donation_url;
    if (masjidUpdate.calculation_method !== undefined) masjidData.calculationMethod = masjidUpdate.calculation_method;
    if (masjidUpdate.asr_madhab !== undefined) masjidData.asrMadhab = masjidUpdate.asr_madhab;
    if (masjidUpdate.high_latitude_rule !== undefined) masjidData.highLatitudeRule = masjidUpdate.high_latitude_rule;
    if (masjidUpdate.show_dual_asr !== undefined) masjidData.showDualAsr = masjidUpdate.show_dual_asr;
    if (masjidUpdate.timezone !== undefined) masjidData.timezone = masjidUpdate.timezone;
    if (masjidUpdate.latitude !== undefined) masjidData.latitude = masjidUpdate.latitude;
    if (masjidUpdate.longitude !== undefined) masjidData.longitude = masjidUpdate.longitude;

    if (Object.keys(masjidData).length > 0) {
      await db.update(masjids).set(masjidData).where(eq(masjids.id, params.id));
    }

    const THEME_KEYS = ['style_system', 'style_options', 'layout_preset', 'primary_color', 'accent_color',
      'font_heading', 'font_body', 'time_format',
      'label_adhaan', 'label_iqaamah', 'label_jumuah', 'label_speech', 'label_sunrise',
      'label_fajr', 'label_dhuhr', 'label_asr', 'label_maghrib', 'label_isha'];
    const hasThemeKeys = THEME_KEYS.some((k) => k in body);

    if (hasThemeKeys) {
      const themeUpdate = UpdateThemeSchema.safeParse(body);
      if (themeUpdate.success && Object.keys(themeUpdate.data).length > 0) {
        const themeData: Record<string, unknown> = {};
        if (themeUpdate.data.style_system !== undefined) themeData.styleSystem = themeUpdate.data.style_system;
        if (themeUpdate.data.style_options !== undefined) themeData.styleOptions = JSON.stringify(themeUpdate.data.style_options);
        if (themeUpdate.data.layout_preset !== undefined) themeData.layoutPreset = themeUpdate.data.layout_preset;
        if (themeUpdate.data.primary_color !== undefined) themeData.primaryColor = themeUpdate.data.primary_color;
        if (themeUpdate.data.accent_color !== undefined) themeData.accentColor = themeUpdate.data.accent_color;
        if (themeUpdate.data.font_heading !== undefined) themeData.fontHeading = themeUpdate.data.font_heading;
        if (themeUpdate.data.font_body !== undefined) themeData.fontBody = themeUpdate.data.font_body;
        if (themeUpdate.data.time_format !== undefined) themeData.timeFormat = themeUpdate.data.time_format;
        if (themeUpdate.data.label_adhaan !== undefined) themeData.labelAdhaan = themeUpdate.data.label_adhaan;
        if (themeUpdate.data.label_iqaamah !== undefined) themeData.labelIqaamah = themeUpdate.data.label_iqaamah;
        if (themeUpdate.data.label_jumuah !== undefined) themeData.labelJumuah = themeUpdate.data.label_jumuah;
        if (themeUpdate.data.label_speech !== undefined) themeData.labelSpeech = themeUpdate.data.label_speech;
        if (themeUpdate.data.label_sunrise !== undefined) themeData.labelSunrise = themeUpdate.data.label_sunrise;
        if (themeUpdate.data.label_fajr !== undefined) themeData.labelFajr = themeUpdate.data.label_fajr;
        if (themeUpdate.data.label_dhuhr !== undefined) themeData.labelDhuhr = themeUpdate.data.label_dhuhr;
        if (themeUpdate.data.label_asr !== undefined) themeData.labelAsr = themeUpdate.data.label_asr;
        if (themeUpdate.data.label_maghrib !== undefined) themeData.labelMaghrib = themeUpdate.data.label_maghrib;
        if (themeUpdate.data.label_isha !== undefined) themeData.labelIsha = themeUpdate.data.label_isha;
        if (Object.keys(themeData).length > 0) {
          await db.update(masjidThemes).set(themeData).where(eq(masjidThemes.masjidId, params.id));
        }
      }
    }

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    await invalidatePageCache(platform?.env?.CACHE, existing.slug);

    const updated = await db.select().from(masjids).where(eq(masjids.id, params.id)).get();
    const updatedTheme = await db.select().from(masjidThemes).where(eq(masjidThemes.masjidId, params.id)).get();

    return JsonResponse({
      id: updated?.id,
      slug: updated?.slug,
      name: updated?.name,
      latitude: updated?.latitude,
      longitude: updated?.longitude,
      timezone: updated?.timezone,
      calculation_method: updated?.calculationMethod,
      asr_madhab: updated?.asrMadhab,
      high_latitude_rule: updated?.highLatitudeRule,
      show_dual_asr: !!updated?.showDualAsr,
      tenant_status: updated?.tenantStatus,
      address_line1: updated?.addressLine1,
      address_line2: updated?.addressLine2,
      city: updated?.city,
      state: updated?.state,
      postal_code: updated?.postalCode,
      country: updated?.country,
      contact_phone: updated?.contactPhone,
      contact_email: updated?.contactEmail,
      facebook_url: updated?.facebookUrl,
      youtube_url: updated?.youtubeUrl,
      instagram_url: updated?.instagramUrl,
      website_url: updated?.websiteUrl,
      external_donation_url: updated?.externalDonationUrl,
      created_at: updated?.createdAt,
      theme: updatedTheme
        ? {
            style_system: updatedTheme.styleSystem,
            style_options: parseStyleOptionsJson(updatedTheme.styleOptions),
            layout_preset: updatedTheme.layoutPreset,
            primary_color: updatedTheme.primaryColor,
            accent_color: updatedTheme.accentColor,
            font_heading: updatedTheme.fontHeading,
            font_body: updatedTheme.fontBody,
            time_format: updatedTheme.timeFormat,
            label_adhaan: updatedTheme.labelAdhaan,
            label_iqaamah: updatedTheme.labelIqaamah,
            label_jumuah: updatedTheme.labelJumuah,
            label_speech: updatedTheme.labelSpeech,
            label_sunrise: updatedTheme.labelSunrise,
            label_fajr: updatedTheme.labelFajr,
            label_dhuhr: updatedTheme.labelDhuhr,
            label_asr: updatedTheme.labelAsr,
            label_maghrib: updatedTheme.labelMaghrib,
            label_isha: updatedTheme.labelIsha,
          }
        : null,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update masjid profile');
  }
};