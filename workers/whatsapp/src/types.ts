export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  API_URL: string;
  JWT_SECRET: string;
  WHATSAPP_TOKEN: string;
  WHATSAPP_PHONE_ID: string;
  WHATSAPP_VERIFY_TOKEN: string;
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