import { describe, it, expect, vi } from 'vitest';
import type { Env } from '../types';

const testEnv: Env = {
  DB: {} as D1Database,
  ASSETS: {} as R2Bucket,
  API_URL: 'http://localhost:5173',
  JWT_SECRET: 'test-secret',
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_PHONE_ID: 'test-phone-id',
  WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
};

let mockSendReply: ReturnType<typeof vi.fn>;

vi.mock('../messaging', () => ({
  sendReply: vi.fn(),
  buildHelpMessage: vi.fn(() => 'help message'),
  buildSessionSummary: vi.fn(() => 'session summary'),
}));

vi.mock('../media', () => ({
  downloadWhatsAppMedia: vi.fn(),
  uploadToR2: vi.fn(),
  registerAsset: vi.fn(),
}));

vi.mock('../session', () => {
  const actual = vi.importActual('../session');
  return actual;
});

const { buildHelpMessage, sendReply } = await import('../messaging');
mockSendReply = sendReply as ReturnType<typeof vi.fn>;
