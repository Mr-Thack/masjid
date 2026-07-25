import { SettingsUpdateSchema, ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { mktSettings, mktTerms } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function termToPublic(term: typeof mktTerms.$inferSelect) {
  return {
    id: term.id,
    name: term.name,
    length_months: term.lengthMonths,
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

    await db
      .insert(mktSettings)
      .values({
        masjidId: params.id,
        activeTermId: body.active_term_id ?? null,
        enrollmentOpen: body.enrollment_open ?? false,
        statusMessage: body.status_message ?? null,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: mktSettings.masjidId,
        set: {
          activeTermId: body.active_term_id ?? null,
          enrollmentOpen: body.enrollment_open ?? false,
          statusMessage: body.status_message ?? null,
          updatedAt: new Date().toISOString(),
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
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    console.error('PUT maktab settings error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update Maktab settings');
  }
};
