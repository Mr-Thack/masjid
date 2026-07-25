import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { mktRegistrations } from '$lib/server/db/schema';
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
        created_at: r.createdAt,
      })),
    });
  } catch (e) {
    console.error('GET maktab registrations error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to load registrations');
  }
};
