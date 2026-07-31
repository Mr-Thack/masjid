import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, mktSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const VerifyCodeSchema = z.object({
  card_holder_name: z.string().min(1),
});

export const POST: RequestHandler = async ({ params, request, platform }) => {
  try {
    const body = VerifyCodeSchema.parse(await request.json());

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
      .select({ assistanceCode: mktSettings.assistanceCode })
      .from(mktSettings)
      .where(eq(mktSettings.masjidId, masjid.id))
      .get();

    const isAssistance = settings?.assistanceCode && body.card_holder_name === settings.assistanceCode;

    return JsonResponse({ needs_payment: !isAssistance });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    console.error('POST maktab/verify-code error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Verification failed');
  }
};