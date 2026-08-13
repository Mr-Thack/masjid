import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BotContext } from '../types';

const mockDbPrepare = vi.fn();
const mockDbBind = vi.fn();
const mockDbFirst = vi.fn();
const mockDbRun = vi.fn();
const mockDbAll = vi.fn();

mockDbBind.mockReturnValue({
  first: mockDbFirst,
  run: mockDbRun,
  all: mockDbAll,
});

mockDbPrepare.mockReturnValue({
  bind: mockDbBind,
});

const testCtx: BotContext = {
  adminId: 'admin-1',
  masjidId: 'masjid-1',
  branchId: 'branch-1',
  branchName: 'test-branch',
  db: { prepare: mockDbPrepare } as unknown as D1Database,
  apiUrl: 'http://localhost:5173',
  jwtSecret: 'test-secret',
  llmConfig: { url: '', key: '', model: '' },
};

let mockFetch: ReturnType<typeof vi.fn>;

function getFetchUrlAndOptions(calls: unknown[][]) {
  return calls.map((c) => ({
    url: c[0] as string,
    method: (c[1] as RequestInit)?.method ?? 'GET',
    body: (c[1] as RequestInit)?.body ? JSON.parse((c[1] as RequestInit).body as string) : null,
  }));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockFetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ id: 'new-id', slug: 'my-test-post', title: 'My Test Post' }),
      { status: 200 },
    ),
  );
  vi.stubGlobal('fetch', mockFetch);
  mockDbFirst.mockResolvedValue(null);
  mockDbRun.mockResolvedValue(undefined);
  mockDbAll.mockResolvedValue({ results: [] });
  vi.stubGlobal('crypto', {
    ...globalThis.crypto,
    randomUUID: vi.fn().mockReturnValue('test-uuid'),
  });
});

describe('CONTENT tools — definitions', () => {
  it('has 6 CONTENT tools', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const contentTools = tools.filter((t) => t.name.startsWith('content_'));
    expect(contentTools).toHaveLength(6);
  });

  it('content_list has correct name and description', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const tool = tools.find((t) => t.name === 'content_list')!;
    expect(tool.name).toBe('content_list');
    expect(tool.description).toContain('List all content');
    expect(typeof tool.handler).toBe('function');
  });

  it('content_create has title and content_markdown as required params', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const tool = tools.find((t) => t.name === 'content_create')!;
    const params = tool.parameters as { required: string[] };
    expect(params.required).toContain('title');
    expect(params.required).toContain('content_markdown');
  });

  it('content_create has content_type, show_on_homepage, show_on_info, is_hidden as optional params', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const tool = tools.find((t) => t.name === 'content_create')!;
    const props = (tool.parameters as { properties: Record<string, Record<string, unknown>>; required: string[] }).properties;
    expect(props.content_type).toBeDefined();
    expect(props.show_on_homepage).toBeDefined();
    expect(props.show_on_homepage.type).toBe('boolean');
    expect(props.show_on_homepage.default).toBe(false);
    expect(props.show_on_info).toBeDefined();
    expect(props.show_on_info.type).toBe('boolean');
    expect(props.show_on_info.default).toBe(false);
    expect(props.is_hidden).toBeDefined();
    expect(props.is_hidden.type).toBe('boolean');
    const params = tool.parameters as { required: string[] };
    expect(params.required).not.toContain('show_on_homepage');
    expect(params.required).not.toContain('show_on_info');
    expect(params.required).not.toContain('is_hidden');
  });

  it('content_update has slug as required and other fields optional', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const tool = tools.find((t) => t.name === 'content_update')!;
    const params = tool.parameters as { required: string[] };
    expect(params.required).toContain('slug');
    expect(params.required).not.toContain('title');
    expect(params.required).not.toContain('content_markdown');
    expect(params.required).not.toContain('show_on_homepage');
    expect(params.required).not.toContain('show_on_info');
    expect(params.required).not.toContain('is_hidden');
  });

  it('content_delete has slug as required param', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const tool = tools.find((t) => t.name === 'content_delete')!;
    const params = tool.parameters as { required: string[] };
    expect(params.required).toContain('slug');
    expect(params.required).toHaveLength(1);
  });

  it('content_pin_homepage has slug as required param', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const tool = tools.find((t) => t.name === 'content_pin_homepage')!;
    const params = tool.parameters as { required: string[] };
    expect(params.required).toContain('slug');
    expect(params.required).toHaveLength(1);
  });

  it('content_pin_info has slug as required param', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const tool = tools.find((t) => t.name === 'content_pin_info')!;
    const params = tool.parameters as { required: string[] };
    expect(params.required).toContain('slug');
    expect(params.required).toHaveLength(1);
  });

  it('all CONTENT tools have name, description, parameters, and async handler', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const contentTools = tools.filter((t) => t.name.startsWith('content_'));
    for (const tool of contentTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeTruthy();
      expect(typeof tool.handler).toBe('function');
    }
  });

  it('content_read tools have empty required params', async () => {
    const { getToolDefinitions } = await import('../tools');
    const tools = getToolDefinitions();
    const readTool = tools.find((t) => t.name === 'content_list')!;
    const params = readTool.parameters as { required: string[] };
    expect(params.required).toEqual([]);
  });
});

