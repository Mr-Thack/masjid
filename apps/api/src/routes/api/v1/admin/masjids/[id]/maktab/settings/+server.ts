import { SettingsUpdateSchema, ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { mktSettings, mktTerms } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function parseProgramInfo(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); }
  catch { return {}; }
}

function termToPublic(term: typeof mktTerms.$inferSelect) {
  return {
    id: term.id,
    name: term.name,
    length_months: term.lengthMonths,
    billing_months: term.billingMonths,
    prices: {
      '1': term.priceCents1,
      '2': term.priceCents2,
      '3plus': term.priceCents3plus,
    },
  };
}

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);
    const settings = await db
      .select()
      .from(mktSettings)
      .where(eq(mktSettings.masjidId, params.id))
      .get();

    const activeTerm = settings?.activeTermId
      ? await db.select().from(mktTerms).where(eq(mktTerms.id, settings.activeTermId)).get()
      : null;

    return JsonResponse({
      enrollment_open: !!settings?.enrollmentOpen,
      active_term: activeTerm ? termToPublic(activeTerm) : null,
      status_message: settings?.statusMessage ?? null,
      assistance_code: settings?.assistanceCode ?? null,
      program_info: settings?.programInfo ? parseProgramInfo(settings.programInfo) : {},
    });
  } catch (e) {
    console.error('GET maktab settings error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to load Maktab settings');
  }
};

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = SettingsUpdateSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    if (body.active_term_id) {
      const term = await db
        .select()
        .from(mktTerms)
        .where(eq(mktTerms.id, body.active_term_id))
        .get();
      if (!term) {
        return ErrorJsonResponse('NOT_FOUND', 'Active term not found');
      }
    }

    // Fetch current settings so unprovided fields are preserved (partial update)
    const current = await db
      .select()
      .from(mktSettings)
      .where(eq(mktSettings.masjidId, params.id))
      .get();

    const setData: Record<string, unknown> = {};
    if (body.enrollment_open !== undefined) setData.enrollmentOpen = body.enrollment_open;
    if (body.active_term_id !== undefined) setData.activeTermId = body.active_term_id;
    if (body.status_message !== undefined) setData.statusMessage = body.status_message;
    if (body.assistance_code !== undefined) setData.assistanceCode = body.assistance_code;
    if (body.program_info !== undefined) setData.programInfo = JSON.stringify(body.program_info);

    const now = new Date().toISOString();

    await db
      .insert(mktSettings)
      .values({
        masjidId: params.id,
        activeTermId: (setData.activeTermId !== undefined ? setData.activeTermId : current?.activeTermId) ?? null,
        enrollmentOpen: (setData.enrollmentOpen !== undefined ? setData.enrollmentOpen : current?.enrollmentOpen) ?? false,
        statusMessage: (setData.statusMessage !== undefined ? setData.statusMessage : current?.statusMessage) ?? null,
        assistanceCode: (setData.assistanceCode !== undefined ? setData.assistanceCode : current?.assistanceCode) ?? null,
        programInfo: (setData.programInfo !== undefined ? setData.programInfo : current?.programInfo) ?? '{}',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: mktSettings.masjidId,
        set: {
          activeTermId: (setData.activeTermId !== undefined ? setData.activeTermId : current?.activeTermId) ?? null,
          enrollmentOpen: (setData.enrollmentOpen !== undefined ? setData.enrollmentOpen : current?.enrollmentOpen) ?? false,
          statusMessage: (setData.statusMessage !== undefined ? setData.statusMessage : current?.statusMessage) ?? null,
          assistanceCode: (setData.assistanceCode !== undefined ? setData.assistanceCode : current?.assistanceCode) ?? null,
          programInfo: (setData.programInfo !== undefined ? setData.programInfo : current?.programInfo) ?? '{}',
          updatedAt: now,
        },
      });

    const settings = await db
      .select()
      .from(mktSettings)
      .where(eq(mktSettings.masjidId, params.id))
      .get();

    const activeTerm = settings?.activeTermId
      ? await db.select().from(mktTerms).where(eq(mktTerms.id, settings.activeTermId)).get()
      : null;

    return JsonResponse({
      enrollment_open: !!settings?.enrollmentOpen,
      active_term: activeTerm ? termToPublic(activeTerm) : null,
      status_message: settings?.statusMessage ?? null,
      assistance_code: settings?.assistanceCode ?? null,
      program_info: settings?.programInfo ? parseProgramInfo(settings.programInfo) : {},
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    console.error('PUT maktab settings error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update Maktab settings');
  }
};
