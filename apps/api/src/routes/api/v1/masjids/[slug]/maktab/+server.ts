import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, mktSettings, mktTerms } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

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

    const devEnv = typeof process !== 'undefined' && process.env ? process.env : {};
    const env = { ...devEnv, ...(platform?.env ?? {}) } as Record<string, string | undefined>;
    const hasSquare = !!(env.SQUARE_ACCESS_TOKEN && env.SQUARE_APP_ID && env.SQUARE_LOCATION_ID);

    return JsonResponse({
      open: !!activeTerm && !!settings?.enrollmentOpen,
      term: activeTerm
        ? {
            id: activeTerm.id,
            name: activeTerm.name,
            length_months: activeTerm.lengthMonths,
            prices: {
              '1': activeTerm.priceCents1,
              '2': activeTerm.priceCents2,
              '3plus': activeTerm.priceCents3plus,
            },
          }
        : null,
      status_message: settings?.statusMessage ?? null,
      square_config: hasSquare
        ? {
            app_id: env.SQUARE_APP_ID,
            location_id: env.SQUARE_LOCATION_ID,
            environment: env.ENVIRONMENT === 'production' ? 'production' : 'sandbox',
          }
        : null,
    });
  } catch (e) {
    console.error('GET maktab error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to load Maktab info');
  }
};
