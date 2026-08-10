import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { mergeBranch, getMutationCount } from '@masjid/agent';
import { buildConfirmSuccessMessage } from '@masjid/agent';
import { getAgentDb } from '$lib/server/agent/d1-shim';
import type { RequestHandler } from './$types';

const ConfirmSchema = z.object({
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
    const body = ConfirmSchema.parse(await request.json());
    const d1 = getAgentDb(platform?.env?.DB);

    const count = await getMutationCount(body.branch_id, d1);
    await mergeBranch(body.branch_id, 'Admin web confirmation', params.id, d1);

    const message = buildConfirmSuccessMessage('session', count);

    return JsonResponse({
      success: true,
      message,
      mutation_count: count,
    });
  } catch (e: unknown) {
    console.error('Agent confirm error:', e instanceof Error ? e.message : e);
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to confirm changes');
  }
};