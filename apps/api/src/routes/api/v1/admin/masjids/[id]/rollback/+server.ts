import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import {
  masjids,
  masjidThemes,
  prayerRules,
  jumuahSessions,
  announcements,
  configSnapshots,
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateMasjidCache, invalidatePageCache } from '$lib/server/prayer/cache';
import type { RequestHandler } from './$types';

const RollbackSchema = z.object({
  snapshot_id: z.string().min(1),
});

interface MasjidState {
  version: number;
  summary: string;
  created_at: string;
  masjid: Record<string, unknown> & { theme?: Record<string, unknown> | null };
  prayer_rules: { rules: Array<Record<string, unknown>> };
  jumuah: { sessions: Array<Record<string, unknown>> };
  announcements: { announcements: Array<Record<string, unknown>> };
}

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = RollbackSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const snapshotRow = await db
      .select()
      .from(configSnapshots)
      .where(eq(configSnapshots.id, body.snapshot_id))
      .get();

    if (!snapshotRow) {
      return ErrorJsonResponse('NOT_FOUND', 'Snapshot not found');
    }
    if (snapshotRow.masjidId !== params.id) {
      return ErrorJsonResponse('FORBIDDEN', 'Snapshot does not belong to this masjid');
    }

    let state: MasjidState;
    try {
      state = JSON.parse(snapshotRow.fullStateJson);
    } catch {
      return ErrorJsonResponse('VALIDATION_ERROR', 'Snapshot state is corrupted');
    }

    if (state.version !== 1) {
      return ErrorJsonResponse('VALIDATION_ERROR', 'Unsupported snapshot version');
    }

    const restored: string[] = [];

    if (state.masjid) {
      const m = state.masjid;

      const masjidData: Record<string, unknown> = {};
      if (typeof m.name === 'string') masjidData.name = m.name;
      if (typeof m.latitude === 'number') masjidData.latitude = m.latitude;
      if (typeof m.longitude === 'number') masjidData.longitude = m.longitude;
      if (typeof m.timezone === 'string') masjidData.timezone = m.timezone;
      if (typeof m.calculation_method === 'number') masjidData.calculationMethod = m.calculation_method;
      if (typeof m.fajr_angle === 'number' || m.fajr_angle === null) masjidData.fajrAngle = m.fajr_angle;
      if (typeof m.isha_angle === 'number' || m.isha_angle === null) masjidData.ishaAngle = m.isha_angle;
      if (typeof m.address_line1 === 'string' || m.address_line1 === null) masjidData.addressLine1 = m.address_line1;
      if (typeof m.address_line2 === 'string' || m.address_line2 === null) masjidData.addressLine2 = m.address_line2;
      if (typeof m.city === 'string' || m.city === null) masjidData.city = m.city;
      if (typeof m.state === 'string' || m.state === null) masjidData.state = m.state;
      if (typeof m.postal_code === 'string' || m.postal_code === null) masjidData.postalCode = m.postal_code;
      if (typeof m.country === 'string' || m.country === null) masjidData.country = m.country;
      if (typeof m.contact_phone === 'string' || m.contact_phone === null) masjidData.contactPhone = m.contact_phone;
      if (typeof m.contact_email === 'string' || m.contact_email === null) masjidData.contactEmail = m.contact_email;
      if (typeof m.facebook_url === 'string' || m.facebook_url === null) masjidData.facebookUrl = m.facebook_url;
      if (typeof m.youtube_url === 'string' || m.youtube_url === null) masjidData.youtubeUrl = m.youtube_url;
      if (typeof m.instagram_url === 'string' || m.instagram_url === null) masjidData.instagramUrl = m.instagram_url;
      if (typeof m.website_url === 'string' || m.website_url === null) masjidData.websiteUrl = m.website_url;
      if (typeof m.external_donation_url === 'string' || m.external_donation_url === null) masjidData.externalDonationUrl = m.external_donation_url;

      if (Object.keys(masjidData).length > 0) {
        await db.update(masjids).set(masjidData).where(eq(masjids.id, params.id));
        restored.push('profile');
      }

      if (m.theme && typeof m.theme === 'object') {
        const t = m.theme as Record<string, unknown>;
        const themeData: Record<string, unknown> = {};
        if (typeof t.style_system === 'string') themeData.styleSystem = t.style_system;
        if (t.style_options !== undefined) themeData.styleOptions = typeof t.style_options === 'string' ? t.style_options : JSON.stringify(t.style_options ?? {});
        if (typeof t.layout_preset === 'string') themeData.layoutPreset = t.layout_preset;
        if (typeof t.primary_color === 'string') themeData.primaryColor = t.primary_color;
        if (typeof t.accent_color === 'string') themeData.accentColor = t.accent_color;
        if (typeof t.font_heading === 'string') themeData.fontHeading = t.font_heading;
        if (typeof t.font_body === 'string') themeData.fontBody = t.font_body;
        if (typeof t.time_format === 'string') themeData.timeFormat = t.time_format;
        if (typeof t.label_adhaan === 'string') themeData.labelAdhaan = t.label_adhaan;
        if (typeof t.label_iqaamah === 'string') themeData.labelIqaamah = t.label_iqaamah;
        if (typeof t.label_jumuah === 'string') themeData.labelJumuah = t.label_jumuah;
        if (typeof t.label_sunrise === 'string') themeData.labelSunrise = t.label_sunrise;
        if (typeof t.label_fajr === 'string') themeData.labelFajr = t.label_fajr;
        if (typeof t.label_dhuhr === 'string') themeData.labelDhuhr = t.label_dhuhr;
        if (typeof t.label_asr === 'string') themeData.labelAsr = t.label_asr;
        if (typeof t.label_maghrib === 'string') themeData.labelMaghrib = t.label_maghrib;
        if (typeof t.label_isha === 'string') themeData.labelIsha = t.label_isha;

        if (Object.keys(themeData).length > 0) {
          await db.update(masjidThemes).set(themeData).where(eq(masjidThemes.masjidId, params.id));
          restored.push('theme');
        }
      }
    }

    if (state.prayer_rules?.rules && Array.isArray(state.prayer_rules.rules)) {
      await db.delete(prayerRules).where(eq(prayerRules.masjidId, params.id));

      for (const rule of state.prayer_rules.rules) {
        const ruleData: Record<string, unknown> = {
          id: crypto.randomUUID(),
          masjidId: params.id,
          prayerName: rule.prayer_name ?? rule.prayerName,
          ruleName: rule.rule_name ?? rule.ruleName ?? 'Restored rule',
          executionOrder: (rule.execution_order ?? rule.executionOrder ?? 0) as number,
          conditionsJson: typeof rule.conditions_json === 'string'
            ? rule.conditions_json
            : JSON.stringify(rule.conditions_json),
          actionJson: typeof rule.action_json === 'string'
            ? rule.action_json
            : JSON.stringify(rule.action_json),
        };
        await db.insert(prayerRules).values(ruleData);
      }
      restored.push(`prayer_rules (${state.prayer_rules.rules.length})`);
    }

    if (state.jumuah?.sessions && Array.isArray(state.jumuah.sessions)) {
      await db.delete(jumuahSessions).where(eq(jumuahSessions.masjidId, params.id));

      for (const session of state.jumuah.sessions) {
        const sessionData: Record<string, unknown> = {
          id: crypto.randomUUID(),
          masjidId: params.id,
          label: (session.label as string) || 'Restored session',
          time: (session.time as string) || '13:30',
          khateeb: (session.khateeb as string) ?? null,
          location: (session.location as string) ?? null,
          speechTime: (session.speech_time as string) ?? null,
          isActive: session.is_active !== false,
        };
        await db.insert(jumuahSessions).values(sessionData);
      }
      restored.push(`jumuah (${state.jumuah.sessions.length})`);
    }

    if (state.announcements?.announcements && Array.isArray(state.announcements.announcements)) {
      await db.delete(announcements).where(eq(announcements.masjidId, params.id));

      const now = new Date().toISOString();
      for (const ann of state.announcements.announcements) {
        const annData: Record<string, unknown> = {
          id: crypto.randomUUID(),
          masjidId: params.id,
          title: (ann.title as string) || 'Restored announcement',
          slug: (ann.slug as string) || `restored-${Date.now()}`,
          contentMarkdown: (ann.content_markdown as string) || '',
          compiledHtml: (ann.compiled_html as string) ?? null,
          isPinned: ann.is_pinned === true,
          status: (ann.status as string) || 'published',
          publishedAt: (ann.published_at as string) ?? now,
          expiresAt: (ann.expires_at as string) ?? null,
          createdAt: now,
          updatedAt: now,
        };
        await db.insert(announcements).values(annData);
      }
      restored.push(`announcements (${state.announcements.announcements.length})`);
    }

    const masjidRecord = await db
      .select({ slug: masjids.slug })
      .from(masjids)
      .where(eq(masjids.id, params.id))
      .get();

    await invalidateMasjidCache(platform?.env?.CACHE, params.id);
    if (masjidRecord?.slug) {
      await invalidatePageCache(platform?.env?.CACHE, masjidRecord.slug);
    }

    return JsonResponse({
      success: true,
      snapshot_id: body.snapshot_id,
      restored,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to restore from snapshot');
  }
};