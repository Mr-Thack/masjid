import { z } from 'zod';
import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { runAgent, getOpenBranch, createBranch, getMutations, getMutationCount } from '@masjid/agent';
import type { BotContext, AdminRecord } from '@masjid/agent';
import { getAgentDb } from '$lib/server/agent/d1-shim';
import type { RequestHandler } from './$types';

const ChatSchema = z.object({
  message: z.string().min(1),
  branch_id: z.string().optional(),
});

function resolveLLMEnv(platform?: App.Platform) {
  const rawUrl = (platform?.env as Record<string, string> | undefined)?.LLM_API_URL
    ?? process.env.LLM_API_URL
    ?? 'https://openrouter.ai/api/v1';
  const rawKey = (platform?.env as Record<string, string> | undefined)?.LLM_API_KEY
    ?? process.env.LLM_API_KEY
    ?? '';
  const rawModel = (platform?.env as Record<string, string> | undefined)?.LLM_MODEL
    ?? process.env.LLM_MODEL
    ?? 'google/gemma-4-31b-it';
  return {
    url: rawUrl.trim(),
    key: rawKey.trim(),
    model: rawModel.trim(),
  };
}

function toAdminRecord(locals: App.Locals): AdminRecord {
  if (!locals.admin) throw new Error('No admin in locals');
  return {
    id: locals.admin.sub,
    masjid_id: locals.admin.masjid_id,
    email: locals.admin.email,
    display_name: locals.admin.display_name ?? null,
    whatsapp_phone: null,
  };
}

export const POST: RequestHandler = async ({ params, request, locals, platform, url, fetch }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const body = ChatSchema.parse(await request.json());
    const d1 = getAgentDb(platform?.env?.DB);

    let branch = await getOpenBranch(locals.admin.sub, params.id, d1);
    if (!branch) {
      branch = await createBranch(locals.admin.sub, params.id, d1);
    }

    const admin = toAdminRecord(locals);
    const llmConfig = resolveLLMEnv(platform);

    const botCtx: BotContext = {
      adminId: locals.admin.sub,
      masjidId: params.id,
      branchId: branch.id,
      branchName: branch.branch_name,
      db: d1,
      apiUrl: url.origin,
      // event.fetch routes same-origin requests through the SvelteKit server
      // internally — no network hop, so no Cloudflare same-zone Worker→Worker
      // subrequest block (error 1042) when this worker calls its own URL.
      fetcher: fetch,
      jwtSecret: platform?.env?.JWT_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret',
      llmConfig,
    };

    const result = await runAgent(body.message, admin, botCtx);

    const mutations = await getMutations(branch.id, d1);
    const mutationCount = await getMutationCount(branch.id, d1);

    const diffByDomain: Record<string, Record<string, unknown>[]> = {};
    for (const m of mutations) {
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(m.payload_json); } catch { /* ignore */ }
      const domain = diffByDomain[m.domain] || (diffByDomain[m.domain] = []);
      domain.push({
        action: m.action_type,
        target: m.target_key,
        key: m.target_key,
        summary: m.domain,
        payload,
      });
    }

    return JsonResponse({
      branch_id: branch.id,
      message: result.textResponse || 'Done',
      reply: result.textResponse || 'Done',
      diff: diffByDomain,
      mutation_count: mutationCount,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const name = e instanceof Error ? e.name : 'Unknown';
    const stack = e instanceof Error ? (e.stack ?? '') : '';
    const cause = e instanceof Error ? (e.cause ? String(e.cause) : 'none') : 'none';
    console.error('Agent chat error name:', name);
    console.error('Agent chat error message:', msg);
    console.error('Agent chat error cause:', cause);
    console.error('Agent chat error stack:', stack.slice(0, 1000));
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', `Failed to process agent request: ${msg}`);
  }
};