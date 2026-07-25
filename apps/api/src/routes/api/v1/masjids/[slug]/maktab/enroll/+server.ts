import { SquareEnrollmentSchema, ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, mktRegistrations, mktSettings, mktTerms } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createSquareSubscription, hasSquare } from '$lib/server/maktab/square';
import { sendParentConfirmation } from '$lib/server/maktab/email';
import type { PaymentRefs } from '$lib/server/maktab/types';
import type { RequestHandler } from './$types';

function monthlyAmount(term: typeof mktTerms.$inferSelect, childrenCount: number): number {
  if (childrenCount <= 0) return 0;
  if (childrenCount === 1) return term.priceCents1;
  if (childrenCount === 2) return term.priceCents2;
  return term.priceCents3plus;
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
  try {
    const body = SquareEnrollmentSchema.parse(await request.json());

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
      .select({ activeTermId: mktSettings.activeTermId, enrollmentOpen: mktSettings.enrollmentOpen })
      .from(mktSettings)
      .where(eq(mktSettings.masjidId, masjid.id))
      .get();

    if (!settings?.activeTermId || !settings.enrollmentOpen) {
      return ErrorJsonResponse('CONFLICT', 'Enrollment is currently closed');
    }

    const term = await db
      .select()
      .from(mktTerms)
      .where(eq(mktTerms.id, settings.activeTermId))
      .get();

    if (!term) {
      return ErrorJsonResponse('INTERNAL_ERROR', 'Active term missing');
    }

    const refs: PaymentRefs = JSON.parse(term.paymentRefsJson || '{}');
    if (!refs.square) {
      return ErrorJsonResponse('INTERNAL_ERROR', 'Active term is not linked to Square plans');
    }

    const devEnv = typeof process !== 'undefined' && process.env ? process.env : {};
    const env = { ...devEnv, ...(platform?.env ?? {}) } as Record<string, string | undefined>;
    const squareEnv = {
      SQUARE_ACCESS_TOKEN: env.SQUARE_ACCESS_TOKEN,
      SQUARE_APP_ID: env.SQUARE_APP_ID,
      SQUARE_LOCATION_ID: env.SQUARE_LOCATION_ID,
      ENVIRONMENT: env.ENVIRONMENT,
    };

    if (!hasSquare(squareEnv)) {
      return ErrorJsonResponse('INTERNAL_ERROR', 'Square is not configured');
    }

    const childrenCount = body.children.length;
    const monthlyAmountCents = monthlyAmount(term, childrenCount);

    const parent = body.father?.name
      ? { name: body.father.name, email: body.father.email!, phone: body.father.phone! }
      : { name: body.mother!.name!, email: body.mother!.email!, phone: body.mother!.phone! };

    const registrationId = crypto.randomUUID();
    let subscriptionId: string;
    let customerId: string;

    try {
      const result = await createSquareSubscription(
        {
          parent,
          address: {
            line1: body.address_line1,
            city: body.city,
            state: 'GA',
            postal_code: body.postal_code,
            country: body.country,
          },
          childrenCount,
          sourceId: body.source_id,
          cardHolderName: body.card_holder_name,
          refs: refs.square,
        },
        squareEnv,
      );
      subscriptionId = result.subscriptionId;
      customerId = result.customerId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return ErrorJsonResponse('INTERNAL_ERROR', `Payment setup failed: ${message}`);
    }

    await db.insert(mktRegistrations).values({
      id: registrationId,
      masjidId: masjid.id,
      termId: term.id,
      status: 'payment_succeeded',
      paymentProvider: 'square',
      paymentCustomerId: customerId ?? null,
      paymentSubscriptionId: subscriptionId ?? null,
      paymentSessionId: null,
      monthlyAmountCents,
      fatherName: body.father?.name ?? null,
      fatherPhone: body.father?.phone ?? null,
      fatherEmail: body.father?.email ?? null,
      motherName: body.mother?.name ?? null,
      motherPhone: body.mother?.phone ?? null,
      motherEmail: body.mother?.email ?? null,
      addressLine1: body.address_line1,
      city: body.city,
      state: 'GA',
      postalCode: body.postal_code,
      country: body.country,
      childrenJson: JSON.stringify(body.children),
    } as any);

    try {
      await sendParentConfirmation(
        {
          father: body.father,
          mother: body.mother,
          address_line1: body.address_line1,
          city: body.city,
          state: 'GA',
          postal_code: body.postal_code,
          country: body.country,
          children: body.children as Array<{ name: string; dob: string; sex: string }>,
        },
        {
          name: term.name,
          length_months: term.lengthMonths,
          monthly_cost_cents: monthlyAmountCents,
        },
        {
          BREVO_API_KEY: env.BREVO_API_KEY as string | undefined,
          SENDER_EMAIL: env.SENDER_EMAIL as string | undefined,
          SENDER_NAME: env.SENDER_NAME as string | undefined,
          FORWARD_TO_EMAIL: env.FORWARD_TO_EMAIL as string | undefined,
          LOGGING_EMAIL: env.LOGGING_EMAIL as string | undefined,
          BOT_NAME: env.BOT_NAME as string | undefined,
          ENVIRONMENT: env.ENVIRONMENT as string | undefined,
        },
      );
    } catch (e) {
      console.error('Failed to send Maktab confirmation email:', e);
      // Don't fail enrollment because email failed.
    }

    return JsonResponse({
      registration_id: registrationId,
      subscription_id: subscriptionId,
      status: 'payment_succeeded',
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    console.error('POST maktab/enroll error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Enrollment failed');
  }
};
