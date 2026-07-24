import type { Env, AdminRecord } from '../types';
import { buildSystemPrompt as coreBuildSystemPrompt, buildVisionPrompt as coreBuildVisionPrompt } from '@masjid/agent';

function toBotContext(env: Env) {
  return {
    adminId: '',
    masjidId: '',
    branchId: '',
    branchName: '',
    db: env.DB,
    apiUrl: env.API_URL,
    jwtSecret: env.JWT_SECRET,
    llmConfig: {
      url: env.LLM_API_URL || '',
      key: env.LLM_API_KEY || '',
      model: env.LLM_MODEL || '',
    },
  };
}

export function buildSystemPrompt(admin: AdminRecord, state: Record<string, unknown>, env: Env): string {
  return coreBuildSystemPrompt(admin, state, toBotContext(env));
}

export function buildVisionPrompt(admin: AdminRecord, state: Record<string, unknown>, env: Env): string {
  return coreBuildVisionPrompt(admin, state, toBotContext(env));
}
