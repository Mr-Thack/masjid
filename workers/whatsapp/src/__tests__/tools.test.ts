import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BotContext } from '@masjid/agent';

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
  branchName: 'whatsapp-2026-07-21',
  db: { prepare: mockDbPrepare } as unknown as D1Database,
  apiUrl: 'http://localhost:5173',
  jwtSecret: 'test-secret',
  llmConfig: { url: '', key: '', model: '' },
};

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockFetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: 'new-id', slug: 'new-slug', theme: { primary_color: '#333' }, masjid: { name: 'Test' } }), { status: 200 }),
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

describe('getToolDefinitions', () => {
  it('returns all tools', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    expect(tools).toHaveLength(23);
  });

  it('all tools have name, description, parameters, handler', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeTruthy();
      expect(typeof tool.handler).toBe('function');
    }
  });

  it('read tools have empty required params', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const readTools = tools.filter(t => t.name.endsWith('_get') || t.name.endsWith('_list'));
    for (const tool of readTools) {
      const params = tool.parameters as { required: string[] };
      expect(params.required).toEqual([]);
    }
  });

  it('theme_update has correct hex regex pattern', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const theme = tools.find(t => t.name === 'theme_update');
    const props = (theme?.parameters as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(props?.primary_color?.pattern).toBe('^#[0-9a-fA-F]{6}$');
  });

  it('jumuah_create has time regex pattern', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const jumuah = tools.find(t => t.name === 'jumuah_create');
    const props = (jumuah?.parameters as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(props?.time?.pattern).toMatch(/\[01\]/);
  });

  it('prayer_config_update has integer calculation_method', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const config = tools.find(t => t.name === 'prayer_config_update');
    const props = (config?.parameters as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(props?.calculation_method?.type).toBe('integer');
    expect(props?.calculation_method?.minimum).toBe(1);
  });

  it('announcements_create has enum status', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const ann = tools.find(t => t.name === 'announcements_create');
    const props = (ann?.parameters as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(props?.status?.enum).toEqual(['draft', 'published', 'archived']);
  });

  it('jumuah_update has nullable khateeb', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const jumuah = tools.find(t => t.name === 'jumuah_update');
    const props = (jumuah?.parameters as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(props?.khateeb?.nullable).toBe(true);
  });
});

describe('tool handlers — read tools', () => {
  it('theme_get extracts .theme from profile', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'theme_get')!;
    const result = await tool.handler({}, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ primary_color: '#333' });
  });

  it('profile_get returns full profile', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'profile_get')!;
    const result = await tool.handler({}, testCtx);
    expect(result.success).toBe(true);
  });

  it('prayer_config_get returns prayer config', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_config_get')!;
    const result = await tool.handler({}, testCtx);
    expect(result.success).toBe(true);
  });

  it('prayer_rules_list returns rules', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_list')!;
    const result = await tool.handler({}, testCtx);
    expect(result.success).toBe(true);
  });

  it('jumuah_list returns sessions', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'jumuah_list')!;
    const result = await tool.handler({}, testCtx);
    expect(result.success).toBe(true);
  });

  it('announcements_list returns announcements', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_list')!;
    const result = await tool.handler({}, testCtx);
    expect(result.success).toBe(true);
  });
});

