import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }

  return JsonResponse({
    admin: {
      id: locals.admin.sub,
      email: locals.admin.email,
      display_name: locals.admin.display_name,
      masjid_id: locals.admin.masjid_id,
    },
  });
};