describe('CONTENT tools — handlers', () => {
  describe('content_list', () => {
    it('calls the correct API endpoint', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_list')!;
      await tool.handler({}, testCtx);

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const getCall = calls.find((c) => c.method === 'GET' && c.url.includes('content'));
      expect(getCall).toBeDefined();
      expect(getCall!.url).toContain('/api/v1/admin/masjids/masjid-1/content');
    });

    it('returns { success: true, data: ... }', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ content: [{ id: 'p1', slug: 'hello-world', title: 'Hello World' }] }),
          { status: 200 },
        ),
      );
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_list')!;
      const result = await tool.handler({}, testCtx);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ content: [{ id: 'p1', slug: 'hello-world', title: 'Hello World' }] });
    });

    it('does NOT store a mutation (read-only)', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_list')!;
      await tool.handler({}, testCtx);

      const insertCalls = mockDbPrepare.mock.calls.filter((c: string[]) => c[0].includes('INSERT INTO config_mutations'));
      expect(insertCalls).toHaveLength(0);
    });
  });

  describe('content_create', () => {
    it('calls createContent with correct body', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_create')!;
      await tool.handler(
        { title: 'My Test Post', content_markdown: '# Hello\n\nWelcome!' },
        testCtx,
      );

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const postCall = calls.find((c) => c.method === 'POST' && c.url.includes('content'));
      expect(postCall).toBeDefined();
      expect(postCall!.url).toContain('/api/v1/admin/masjids/masjid-1/content');
      expect(postCall!.body).toEqual({ title: 'My Test Post', content_markdown: '# Hello\n\nWelcome!' });
    });

    it('passes through show_on_homepage and show_on_info when provided', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_create')!;
      await tool.handler(
        {
          title: 'Pinned Post',
          content_markdown: '# Pinned',
          show_on_homepage: true,
          show_on_info: false,
          is_hidden: true,
        },
        testCtx,
      );

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const postCall = calls.find((c) => c.method === 'POST' && c.url.includes('content'));
      expect(postCall!.body).toEqual({
        title: 'Pinned Post',
        content_markdown: '# Pinned',
        show_on_homepage: true,
        show_on_info: false,
        is_hidden: true,
      });
    });

    it('stores a mutation with domain CONTENT and action CREATE', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'post-1', slug: 'my-test-post', title: 'My Test Post' }),
          { status: 200 },
        ),
      );
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_create')!;
      await tool.handler(
        { title: 'My Test Post', content_markdown: '# Hello' },
        testCtx,
      );

      const insertCalls = mockDbPrepare.mock.calls.filter((c: string[]) => c[0].includes('INSERT INTO config_mutations'));
      expect(insertCalls).toHaveLength(1);
    });

    it('returns mutationSummary containing title', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_create')!;
      const result = await tool.handler(
        { title: 'Ramadan Schedule', content_markdown: '# Ramadan' },
        testCtx,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.mutationSummary).toContain('Create');
      expect(result.mutationSummary).toContain('Ramadan Schedule');
    });

    it('returns "untitled" in mutationSummary when title is missing', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_create')!;
      const result = await tool.handler(
        { content_markdown: '# No title' },
        testCtx,
      );

      expect(result.mutationSummary).toContain('untitled');
    });
  });

  describe('content_update', () => {
    it('calls updateContent with correct slug and body', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ slug: 'my-test-post', title: 'Updated Title' }),
          { status: 200 },
        ),
      );
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_update')!;
      await tool.handler(
        { slug: 'my-test-post', title: 'Updated Title' },
        testCtx,
      );

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const putCall = calls.find((c) => c.method === 'PUT' && c.url.includes('content/my-test-post'));
      expect(putCall).toBeDefined();
      expect(putCall!.url).toContain('/api/v1/admin/masjids/masjid-1/content/my-test-post');
      expect(putCall!.body).toEqual({ title: 'Updated Title' });
    });

    it('strips slug from the body sent to API', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_update')!;
      await tool.handler(
        { slug: 'ramadan', is_hidden: true },
        testCtx,
      );

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const putCall = calls.find((c) => c.method === 'PUT' && c.url.includes('content/ramadan'));
      expect(putCall).toBeDefined();
      expect(putCall!.body).toEqual({ is_hidden: true });
      expect(putCall!.body.slug).toBeUndefined();
    });

    it('stores a mutation with domain CONTENT and action UPDATE', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_update')!;
      await tool.handler(
        { slug: 'my-test-post', title: 'New Title' },
        testCtx,
      );

      const insertCalls = mockDbPrepare.mock.calls.filter((c: string[]) => c[0].includes('INSERT INTO config_mutations'));
      expect(insertCalls).toHaveLength(1);
    });

    it('returns mutationSummary "Update content"', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_update')!;
      const result = await tool.handler(
        { slug: 'my-test-post', show_on_homepage: true },
        testCtx,
      );

      expect(result.success).toBe(true);
      expect(result.mutationSummary).toBe('Update content "my-test-post"');
    });
  });

  describe('content_delete', () => {
    it('calls deleteContent with correct slug', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_delete')!;
      await tool.handler({ slug: 'old-post' }, testCtx);

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const delCall = calls.find((c) => c.method === 'DELETE' && c.url.includes('content/old-post'));
      expect(delCall).toBeDefined();
      expect(delCall!.url).toContain('/api/v1/admin/masjids/masjid-1/content/old-post');
    });

    it('stores a mutation with domain CONTENT and action DELETE', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_delete')!;
      await tool.handler({ slug: 'old-post' }, testCtx);

      const insertCalls = mockDbPrepare.mock.calls.filter((c: string[]) => c[0].includes('INSERT INTO config_mutations'));
      expect(insertCalls).toHaveLength(1);
    });

    it('returns mutationSummary "Delete content {slug}"', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_delete')!;
      const result = await tool.handler({ slug: 'old-post' }, testCtx);

      expect(result.success).toBe(true);
      expect(result.mutationSummary).toBe('Delete content "old-post"');
    });
  });

  describe('content_pin_homepage', () => {
    it('calls pinContentHomepage with correct slug', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_pin_homepage')!;
      await tool.handler({ slug: 'featured-post' }, testCtx);

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const putCall = calls.find((c) => c.method === 'PUT' && c.url.includes('content/featured-post/homepage'));
      expect(putCall).toBeDefined();
      expect(putCall!.url).toContain('/api/v1/admin/masjids/masjid-1/content/featured-post/homepage');
    });

    it('sends an empty object body', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_pin_homepage')!;
      await tool.handler({ slug: 'featured-post' }, testCtx);

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const putCall = calls.find((c) => c.method === 'PUT' && c.url.includes('homepage'));
      expect(putCall!.body).toEqual({});
    });

    it('stores a mutation with domain CONTENT and action PIN_HOMEPAGE', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_pin_homepage')!;
      await tool.handler({ slug: 'featured-post' }, testCtx);

      const insertCalls = mockDbPrepare.mock.calls.filter((c: string[]) => c[0].includes('INSERT INTO config_mutations'));
      expect(insertCalls).toHaveLength(1);
    });

    it('returns mutationSummary "Toggle homepage pin"', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_pin_homepage')!;
      const result = await tool.handler({ slug: 'featured-post' }, testCtx);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.mutationSummary).toBe('Toggle homepage pin');
    });
  });

  describe('content_pin_info', () => {
    it('calls pinContentInfo with correct slug', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_pin_info')!;
      await tool.handler({ slug: 'info-page-post' }, testCtx);

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const putCall = calls.find((c) => c.method === 'PUT' && c.url.includes('content/info-page-post/info'));
      expect(putCall).toBeDefined();
      expect(putCall!.url).toContain('/api/v1/admin/masjids/masjid-1/content/info-page-post/info');
    });

    it('sends an empty object body', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_pin_info')!;
      await tool.handler({ slug: 'info-page-post' }, testCtx);

      const calls = getFetchUrlAndOptions(mockFetch.mock.calls);
      const putCall = calls.find((c) => c.method === 'PUT' && c.url.includes('info'));
      expect(putCall!.body).toEqual({});
    });

    it('stores a mutation with domain CONTENT and action PIN_INFO', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_pin_info')!;
      await tool.handler({ slug: 'info-page-post' }, testCtx);

      const insertCalls = mockDbPrepare.mock.calls.filter((c: string[]) => c[0].includes('INSERT INTO config_mutations'));
      expect(insertCalls).toHaveLength(1);
    });

    it('returns mutationSummary "Toggle info pin"', async () => {
      const { getToolDefinitions } = await import('../tools');
      const tools = getToolDefinitions();
      const tool = tools.find((t) => t.name === 'content_pin_info')!;
      const result = await tool.handler({ slug: 'info-page-post' }, testCtx);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.mutationSummary).toBe('Toggle info pin');
    });
  });
});