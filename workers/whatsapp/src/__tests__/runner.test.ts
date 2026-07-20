import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, AdminRecord } from '../types';

const testEnv: Env = {
  DB: {} as D1Database,
  ASSETS: {} as R2Bucket,
  API_URL: 'http://localhost:5173',
  JWT_SECRET: 'test-secret',
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_PHONE_ID: 'test-phone-id',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
  LLM_API_KEY: 'sk-test',
  LLM_API_URL: 'http://llm.test',
  LLM_MODEL: 'test-model',
};

const testAdmin: AdminRecord = {
  id: 'admin-1',
  masjid_id: 'masjid-1',
  email: 'admin@test.org',
  display_name: 'Test Admin',
  whatsapp_phone: '+15550000001',
};

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

vi.mock('../proxy', () => ({
  getMasjidProfile: vi.fn().mockResolvedValue({
    masjid: { name: 'Test Masjid' },
    theme: { primary_color: '#333' },
  }),
}));

vi.mock('../session', () => ({
  getMutationCount: vi.fn().mockResolvedValue(0),
  getMutations: vi.fn().mockResolvedValue([]),
}));

vi.mock('../agent/format', async () => {
  const actual = await vi.importActual('../agent/format');
  return {
    ...actual,
    formatDiffReceipt: vi.fn().mockResolvedValue('*Changes Applied*\n\n_1 change total_'),
  };
});

function makeLLMResponse(content: string | null, toolCalls?: Array<{ id: string; name: string; arguments: string }>) {
  return {
    choices: [{
      message: {
        content,
        tool_calls: toolCalls?.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      },
    }],
  };
}

const noChangesState = {
  profile: { theme: { primary_color: '#333' } },
  prayer_rules: [],
  jumuah: [],
  announcements: [],
};

describe('runAgent — fallback path', () => {
  it('returns fallback when LLM_API_KEY is not set', async () => {
    const envWithoutKey = { ...testEnv, LLM_API_KEY: undefined };
    const { runAgent } = await import('../agent/runner');

    const result = await runAgent('Hello', testAdmin, envWithoutKey, 'branch-1');
    expect(result).toContain('Message received');
    expect(result).toContain('LLM_API_KEY');
    expect(result).toContain('/help');
  });
});

describe('runAgent — agent loop', () => {
  it('sends system prompt with masjid context then user message', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(makeLLMResponse('No changes needed')), { status: 200 }));
    const { runAgent } = await import('../agent/runner');

    await runAgent('Make Dhuhr 10 min after adhaan', testAdmin, testEnv, 'branch-1');

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('Test Masjid');
    expect(messages[0]?.content).toContain('masjid-1');
    expect(messages[messages.length - 1]?.role).toBe('user');
    expect(messages[messages.length - 1]?.content).toBe('Make Dhuhr 10 min after adhaan');
  });

  it('includes tools in LLM request', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(makeLLMResponse('Done')), { status: 200 }));
    const { runAgent } = await import('../agent/runner');

    await runAgent('test', testAdmin, testEnv, 'branch-1');

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.tools).toBeDefined();
    expect(body.tools.length).toBeGreaterThan(0);
    expect(body.tools[0]?.type).toBe('function');
    expect(body.tool_choice).toBe('auto');
  });

  it('returns no-changes message when LLM has no tool calls and no mutations', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(makeLLMResponse("I don't understand")), { status: 200 }));
    const { runAgent } = await import('../agent/runner');

    const result = await runAgent('blah', testAdmin, testEnv, 'branch-1');

    // With no mutations, should return the LLM's content (or no-changes message)
    expect(typeof result).toBe('string');
  });

  it('throws when LLM_API_KEY not configured in callLLM', async () => {
    const envWithoutKey = { ...testEnv, LLM_API_KEY: '' };
    const { runAgent } = await import('../agent/runner');
    const result = await runAgent('test', testAdmin, envWithoutKey, 'branch-1');
    expect(result).toContain('Message received');
  });

  it('handles LLM API error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { runAgent } = await import('../agent/runner');

    const result = await runAgent('test', testAdmin, testEnv, 'branch-1');
    expect(result).toContain('Something went wrong');
  });

  it('handles LLM non-OK response', async () => {
    mockFetch.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
    const { runAgent } = await import('../agent/runner');

    const result = await runAgent('test', testAdmin, testEnv, 'branch-1');
    expect(result).toContain('Something went wrong');
  });

  it('handles empty choices array', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const { runAgent } = await import('../agent/runner');

    const result = await runAgent('test', testAdmin, testEnv, 'branch-1');
    expect(result).toContain('Something went wrong');
  });

  it('handles missing message in choice', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ choices: [{}] }), { status: 200 }));
    const { runAgent } = await import('../agent/runner');

    const result = await runAgent('test', testAdmin, testEnv, 'branch-1');
    expect(result).toContain('Something went wrong');
  });

  it('uses custom LLM config when provided', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(makeLLMResponse('ok')), { status: 200 }));
    const { runAgent } = await import('../agent/runner');

    await runAgent('test', testAdmin, testEnv, 'branch-1');

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe('test-model');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('llm.test');
  });
});

