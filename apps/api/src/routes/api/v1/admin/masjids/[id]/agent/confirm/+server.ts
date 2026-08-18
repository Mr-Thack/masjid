import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { mergeBranch, getMutationCount, getBranchById } from '@masjid/agent';
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

    // Verify the branch exists, belongs to this masjid, and is still OPEN
    // before creating a snapshot — a bogus/already-merged/cross-masjid branch
    // used to be "confirmed" successfully and insert a junk snapshot.
    const branch = await getBranchById(body.branch_id, d1);
    if (!branch) {
      return ErrorJsonResponse('NOT_FOUND', 'Branch not found');
    }
    if (branch.masjid_id !== params.id) {
      return ErrorJsonResponse('FORBIDDEN', 'Branch does not belong to this masjid');
    }
    if (branch.status !== 'OPEN') {
      return ErrorJsonResponse('CONFLICT', `Branch is already ${branch.status.toLowerCase()}`);
    }

    const count = await getMutationCount(body.branch_id, d1);
    if (count === 0) {
      return ErrorJsonResponse('CONFLICT', 'No pending changes to confirm in this branch');
    }

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