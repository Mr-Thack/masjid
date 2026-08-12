// Stripe webhook handler — placeholder for future Stripe integration.
// Current payment provider is Square (see lib/server/maktab/square.ts).
// Stripe was removed because account verification could not be completed in time.

import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    return JsonResponse({ received: true });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Webhook processing failed');
  }
};