import {
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { customDomains, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.id, params.domain_id))
      .get();

    if (!existing || existing.masjidId !== params.id) {
      return ErrorJsonResponse('NOT_FOUND', 'Domain not found');
    }

    await db.delete(customDomains).where(eq(customDomains.id, params.domain_id));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({ success: true });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to delete domain');
  }
};