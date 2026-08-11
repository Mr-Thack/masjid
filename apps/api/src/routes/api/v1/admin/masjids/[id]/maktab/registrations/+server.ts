import { ManualEnrollmentSchema, ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { mktRegistrations, mktTerms } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);
    const termId = url.searchParams.get('term_id');
    const status = url.searchParams.get('status');

    const conditions = [eq(mktRegistrations.masjidId, params.id)];
    if (termId) conditions.push(eq(mktRegistrations.termId, termId));
    if (status) conditions.push(eq(mktRegistrations.status, status));

    const rows = await db
      .select()
      .from(mktRegistrations)
      .where(and(...conditions))
      .orderBy(desc(mktRegistrations.createdAt));

    return JsonResponse({
      registrations: rows.map((r) => ({
        id: r.id,
        status: r.status,
        monthly_amount_cents: r.monthlyAmountCents,
        father_name: r.fatherName,
        mother_name: r.motherName,
        father_email: r.fatherEmail,
        mother_email: r.motherEmail,
        father_phone: r.fatherPhone,
        mother_phone: r.motherPhone,
        address_line1: r.addressLine1,
        city: r.city,
        state: r.state,
        postal_code: r.postalCode,
        country: r.country,
        children: JSON.parse(r.childrenJson || '[]') as { name: string; dob: string; sex: string }[],
        payment_customer_id: r.paymentCustomerId,
        payment_subscription_id: r.paymentSubscriptionId,
        created_at: r.createdAt,
      })),
    });
  } catch (e) {
    console.error('GET maktab registrations error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to load registrations');
  }
};

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const body = ManualEnrollmentSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const term = await db
      .select({ id: mktTerms.id })
      .from(mktTerms)
      .where(and(eq(mktTerms.id, body.term_id), eq(mktTerms.masjidId, params.id)))
      .get();

    if (!term) {
      return ErrorJsonResponse('NOT_FOUND', 'Term not found for this masjid');
    }

    const registrationId = crypto.randomUUID();

    const father = body.father?.name ? body.father : null;
    const mother = body.mother?.name ? body.mother : null;

    await db.insert(mktRegistrations).values({
      id: registrationId,
      masjidId: params.id,
      termId: body.term_id,
      status: 'manual',
      paymentProvider: 'manual',
      monthlyAmountCents: body.monthly_amount_cents,
      fatherName: father?.name ?? null,
      fatherPhone: father?.phone ?? null,
      fatherEmail: father?.email ?? null,
      motherName: mother?.name ?? null,
      motherPhone: mother?.phone ?? null,
      motherEmail: mother?.email ?? null,
      addressLine1: body.address_line1,
      city: body.city,
      postalCode: body.postal_code,
      country: body.country,
      childrenJson: JSON.stringify(body.children),
    });

    return JsonResponse(
      {
        registration_id: registrationId,
        status: 'manual',
        monthly_amount_cents: body.monthly_amount_cents,
        children_count: body.children.length,
      },
      201,
    );
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && e.name === 'ZodError') {
      const issues = (e as { issues?: { message: string }[] }).issues ?? [];
      const message = [...new Set(issues.map((i) => i.message).filter(Boolean))].join(' ');
      return ErrorJsonResponse('VALIDATION_ERROR', message || 'Please check the form and try again.');
    }
    console.error('POST maktab registrations error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create registration');
  }
};
