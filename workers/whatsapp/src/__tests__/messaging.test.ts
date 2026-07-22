import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../types';

const testEnv: Env = {
  DB: {} as D1Database,
  ASSETS: {} as R2Bucket,
  API_URL: 'http://localhost:5173',
  JWT_SECRET: 'test-secret',
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_PHONE_ID: 'test-phone-id',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
};

let mockFetch: ReturnType<typeof vi.fn>;
let cachedModule: typeof import('../messaging');
let cachedSendReply: ReturnType<typeof vi.fn>;
let cachedSendMediaReply: ReturnType<typeof vi.fn>;

function resetModule() {
  vi.resetModules();
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
}

beforeEach(resetModule);

async function loadModule() {
  cachedModule = await import('../messaging');
  cachedSendReply = cachedModule.sendReply as unknown as ReturnType<typeof vi.fn>;
  cachedSendMediaReply = cachedModule.sendMediaReply as unknown as ReturnType<typeof vi.fn>;
  return cachedModule;
}

describe('sendReply', () => {
  it('sends POST to correct WhatsApp API URL', async () => {
    const { sendReply } = await loadModule();
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await sendReply('+15550000001', 'Hello', testEnv);

    const url = mockFetch.mock.calls[0]?.[0];
    expect(url).toBe('https://graph.facebook.com/v22.0/test-phone-id/messages');
  });

  it('includes messaging_product and text body', async () => {
    const { sendReply } = await loadModule();
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await sendReply('+15550000001', 'Test message', testEnv);

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.messaging_product).toBe('whatsapp');
    expect(body.to).toBe('+15550000001');
    expect(body.type).toBe('text');
    expect(body.text.body).toBe('Test message');
    expect(body.recipient_type).toBe('individual');
  });

  it('passes Authorization header with token', async () => {
    const { sendReply } = await loadModule();
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await sendReply('+15550000001', 'Hello', testEnv);

    const headers = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('does not throw on non-OK response', async () => {
    const { sendReply } = await loadModule();
    mockFetch.mockResolvedValue(new Response('error', { status: 500 }));

    await expect(sendReply('+15550000001', 'Hello', testEnv)).resolves.toBeUndefined();
  });
});

describe('sendMediaReply', () => {
  it('sends image media message', async () => {
    const { sendMediaReply } = await loadModule();
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await sendMediaReply('+15550000001', 'media-123', null, testEnv);

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.type).toBe('image');
    expect(body.image.id).toBe('media-123');
  });

  it('includes caption when provided', async () => {
    const { sendMediaReply } = await loadModule();
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await sendMediaReply('+15550000001', 'media-123', 'Check this out', testEnv);

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.image.caption).toBe('Check this out');
  });

  it('omits caption when null', async () => {
    const { sendMediaReply } = await loadModule();
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    await sendMediaReply('+15550000001', 'media-123', null, testEnv);

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.image.caption).toBeUndefined();
  });
});

describe('buildHelpMessage', () => {
  it('includes all commands', async () => {
    const { buildHelpMessage } = await loadModule();
    const msg = buildHelpMessage();
    expect(msg).toContain('/help');
    expect(msg).toContain('/status');
    expect(msg).toContain('/confirm');
    expect(msg).toContain('/cancel');
  });

  it('mentions AI-powered config', async () => {
    const { buildHelpMessage } = await loadModule();
    const msg = buildHelpMessage();
    expect(msg).toContain('AI');
  });

  it('mentions all domains', async () => {
    const { buildHelpMessage } = await loadModule();
    const msg = buildHelpMessage();
    expect(msg).toContain('prayer timings');
    expect(msg).toContain('theme');
    expect(msg).toContain('announcements');
    expect(msg).toContain('Jumu\'ah');
    expect(msg).toContain('profile');
  });
});

describe('buildSessionSummary', () => {
  it('includes branch name and creation date', async () => {
    const { buildSessionSummary } = await loadModule();
    const msg = buildSessionSummary('whatsapp-2026-07-20', '2026-07-20T12:00:00Z', 3);
    expect(msg).toContain('whatsapp-2026-07-20');
    expect(msg).toContain('3');
  });

  it('includes prompt to continue', async () => {
    const { buildSessionSummary } = await loadModule();
    const msg = buildSessionSummary('test', '2026-01-01T00:00:00Z', 0);
    expect(msg).toContain('What would you like to change');
  });
});

describe('isRtlText', () => {
  it('detects Arabic text', async () => {
    const { isRtlText } = await loadModule();
    expect(isRtlText('السلام عليكم')).toBe(true);
  });

  it('detects Urdu text', async () => {
    const { isRtlText } = await loadModule();
    expect(isRtlText('نماز کا وقت')).toBe(true);
  });

  it('returns false for English text', async () => {
    const { isRtlText } = await loadModule();
    expect(isRtlText('As-salamu alaykum')).toBe(false);
  });

  it('returns false for empty string', async () => {
    const { isRtlText } = await loadModule();
    expect(isRtlText('')).toBe(false);
  });

  it('detects mixed Arabic in text', async () => {
    const { isRtlText } = await loadModule();
    expect(isRtlText('Prayer: الفجر')).toBe(true);
  });
});

describe('wrapRtl', () => {
  it('wraps Arabic text with RTL mark', async () => {
    const { wrapRtl } = await loadModule();
    const result = wrapRtl('السلام عليكم');
    expect(result).toBe('\u200Fالسلام عليكم');
  });

  it('wraps each RTL line independently', async () => {
    const { wrapRtl } = await loadModule();
    const result = wrapRtl('English header\nالسلام عليكم\nMore English');
    expect(result).toBe('English header\n\u200Fالسلام عليكم\nMore English');
  });

  it('does not wrap English-only text', async () => {
    const { wrapRtl } = await loadModule();
    const result = wrapRtl('Hello World');
    expect(result).toBe('Hello World');
  });

  it('wraps Urdu text with RTL mark', async () => {
    const { wrapRtl } = await loadModule();
    const result = wrapRtl('نماز کا وقت ہے');
    expect(result).toContain('\u200F');
  });
});
