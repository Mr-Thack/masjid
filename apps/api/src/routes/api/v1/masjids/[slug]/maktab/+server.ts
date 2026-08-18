import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, mktSettings, mktTerms } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getSquareEnv } from '$lib/server/maktab/integrations';
import { hasSquare } from '$lib/server/maktab/square';
import type { RequestHandler } from './$types';

function parseProgramInfo(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); }
  catch { return {}; }
}

export const GET: RequestHandler = async ({ params, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ id: masjids.id })
      .from(masjids)
      .where(eq(masjids.slug, params.slug))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const settings = await db
      .select()
      .from(mktSettings)
      .where(eq(mktSettings.masjidId, masjid.id))
      .get();

    const activeTerm = settings?.activeTermId
      ? await db
          .select()
          .from(mktTerms)
          .where(eq(mktTerms.id, settings.activeTermId))
          .get()
      : null;

    const squareEnv = await getSquareEnv(db, masjid.id, platform?.env?.ENVIRONMENT);

    return JsonResponse({
      open: !!activeTerm && !!settings?.enrollmentOpen,
      term: activeTerm
        ? {
            id: activeTerm.id,
            name: activeTerm.name,
            length_months: activeTerm.lengthMonths,
            billing_months: activeTerm.billingMonths ?? activeTerm.lengthMonths,
            prices: {
              '1': activeTerm.priceCents1,
              '2': activeTerm.priceCents2,
              '3plus': activeTerm.priceCents3plus,
            },
          }
        : null,
      status_message: settings?.statusMessage ?? null,
      program_info: settings?.programInfo ? parseProgramInfo(settings.programInfo) : {},
      square_config: hasSquare(squareEnv)
        ? {
            app_id: squareEnv.SQUARE_APP_ID,
            location_id: squareEnv.SQUARE_LOCATION_ID,
            environment: squareEnv.ENVIRONMENT === 'production' ? 'production' : 'sandbox',
          }
        : null,
    });
  } catch (e) {
    console.error('GET maktab error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to load Maktab info');
  }
};
