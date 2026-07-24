export interface ApiClientConfig {
  apiUrl: string;
  jwtSecret: string;
  adminId: string;
  masjidId: string;
}

export interface BotContext extends ApiClientConfig {
  branchId: string;
  branchName: string;
  db: D1Database;
  llmConfig: { url: string; key: string; model: string };
  assets?: R2Bucket;
  cdnBaseUrl?: string;
}

export type ToolContext = BotContext;

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

export interface SnapshotRecord {
  id: string;
  masjid_id: string;
  branch_id: string;
  label: string;
  state_json: string;
  created_at: string;
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

export interface LLMTextPart {
  type: 'text';
  text: string;
}

export interface LLMImagePart {
  type: 'image_url';
  image_url: { url: string };
}

export type LLMContentPart = LLMTextPart | LLMImagePart;

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | LLMContentPart[] | null;
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

export interface MutationData {
  domain: string;
  action: string;
  entityKey: string;
  summary: string;
  payload: Record<string, unknown>;
}

export interface DiffReceipt {
  branchName: string;
  mutations: MutationData[];
  totalCount: number;
  textResponse: string | null;
}

export interface AgentResult {
  textResponse: string | null;
  diffReceipt: DiffReceipt | null;
}

export const BRANCH_TIMEOUT_HOURS = 24;
export const BRANCH_GRACE_MINUTES = 5;
