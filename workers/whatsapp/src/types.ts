export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  API_URL: string;
  JWT_SECRET: string;
  WHATSAPP_TOKEN: string;
  WHATSAPP_PHONE_ID: string;
  WHATSAPP_VERIFY_TOKEN: string;
  LLM_API_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
}

export interface AdminRecord {
  id: string;
  masjid_id: string;
  email: string;
  display_name: string | null;
  whatsapp_phone: string | null;
}

export interface BranchRecord {
  id: string;
  masjid_id: string;
  admin_id: string;
  branch_name: string;
  status: 'OPEN' | 'MERGED' | 'ABANDONED';
  created_at: string;
  updated_at: string;
}

export interface MutationRecord {
  id: string;
  branch_id: string;
  domain: string;
  action_type: string;
  target_key: string;
  payload_json: string;
  sequence_order: number;
  created_at: string;
}

export interface ParsedWhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  body?: string;
  mediaId?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
}

export const BRANCH_TIMEOUT_HOURS = 2;
export const BRANCH_GRACE_MINUTES = 30;

export interface ToolContext {
  adminId: string;
  masjidId: string;
  branchId: string;
  env: Env;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  mutationSummary?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  role: 'assistant';
  content: string | null;
  tool_calls?: LLMToolCall[];
}

export interface LLMChoice {
  index: number;
  message: LLMResponse;
  finish_reason: 'stop' | 'tool_calls' | 'length';
}

export interface LLMCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: LLMChoice[];
}

export interface MutationSummary {
  index: number;
  domain: string;
  action: string;
  description: string;
}