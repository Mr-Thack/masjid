import {
  UpdateMasjidSchema,
  UpdateThemeSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb, fetchThemeRow } from '$lib/server/db';
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

    const theme = await fetchThemeRow(db, params.id, platform?.env?.DB);

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
      fajr_angle: masjid.fajrAngle,
      isha_angle: masjid.ishaAngle,
      adjust_fajr: masjid.adjustFajr,
      adjust_sunrise: masjid.adjustSunrise,
      adjust_dhuhr: masjid.adjustDhuhr,
      adjust_asr: masjid.adjustAsr,
      adjust_maghrib: masjid.adjustMaghrib,
      adjust_isha: masjid.adjustIsha,
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
            style_system: theme.style_system,
            style_options: parseStyleOptionsJson(theme.style_options),
            layout_preset: theme.layout_preset,
            primary_color: theme.primary_color,
            accent_color: theme.accent_color,
            font_heading: theme.font_heading,
            font_body: theme.font_body,
            time_format: theme.time_format,
            label_adhaan: theme.label_adhaan,
            label_iqaamah: theme.label_iqaamah,
            label_jumuah: theme.label_jumuah,
            label_speech: theme.label_speech,
            label_sunrise: theme.label_sunrise,
            label_fajr: theme.label_fajr,
            label_dhuhr: theme.label_dhuhr,
            label_asr: theme.label_asr,
            label_maghrib: theme.label_maghrib,
            label_isha: theme.label_isha,
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
    if (masjidUpdate.fajr_angle !== undefined) masjidData.fajrAngle = masjidUpdate.fajr_angle;
    if (masjidUpdate.isha_angle !== undefined) masjidData.ishaAngle = masjidUpdate.isha_angle;
    if (masjidUpdate.adjust_fajr !== undefined) masjidData.adjustFajr = masjidUpdate.adjust_fajr;
    if (masjidUpdate.adjust_sunrise !== undefined) masjidData.adjustSunrise = masjidUpdate.adjust_sunrise;
    if (masjidUpdate.adjust_dhuhr !== undefined) masjidData.adjustDhuhr = masjidUpdate.adjust_dhuhr;
    if (masjidUpdate.adjust_asr !== undefined) masjidData.adjustAsr = masjidUpdate.adjust_asr;
    if (masjidUpdate.adjust_maghrib !== undefined) masjidData.adjustMaghrib = masjidUpdate.adjust_maghrib;
    if (masjidUpdate.adjust_isha !== undefined) masjidData.adjustIsha = masjidUpdate.adjust_isha;
    if (masjidUpdate.timezone !== undefined) masjidData.timezone = masjidUpdate.timezone;
    if (masjidUpdate.latitude !== undefined) masjidData.latitude = masjidUpdate.latitude;
    if (masjidUpdate.longitude !== undefined) masjidData.longitude = masjidUpdate.longitude;

    if (Object.keys(masjidData).length > 0) {
      console.log('PUT masjid update fields:', Object.keys(masjidData).join(', '));
      await db.update(masjids).set(masjidData).where(eq(masjids.id, params.id));
      console.log('PUT masjid update OK');
    }

    const THEME_KEYS = ['style_system', 'style_options', 'layout_preset', 'primary_color', 'accent_color',
      'font_heading', 'font_body', 'time_format',
      'label_adhaan', 'label_iqaamah', 'label_jumuah', 'label_speech', 'label_sunrise',
      'label_fajr', 'label_dhuhr', 'label_asr', 'label_maghrib', 'label_isha'];
    const hasThemeKeys = THEME_KEYS.some((k) => k in body);
    console.log('PUT hasThemeKeys:', hasThemeKeys);

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
      } else if (!themeUpdate.success) {
        console.error('Theme validation failed:', themeUpdate.error.issues);
        return ErrorJsonResponse('VALIDATION_ERROR', 'Theme update contains invalid fields');
      }
    }

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    await invalidatePageCache(platform?.env?.CACHE, existing.slug);

    console.log('PUT fetching updated masjid');
    const updated = await db.select().from(masjids).where(eq(masjids.id, params.id)).get();
    console.log('PUT updated masjid OK, building response');
    const updatedTheme = await fetchThemeRow(db, params.id, platform?.env?.DB);

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
            style_system: updatedTheme.style_system,
            style_options: parseStyleOptionsJson(updatedTheme.style_options),
            layout_preset: updatedTheme.layout_preset,
            primary_color: updatedTheme.primary_color,
            accent_color: updatedTheme.accent_color,
            font_heading: updatedTheme.font_heading,
            font_body: updatedTheme.font_body,
            time_format: updatedTheme.time_format,
            label_adhaan: updatedTheme.label_adhaan,
            label_iqaamah: updatedTheme.label_iqaamah,
            label_jumuah: updatedTheme.label_jumuah,
            label_speech: updatedTheme.label_speech,
            label_sunrise: updatedTheme.label_sunrise,
            label_fajr: updatedTheme.label_fajr,
            label_dhuhr: updatedTheme.label_dhuhr,
            label_asr: updatedTheme.label_asr,
            label_maghrib: updatedTheme.label_maghrib,
            label_isha: updatedTheme.label_isha,
          }
        : null,
    });
  } catch (e: unknown) {
    console.error('PUT masjid update failed:', e instanceof Error ? e.message : e, e instanceof Error ? e.stack : '');
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update masjid profile');
  }
};