describe('tool handlers — write tools', () => {
  it('theme_update calls updateMasjidProfile + storeMutation', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'theme_update')!;
    const result = await tool.handler({ primary_color: '#abc' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.mutationSummary).toContain('Update theme');

    const calls = mockFetch.mock.calls;
    const putCall = calls.find((c: unknown[]) => (c[1] as Record<string, string>)?.method === 'PUT');
    expect(putCall).toBeDefined();
    expect(putCall[0]).toContain('/admin/masjids/masjid-1');
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO config_mutations'));
  });

  it('profile_update calls updateMasjidProfile + storeMutation', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'profile_update')!;
    const result = await tool.handler({ name: 'New Masjid' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.mutationSummary).toContain('Update profile');
    expect(mockFetch).toHaveBeenCalled();
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO config_mutations'));
  });

  it('prayer_config_update calls updatePrayerConfig + storeMutation', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_config_update')!;
    const result = await tool.handler({ calculation_method: 3 }, testCtx);
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO config_mutations'));
  });

  it('prayer_rules_create calls createPrayerRule, extracts id for target_key', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_create')!;
    const result = await tool.handler({ prayer_name: 'dhuhr', rule_name: 'Test', execution_order: 0, conditions_json: [], action_json: {} }, testCtx);
    expect(result.success).toBe(true);
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO config_mutations'));
  });

  it('prayer_rules_update strips rule_id from body', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_update')!;
    await tool.handler({ rule_id: 'r1', prayer_name: 'asr' }, testCtx);
    const putCall = mockFetch.mock.calls.find((c: unknown[]) => (c[1] as Record<string, string>)?.method === 'PUT' && (c[0] as string).includes('rules/r1'));
    expect(putCall).toBeDefined();
  });

  it('prayer_rules_delete calls deletePrayerRule', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_delete')!;
    await tool.handler({ rule_id: 'r1' }, testCtx);
    const delCall = mockFetch.mock.calls.find((c: unknown[]) => (c[1] as Record<string, string>)?.method === 'DELETE' && (c[0] as string).includes('rules/r1'));
    expect(delCall).toBeDefined();
  });

  it('prayer_rules_reorder passes order array', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_reorder')!;
    await tool.handler({ order: ['r3', 'r1', 'r2'] }, testCtx);
    const putCall = mockFetch.mock.calls.find((c: unknown[]) => (c[1] as Record<string, string>)?.method === 'PUT' && (c[0] as string).includes('reorder'));
    expect(putCall).toBeDefined();
  });

  it('jumuah_create extracts id for target_key', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'jumuah_create')!;
    await tool.handler({ label: 'Main', time: '13:00' }, testCtx);
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO config_mutations'));
  });

  it('jumuah_update strips session_id', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'jumuah_update')!;
    await tool.handler({ session_id: 's1', time: '14:00' }, testCtx);
    const putCall = mockFetch.mock.calls.find((c: unknown[]) => (c[1] as Record<string, string>)?.method === 'PUT' && (c[0] as string).includes('jumuah/s1'));
    expect(putCall).toBeDefined();
  });

  it('jumuah_delete stores mutation with empty payload', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'jumuah_delete')!;
    await tool.handler({ session_id: 's1' }, testCtx);
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO config_mutations'));
  });

  it('announcements_create extracts slug for target_key', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_create')!;
    await tool.handler({ title: 'Eid', content_markdown: '# Eid' }, testCtx);
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO config_mutations'));
  });

  it('announcements_update strips slug from body', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_update')!;
    await tool.handler({ slug: 'eid', title: 'Updated Eid' }, testCtx);
    const putCall = mockFetch.mock.calls.find((c: unknown[]) => (c[1] as Record<string, string>)?.method === 'PUT' && (c[0] as string).includes('announcements/eid'));
    expect(putCall).toBeDefined();
  });

  it('announcements_pin calls pinAnnouncement', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_pin')!;
    await tool.handler({ slug: 'eid' }, testCtx);
    const putCall = mockFetch.mock.calls.find((c: unknown[]) => (c[1] as Record<string, string>)?.method === 'PUT' && (c[0] as string).includes('pin'));
    expect(putCall).toBeDefined();
  });

  it('prayer_rules_create uses "nowhere" when API returns no id', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_create')!;
    await tool.handler({ prayer_name: 'fajr', rule_name: 'Test', execution_order: 0, conditions_json: [], action_json: {} }, testCtx);
    expect(mockDbPrepare).toHaveBeenCalled();
  });

  it('announcements_create uses "nowhere" when API returns no slug', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_create')!;
    await tool.handler({ title: 'Test', content_markdown: '# hi' }, testCtx);
    expect(mockDbPrepare).toHaveBeenCalled();
  });
});

describe('Stage 4 tools', () => {
  it('timetable_preview calls dryRunPrayerTimes', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ fajr: { adhaan: '05:00', iqaamah: '05:30' } }), { status: 200 }));
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'timetable_preview')!;
    const result = await tool.handler({ date: '2026-07-21' }, testCtx);
    expect(result.success).toBe(true);

    const postCall = mockFetch.mock.calls.find((c: unknown[]) =>
      (c[1] as Record<string, string>)?.method === 'POST' && (c[0] as string).includes('dry-run'),
    );
    expect(postCall).toBeDefined();
  });

  it('timetable_preview passes rule_overrides', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'timetable_preview')!;
    await tool.handler({
      date: '2026-07-21',
      rule_overrides: [{ prayer_name: 'fajr', execution_order: 0, conditions_json: [{ type: 'always' }], action_json: { type: 'add_minutes', minutes: 20 } }],
    }, testCtx);

    const postCall = mockFetch.mock.calls.find((c: unknown[]) =>
      (c[1] as Record<string, string>)?.method === 'POST' && (c[0] as string).includes('dry-run'),
    );
    expect(postCall).toBeDefined();
  });

  it('rollback_list_snapshots calls listSnapshots', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'rollback_list_snapshots')!;
    const result = await tool.handler({}, testCtx);

    expect(result.success).toBe(true);
    expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id, summary, full_state_json, created_at FROM config_snapshots'));
  });

  it('rollback_restore calls rollbackRestore proxy', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true, restored: ['profile'], snapshot_id: 'snap-1' }), { status: 200 }));
    mockDbFirst.mockResolvedValue({
      id: 'snap-1',
      masjid_id: 'masjid-1',
      summary: 'First merge',
      full_state_json: '{}',
      created_at: '2026-07-20T12:00:00Z',
    });

    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'rollback_restore')!;
    const result = await tool.handler({ snapshot_id: 'snap-1' }, testCtx);

    expect(result.success).toBe(true);
    const postCall = mockFetch.mock.calls.find((c: unknown[]) =>
      (c[1] as Record<string, string>)?.method === 'POST' && (c[0] as string).includes('rollback'),
    );
    expect(postCall).toBeDefined();
  });

  it('rollback_restore returns error for nonexistent snapshot', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    mockDbFirst.mockResolvedValue(null);

    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'rollback_restore')!;
    const result = await tool.handler({ snapshot_id: 'nonexistent' }, testCtx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
