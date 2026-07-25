import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { mktSettings, mktTerms } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PaymentRefs } from '$lib/server/maktab/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);

    const term = await db
      .select()
      .from(mktTerms)
      .where(eq(mktTerms.id, params.termId))
      .get();

    if (!term || term.masjidId !== params.id) {
      return ErrorJsonResponse('NOT_FOUND', 'Term not found');
    }

    const refs: PaymentRefs = JSON.parse(term.paymentRefsJson || '{}');
    if (!refs.square) {
      return ErrorJsonResponse(
        'CONFLICT',
        'Term does not have a Square payment plan configured yet',
      );
    }

    await db
      .update(mktTerms)
      .set({ isActive: false })
      .where(eq(mktTerms.masjidId, params.id));

    await db
      .update(mktTerms)
      .set({ isActive: true })
      .where(eq(mktTerms.id, params.termId));

    await db
      .insert(mktSettings)
      .values({
        masjidId: params.id,
        activeTermId: params.termId,
        enrollmentOpen: true,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: mktSettings.masjidId,
        set: {
          activeTermId: params.termId,
          enrollmentOpen: true,
          updatedAt: new Date().toISOString(),
        },
      });

    return JsonResponse({ success: true });
  } catch (e) {
    console.error('POST activate term error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to activate term');
  }
};
