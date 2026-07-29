import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { configBranches } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

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
      .from(configBranches)
      .where(eq(configBranches.masjidId, params.id))
      .orderBy(desc(configBranches.createdAt));

    return JsonResponse({
      branches: rows.map((b) => ({
        id: b.id,
        branch_name: b.branchName,
        status: b.status,
        created_at: b.createdAt,
        updated_at: b.updatedAt,
      })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to list branches');
  }
};
