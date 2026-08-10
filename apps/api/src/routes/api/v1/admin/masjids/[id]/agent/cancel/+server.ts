import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { abandonBranch } from '@masjid/agent';
import { getAgentDb } from '$lib/server/agent/d1-shim';
import type { RequestHandler } from './$types';

const CancelSchema = z.object({
  branch_id: z.string().min(1),
});

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const body = CancelSchema.parse(await request.json());
    const d1 = getAgentDb(platform?.env?.DB);

    await abandonBranch(body.branch_id, d1);

    return JsonResponse({
      success: true,
      message: 'Changes cancelled.',
    });
  } catch (e: unknown) {
    console.error('Agent cancel error:', e instanceof Error ? e.message : e);
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to cancel changes');
  }
};