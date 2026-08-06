import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { validateRulesHealth } from '$lib/server/prayer/validate';
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
    const health = await validateRulesHealth(params.id, db);

    if (health === null) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    return JsonResponse(health);
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to check prayer health');
  }
};