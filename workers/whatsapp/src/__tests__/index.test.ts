import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../types';

interface StoredBranch {
  id: string;
  masjid_id: string;
  admin_id: string;
  branch_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

let testEnv: Env;
let storedBranches: StoredBranch[];
let storedMutations: Array<{ id: string; branch_id: string }>;
let sentReplies: Array<{ to: string; text: string }>;
let pendingPromises: Promise<unknown>[];

beforeEach(() => {
  vi.resetModules();
  storedBranches = [];
  storedMutations = [];
  sentReplies = [];
  pendingPromises = [];
  testEnv = {
    DB: {} as D1Database,
    ASSETS: {} as R2Bucket,
    API_URL: 'http://localhost:5173',
    JWT_SECRET: 'test-secret',
    WHATSAPP_TOKEN: 'test-token',
    WHATSAPP_PHONE_ID: 'test-phone-id',
    WHATSAPP_VERIFY_TOKEN: 'verify-token',
    LLM_API_KEY: 'sk-test',
  };

  vi.mock('../session', () => ({
    resolveTenant: vi.fn().mockImplementation(async (phone: string) => {
      if (phone === '+15550000001') {
        return {
          id: 'admin-1', masjid_id: 'masjid-1', email: 'admin@test.org',
          display_name: 'Admin', whatsapp_phone: '+15550000001',
        };
      }
      return null;
    }),
    getOpenBranch: vi.fn().mockImplementation(() => {
      const open = storedBranches.find(b => b.status === 'OPEN');
      return Promise.resolve(open || null);
    }),
    createBranch: vi.fn().mockImplementation((adminId: string, masjidId: string) => {
      const branch: StoredBranch = {
        id: `branch-${storedBranches.length + 1}`,
        masjid_id: masjidId, admin_id: adminId,
        branch_name: `whatsapp-${new Date().toISOString().slice(0, 10)}`,
        status: 'OPEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      storedBranches.push(branch);
      return Promise.resolve(branch);
    }),
    touchBranch: vi.fn().mockResolvedValue(undefined),
    abandonBranch: vi.fn().mockImplementation((branchId: string) => {
      const b = storedBranches.find(b => b.id === branchId);
      if (b) b.status = 'ABANDONED';
      return Promise.resolve();
    }),
    abandonExpiredBranches: vi.fn().mockResolvedValue(undefined),
    mergeBranch: vi.fn().mockImplementation((branchId: string) => {
      const b = storedBranches.find(b => b.id === branchId);
      if (b) b.status = 'MERGED';
      return Promise.resolve();
    }),
    getMutationCount: vi.fn().mockImplementation(() => {
      return Promise.resolve(storedMutations.length);
    }),
    listBranches: vi.fn().mockImplementation(() => {
      return Promise.resolve(storedBranches);
    }),
  }));

  vi.mock('../messaging', () => ({
    sendReply: vi.fn().mockImplementation(async (to: string, text: string) => {
      sentReplies.push({ to, text });
    }),
    sendMediaReply: vi.fn().mockResolvedValue(undefined),
    buildHelpMessage: vi.fn().mockReturnValue('help message'),
    buildSessionSummary: vi.fn().mockReturnValue('session summary'),
  }));

  vi.mock('../agent/runner', () => ({
    runAgent: vi.fn().mockResolvedValue('Agent response text'),
  }));

  vi.mock('../agent/format', () => ({
    formatDiffReceipt: vi.fn().mockResolvedValue('*Changes Applied*\n\nType /confirm'),
    buildConfirmSuccessMessage: vi.fn().mockReturnValue('*Changes finalized!*'),
    buildNoChangesMessage: vi.fn().mockReturnValue('No changes'),
    buildErrorSummary: vi.fn().mockReturnValue('Some errors'),
  }));

  vi.mock('../media', () => ({
    downloadWhatsAppMedia: vi.fn().mockResolvedValue({ buffer: new ArrayBuffer(0), contentType: 'image/jpeg' }),
    uploadToR2: vi.fn().mockResolvedValue(undefined),
    registerAsset: vi.fn().mockResolvedValue('asset-1'),
  }));

  vi.mock('../webhook', () => ({
    handleWebhookVerify: vi.fn().mockReturnValue(new Response('challenge', { status: 200 })),
    parseWebhookEntries: vi.fn().mockReturnValue([]),
  }));
});

function makeFetchHandler() {
  return async (request: Request): Promise<Response> => {
    const handler = (await import('../index')).default;
    const ctx = {
      waitUntil(p: Promise<unknown>) { pendingPromises.push(p); },
    } as unknown as ExecutionContext;
    const response = await handler.fetch(request, testEnv, ctx);
    await Promise.all(pendingPromises);
    return response;
  };
}

async function postCommand(from: string, body: string) {
  const webhook = await import('../webhook');
  (webhook.parseWebhookEntries as ReturnType<typeof vi.fn>).mockReturnValue([{
    from, id: 'msg-1', timestamp: '123', type: 'text', body,
  }]);

  const reqBody = {
    object: 'whatsapp_business_account',
    entry: [{ id: 'e1', changes: [{ value: { messaging_product: 'whatsapp', metadata: {}, messages: [] } }] }],
  };
  const request = new Request('https://example.com/webhook', {
    method: 'POST', body: JSON.stringify(reqBody),
  });
  const fetchHandler = await makeFetchHandler();
  return fetchHandler(request);
}

async function postMedia(from: string, type: string, mediaId: string | undefined) {
  const webhook = await import('../webhook');
  const msg: Record<string, unknown> = { from, id: 'msg-1', timestamp: '123', type };
  if (type !== 'text') msg.mediaId = mediaId;
  if (mediaId && type !== 'text') msg.mediaMimeType = 'image/jpeg';
  (webhook.parseWebhookEntries as ReturnType<typeof vi.fn>).mockReturnValue([msg]);

  const reqBody = {
    object: 'whatsapp_business_account',
    entry: [{ id: 'e1', changes: [{ value: { messaging_product: 'whatsapp', metadata: {}, messages: [] } }] }],
  };
  const request = new Request('https://example.com/webhook', {
    method: 'POST', body: JSON.stringify(reqBody),
  });
  const fetchHandler = await makeFetchHandler();
  return fetchHandler(request);
}

describe('webhook verification', () => {
  it('returns 200 for GET verification', async () => {
    const webhook = await import('../webhook');
    (webhook.handleWebhookVerify as ReturnType<typeof vi.fn>).mockReturnValue(new Response('abc', { status: 200 }));
    const handler = (await import('../index')).default;
    const request = new Request('https://example.com/webhook?hub.mode=subscribe&hub.verify_token=t&hub.challenge=abc');
    const response = await handler.fetch(request, testEnv, { waitUntil: vi.fn() } as unknown as ExecutionContext);
    expect(response.status).toBe(200);
  });
});

describe('tenant resolution', () => {
  it('replies not registered for unknown phone', async () => {
    const webhook = await import('../webhook');
    (webhook.parseWebhookEntries as ReturnType<typeof vi.fn>).mockReturnValue([{
      from: '+15550000099', id: 'msg-1', timestamp: '123', type: 'text', body: 'Hello',
    }]);
    const handler = (await import('../index')).default;
    const ctx = { waitUntil(p: Promise<unknown>) { pendingPromises.push(p); } } as unknown as ExecutionContext;
    const request = new Request('https://example.com/webhook', { method: 'POST', body: '{}' });
    await handler.fetch(request, testEnv, ctx);
    await Promise.all(pendingPromises);
    expect(sentReplies.length).toBeGreaterThan(0);
    expect(sentReplies[0]?.text).toContain('not registered');
  });
});

describe('command routing', () => {
  it('/help returns help message', async () => {
    await postCommand('+15550000001', '/help');
    expect(sentReplies[0]?.text).toContain('help message');
    expect(storedBranches).toHaveLength(0);
  });

  it('/cancel with open branch abandons it', async () => {
    storedBranches.push({
      id: 'branch-1', masjid_id: 'masjid-1', admin_id: 'admin-1',
      branch_name: 'test', status: 'OPEN',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    await postCommand('+15550000001', '/cancel');
    expect(sentReplies[0]?.text).toContain('discarded');
  });

  it('/cancel without open branch shows message', async () => {
    await postCommand('+15550000001', '/cancel');
    expect(sentReplies[0]?.text).toContain('No active session');
  });

  it('/status shows branches', async () => {
    await postCommand('+15550000001', '/status');
    expect(sentReplies[0]?.text).toBeDefined();
  });

  it('/confirm without branch shows message', async () => {
    await postCommand('+15550000001', '/confirm');
    expect(sentReplies[0]?.text).toContain('No active session');
  });

  it('/confirm with branch and mutations merges', async () => {
    storedBranches.push({
      id: 'branch-1', masjid_id: 'masjid-1', admin_id: 'admin-1',
      branch_name: 'test', status: 'OPEN',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    storedMutations.push({ id: 'mut-1', branch_id: 'branch-1' });
    await postCommand('+15550000001', '/confirm');
    expect(sentReplies[0]?.text).toContain('finalized');
  });

  it('/confirm with branch and zero mutations shows no pending', async () => {
    storedBranches.push({
      id: 'branch-1', masjid_id: 'masjid-1', admin_id: 'admin-1',
      branch_name: 'test', status: 'OPEN',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    storedMutations = [];
    await postCommand('+15550000001', '/confirm');
    expect(sentReplies[0]?.text).toContain('No pending changes');
  });
});

describe('natural language agent routing', () => {
  it('creates branch on first message', async () => {
    await postCommand('+15550000001', 'Change Dhuhr to 10 min after adhaan');
    expect(storedBranches).toHaveLength(1);
    expect(storedBranches[0]?.status).toBe('OPEN');
    expect(sentReplies.length).toBeGreaterThan(0);
  });

  it('reuses existing branch on subsequent messages', async () => {
    storedBranches.push({
      id: 'branch-1', masjid_id: 'masjid-1', admin_id: 'admin-1',
      branch_name: 'test', status: 'OPEN',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    await postCommand('+15550000001', 'Change Isha time');
    expect(storedBranches).toHaveLength(1);
  });

  it('handles media message', async () => {
    await postMedia('+15550000001', 'image', 'media-123');
    expect(sentReplies[0]?.text).toContain('media file');
  });

  it('handles media message without mediaId', async () => {
    await postMedia('+15550000001', 'image', undefined);
    expect(sentReplies[0]?.text).toContain("couldn't process");
  });
});

describe('error handling', () => {
  it('returns 500 for invalid JSON body', async () => {
    const handler = (await import('../index')).default;
    const request = new Request('https://example.com/webhook', { method: 'POST', body: 'invalid-json' });
    const response = await handler.fetch(request, testEnv, { waitUntil: vi.fn() } as unknown as ExecutionContext);
    expect(response.status).toBe(500);
  });

  it('returns 405 for PUT', async () => {
    const handler = (await import('../index')).default;
    const request = new Request('https://example.com/webhook', { method: 'PUT' });
    const response = await handler.fetch(request, testEnv, { waitUntil: vi.fn() } as unknown as ExecutionContext);
    expect(response.status).toBe(405);
  });
});