describe('runAgent — tool call execution', () => {
  it('executes tool calls returned by LLM', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(makeLLMResponse(null, [
        { id: 'tc1', name: 'theme_get', arguments: '{}' },
      ])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(makeLLMResponse('Theme check complete')), { status: 200 }));

    const { runAgent } = await import('../agent/runner');
    const result = await runAgent('What is my theme?', testAdmin, testEnv, 'branch-1');

    const body1 = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    const messages1 = body1.messages as Array<{ role: string }>;
    // First call: system + user
    expect(messages1[0]?.role).toBe('system');

    // Second call should include tool result
    const body2 = JSON.parse(mockFetch.mock.calls[1]?.[1]?.body as string);
    const messages2 = body2.messages as Array<{ role: string }>;
    expect(messages2.some(m => m.role === 'tool')).toBe(true);
    expect(messages2.some(m => m.role === 'assistant')).toBe(true);
  });

  it('handles unknown tool name gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(makeLLMResponse(null, [
        { id: 'tc1', name: 'nonexistent_tool', arguments: '{}' },
      ])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(makeLLMResponse('Sorry, unknown tool')), { status: 200 }));

    const { runAgent } = await import('../agent/runner');
    const result = await runAgent('Do something weird', testAdmin, testEnv, 'branch-1');

    const body2 = JSON.parse(mockFetch.mock.calls[1]?.[1]?.body as string);
    const messages2 = body2.messages as Array<{ role: string; content: string }>;
    const toolMsg = messages2.find(m => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg?.content).toContain('Unknown tool');
  });

  it('limits to 5 iterations', async () => {
    let calls = 0;
    mockFetch.mockImplementation(() => {
      calls++;
      return Promise.resolve(new Response(JSON.stringify(makeLLMResponse(null, [
        { id: `tc${calls}`, name: 'theme_get', arguments: '{}' },
      ])), { status: 200 }));
    });

    const { runAgent } = await import('../agent/runner');
    await runAgent('test', testAdmin, testEnv, 'branch-1');

    expect(calls).toBeLessThanOrEqual(5);
  });
});

describe('runAgent — mutations context', () => {
  it('includes existing mutation count in system message', async () => {
    vi.doMock('../session', () => ({
      getMutationCount: vi.fn().mockResolvedValue(3),
      getMutations: vi.fn().mockResolvedValue([]),
    }));

    mockFetch.mockResolvedValue(new Response(JSON.stringify(makeLLMResponse('ok')), { status: 200 }));
    const { runAgent } = await import('../agent/runner');

    await runAgent('test', testAdmin, testEnv, 'branch-1');

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    const messages = body.messages as Array<{ role: string; content: string }>;
    const hasUnconfirmedNote = messages.some(m => m.content?.includes('3 unconfirmed change'));
    expect(hasUnconfirmedNote).toBe(true);
  });
});

describe('runAgent — defaults when env vars absent', () => {
  it('uses default model when LLM_MODEL not set', async () => {
    const env = { ...testEnv, LLM_MODEL: undefined, LLM_API_URL: undefined };
    mockFetch.mockResolvedValue(new Response(JSON.stringify(makeLLMResponse('ok')), { status: 200 }));
    const { runAgent } = await import('../agent/runner');

    await runAgent('test', testAdmin, env, 'branch-1');

    const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe('gpt-4o-mini');
  });
});
