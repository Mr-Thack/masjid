import { TermCreateSchema, ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { mktTerms } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createSquareTermPlan } from '$lib/server/maktab/square';
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
    const rows = await db
      .select()
      .from(mktTerms)
      .where(eq(mktTerms.masjidId, params.id))
      .orderBy(desc(mktTerms.createdAt));

    return JsonResponse({ terms: rows.map(termToPublic) });
  } catch (e) {
    console.error('GET maktab terms error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to load terms');
  }
};

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = TermCreateSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);
    const env = platform?.env ?? {};

    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId,
      masjidId: params.id,
      name: body.name,
      lengthMonths: body.length_months,
      priceCents1: body.price_cents_1,
      priceCents2: body.price_cents_2,
      priceCents3plus: body.price_cents_3plus,
      paymentRefsJson: '{}',
    });

    try {
      const refs = await createSquareTermPlan(
        {
          id: termId,
          name: body.name,
          length_months: body.length_months,
          price_cents_1: body.price_cents_1,
          price_cents_2: body.price_cents_2,
          price_cents_3plus: body.price_cents_3plus,
        },
        {
          SQUARE_ACCESS_TOKEN: env.SQUARE_ACCESS_TOKEN as string | undefined,
          SQUARE_APP_ID: env.SQUARE_APP_ID as string | undefined,
          SQUARE_LOCATION_ID: env.SQUARE_LOCATION_ID as string | undefined,
          ENVIRONMENT: env.ENVIRONMENT as string | undefined,
        },
      );
      if (refs) {
        await db
          .update(mktTerms)
          .set({ paymentRefsJson: JSON.stringify(refs) })
          .where(eq(mktTerms.id, termId));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Square term pricing failed:', message);
      // Term exists but cannot enroll until Square plan is linked.
    }

    const inserted = await db.select().from(mktTerms).where(eq(mktTerms.id, termId)).get();
    return JsonResponse({ term: inserted ? termToPublic(inserted) : null }, 201);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    console.error('POST maktab terms error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create term');
  }
};
