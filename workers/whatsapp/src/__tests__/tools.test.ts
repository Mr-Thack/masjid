import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, ToolContext } from '../types';

const testEnv: Env = {
  DB: {} as D1Database,
  ASSETS: {} as R2Bucket,
  API_URL: 'http://localhost:5173',
  JWT_SECRET: 'test-secret',
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_PHONE_ID: 'test-phone-id',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
};

const testCtx: ToolContext = {
  adminId: 'admin-1',
  masjidId: 'masjid-1',
  branchId: 'branch-1',
  env: testEnv,
};

const defaultProxyResponse = { success: true, data: {} };

vi.mock('../proxy', () => ({
  getMasjidProfile: vi.fn().mockResolvedValue({ theme: { primary_color: '#333' }, masjid: { name: 'Test' } }),
  updateMasjidProfile: vi.fn().mockResolvedValue(defaultProxyResponse),
  getPrayerConfig: vi.fn().mockResolvedValue({ calculation_method: 2, timezone: 'America/Chicago' }),
  updatePrayerConfig: vi.fn().mockResolvedValue(defaultProxyResponse),
  getPrayerRulesList: vi.fn().mockResolvedValue([{ id: 'r1', rule_name: 'Rule 1' }]),
  createPrayerRule: vi.fn().mockResolvedValue({ id: 'new-rule-1' }),
  updatePrayerRule: vi.fn().mockResolvedValue(defaultProxyResponse),
  deletePrayerRule: vi.fn().mockResolvedValue(defaultProxyResponse),
  reorderPrayerRules: vi.fn().mockResolvedValue(defaultProxyResponse),
  getJumuahSessions: vi.fn().mockResolvedValue([{ id: 'j1', label: 'Main' }]),
  createJumuahSession: vi.fn().mockResolvedValue({ id: 'new-session-1' }),
  updateJumuahSession: vi.fn().mockResolvedValue(defaultProxyResponse),
  deleteJumuahSession: vi.fn().mockResolvedValue(defaultProxyResponse),
  getAnnouncements: vi.fn().mockResolvedValue([{ slug: 'a1', title: 'Test' }]),
  createAnnouncement: vi.fn().mockResolvedValue({ slug: 'new-announcement' }),
  updateAnnouncement: vi.fn().mockResolvedValue(defaultProxyResponse),
  deleteAnnouncement: vi.fn().mockResolvedValue(defaultProxyResponse),
  pinAnnouncement: vi.fn().mockResolvedValue(defaultProxyResponse),
}));

