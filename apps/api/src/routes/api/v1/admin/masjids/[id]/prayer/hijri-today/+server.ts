import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { computeHijriDate } from '$lib/server/prayer/hijri';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }

  try {
    const hijriDate = computeHijriDate(new Date());
    return JsonResponse(hijriDate);
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to compute Hijri date');
  }
};