vi.mock('../session', () => ({
  storeMutation: vi.fn().mockResolvedValue('mut-uuid-123'),
  getMutationCount: vi.fn().mockResolvedValue(0),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getToolDefinitions', () => {
  it('returns 20 tools', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const tools = getToolDefinitions();
    expect(tools).toHaveLength(20);
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
    const proxy = await import('../proxy');
    const session = await import('../session');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'theme_update')!;
    const result = await tool.handler({ primary_color: '#abc' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.mutationSummary).toContain('Update theme');
    expect(proxy.updateMasjidProfile).toHaveBeenCalled();
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'THEME', 'UPSERT', 'theme', expect.any(Object), testCtx.env.DB,
    );
  });

  it('profile_update calls updateMasjidProfile + storeMutation', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const session = await import('../session');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'profile_update')!;
    const result = await tool.handler({ name: 'New Masjid' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.mutationSummary).toContain('Update profile');
    expect(proxy.updateMasjidProfile).toHaveBeenCalled();
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'PROFILE', 'UPSERT', 'profile', expect.any(Object), testCtx.env.DB,
    );
  });

  it('prayer_config_update calls updatePrayerConfig + storeMutation', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const session = await import('../session');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_config_update')!;
    const result = await tool.handler({ calculation_method: 3 }, testCtx);
    expect(result.success).toBe(true);
    expect(proxy.updatePrayerConfig).toHaveBeenCalled();
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'PROFILE', 'PATCH', 'prayer_config', expect.any(Object), testCtx.env.DB,
    );
  });

  it('prayer_rules_create calls createPrayerRule, extracts id for target_key', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const session = await import('../session');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_create')!;
    const result = await tool.handler({ prayer_name: 'dhuhr', rule_name: 'Test', execution_order: 0, conditions_json: [], action_json: {} }, testCtx);
    expect(result.success).toBe(true);
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'PRAYER_RULES', 'CREATE', 'rule:new-rule-1', expect.any(Object), testCtx.env.DB,
    );
  });

  it('prayer_rules_update strips rule_id from body', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_update')!;
    await tool.handler({ rule_id: 'r1', prayer_name: 'asr' }, testCtx);
    expect(proxy.updatePrayerRule).toHaveBeenCalledWith('r1', { prayer_name: 'asr' }, testCtx.env, testCtx.adminId, testCtx.masjidId);
  });

  it('prayer_rules_delete calls deletePrayerRule', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_delete')!;
    await tool.handler({ rule_id: 'r1' }, testCtx);
    expect(proxy.deletePrayerRule).toHaveBeenCalledWith('r1', testCtx.env, testCtx.adminId, testCtx.masjidId);
  });

  it('prayer_rules_reorder passes order array', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_reorder')!;
    await tool.handler({ order: ['r3', 'r1', 'r2'] }, testCtx);
    expect(proxy.reorderPrayerRules).toHaveBeenCalledWith(['r3', 'r1', 'r2'], testCtx.env, testCtx.adminId, testCtx.masjidId);
  });

  it('jumuah_create extracts id for target_key', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const session = await import('../session');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'jumuah_create')!;
    await tool.handler({ label: 'Main', time: '13:00' }, testCtx);
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'JUMUAH', 'CREATE', 'session:new-session-1', expect.any(Object), testCtx.env.DB,
    );
  });

  it('jumuah_update strips session_id', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'jumuah_update')!;
    await tool.handler({ session_id: 's1', time: '14:00' }, testCtx);
    expect(proxy.updateJumuahSession).toHaveBeenCalledWith('s1', { time: '14:00' }, testCtx.env, testCtx.adminId, testCtx.masjidId);
  });

  it('jumuah_delete stores mutation with empty payload', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const session = await import('../session');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'jumuah_delete')!;
    await tool.handler({ session_id: 's1' }, testCtx);
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'JUMUAH', 'DELETE', 'session:s1', {}, testCtx.env.DB,
    );
  });

  it('announcements_create extracts slug for target_key', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const session = await import('../session');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_create')!;
    await tool.handler({ title: 'Eid', content_markdown: '# Eid' }, testCtx);
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'ANNOUNCEMENTS', 'CREATE', 'announcement:new-announcement', expect.any(Object), testCtx.env.DB,
    );
  });

  it('announcements_update strips slug from body', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_update')!;
    await tool.handler({ slug: 'eid', title: 'Updated Eid' }, testCtx);
    expect(proxy.updateAnnouncement).toHaveBeenCalledWith('eid', { title: 'Updated Eid' }, testCtx.env, testCtx.adminId, testCtx.masjidId);
  });

  it('announcements_pin calls pinAnnouncement', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_pin')!;
    await tool.handler({ slug: 'eid' }, testCtx);
    expect(proxy.pinAnnouncement).toHaveBeenCalledWith('eid', testCtx.env, testCtx.adminId, testCtx.masjidId);
  });

  it('prayer_rules_create uses "nowhere" when API returns no id', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const session = await import('../session');

    (proxy.createPrayerRule as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'prayer_rules_create')!;
    await tool.handler({ prayer_name: 'fajr', rule_name: 'Test', execution_order: 0, conditions_json: [], action_json: {} }, testCtx);
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'PRAYER_RULES', 'CREATE', 'rule:nowhere', expect.any(Object), testCtx.env.DB,
    );
  });

  it('announcements_create uses "nowhere" when API returns no slug', async () => {
    const { getToolDefinitions } = await import('../agent/tools');
    const proxy = await import('../proxy');
    const session = await import('../session');

    (proxy.createAnnouncement as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

    const tools = getToolDefinitions();
    const tool = tools.find(t => t.name === 'announcements_create')!;
    await tool.handler({ title: 'Test', content_markdown: '# hi' }, testCtx);
    expect(session.storeMutation).toHaveBeenCalledWith(
      testCtx.branchId, 'ANNOUNCEMENTS', 'CREATE', 'announcement:nowhere', expect.any(Object), testCtx.env.DB,
    );
  });
});
