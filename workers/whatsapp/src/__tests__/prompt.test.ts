import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../agent/prompt';
import type { Env, AdminRecord } from '../types';

const testAdmin: AdminRecord = {
  id: 'admin-1',
  masjid_id: 'masjid-1',
  email: 'admin@test.org',
  display_name: 'Test Admin',
  whatsapp_phone: '+15550000001',
};

const testEnv: Env = {
  DB: {} as D1Database,
  ASSETS: {} as R2Bucket,
  API_URL: 'http://localhost:5173',
  JWT_SECRET: 'test-secret',
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_PHONE_ID: 'test-phone-id',
  WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
};

describe('buildSystemPrompt', () => {
  it('includes masjid name from state when available', () => {
    const state = { masjid: { name: 'Masjid Al-Noor' } };
    const prompt = buildSystemPrompt(testAdmin, state, testEnv);
    expect(prompt).toContain('Masjid Al-Noor');
  });

  it('falls back to admin email when state has no masjid name', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('admin@test.org');
  });

  it('falls back to admin email when masjid is not an object', () => {
    const state = { masjid: null };
    const prompt = buildSystemPrompt(testAdmin, state, testEnv);
    expect(prompt).toContain('admin@test.org');
  });

  it('includes masjid ID in context', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('masjid-1');
  });

  it('includes THEME domain section', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('### THEME');
    expect(prompt).toContain('primary_color');
    expect(prompt).toContain('accent_color');
  });

  it('includes Indo-Pak transliteration hints', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('Azaan');
    expect(prompt).toContain('Zuhr');
    expect(prompt).toContain('Jummah');
  });

  it('includes PROFILE domain section', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('### PROFILE');
    expect(prompt).toContain('calculation method');
  });

  it('includes calculation method reference (1-7)', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('2=ISNA');
    expect(prompt).toContain('7=Karachi');
  });

  it('includes PRAYER_RULES domain section', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('### PRAYER_RULES');
    expect(prompt).toContain('execution_order');
    expect(prompt).toContain('add_minutes');
    expect(prompt).toContain('set_fixed_time');
    expect(prompt).toContain('right_after_adhaan');
  });

  it('includes round increment constraints', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('1, 5, 10, 15, 20, 30, or 60');
  });

  it('includes day of week numbering', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('0=Sunday');
    expect(prompt).toContain('5=Friday');
  });

  it('includes JUMUAH domain section', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('### JUMUAH');
    expect(prompt).toContain('label');
    expect(prompt).toContain('khateeb');
  });

  it('includes ANNOUNCEMENTS domain section', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('### ANNOUNCEMENTS');
    expect(prompt).toContain('draft/published/archived');
  });

  it('includes example interactions', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('## Examples');
    expect(prompt).toContain('Make Dhuhr iqaamah 10 minutes after adhaan');
    expect(prompt).toContain('Set the primary color to dark blue');
  });

  it('includes behavioral rules', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('ALWAYS use read/get tools');
    expect(prompt).toContain('Never invent IDs');
    expect(prompt).toContain('execution_order is correct');
  });

  it('does not leak JWT_SECRET in prompt', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).not.toContain('test-secret');
  });

  it('does not leak WHATSAPP_TOKEN in prompt', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).not.toContain('test-token');
  });

  it('outputs plain text not JSON', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(() => JSON.parse(prompt)).toThrow();
  });

  it('handles undefined state fields gracefully', () => {
    const state = { masjid: { name: undefined, other: 'value' } };
    const prompt = buildSystemPrompt(testAdmin, state as Record<string, unknown>, testEnv);
    expect(prompt).toContain('admin@test.org');
  });

  it('includes WhatsApp formatting guidance', () => {
    const prompt = buildSystemPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('*bold*');
  });
});

describe('buildVisionPrompt', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('includes masjid name from state', async () => {
    const { buildVisionPrompt } = await import('../agent/prompt');
    const state = { masjid: { name: 'Masjid Al-Huda' } };
    const prompt = buildVisionPrompt(testAdmin, state as Record<string, unknown>, testEnv);
    expect(prompt).toContain('Masjid Al-Huda');
  });

  it('falls back to admin email when name is absent', async () => {
    const { buildVisionPrompt } = await import('../agent/prompt');
    const prompt = buildVisionPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('admin@test.org');
  });

  it('includes timetable extraction guide', async () => {
    const { buildVisionPrompt } = await import('../agent/prompt');
    const prompt = buildVisionPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('Timetable Extraction Guide');
    expect(prompt).toContain('fajr');
    expect(prompt).toContain('dhuhr');
    expect(prompt).toContain('asr');
    expect(prompt).toContain('maghrib');
    expect(prompt).toContain('isha');
  });

  it('includes guidance about prayer name mapping', async () => {
    const { buildVisionPrompt } = await import('../agent/prompt');
    const prompt = buildVisionPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('Zuhr');
    expect(prompt).toContain('Fajer');
    expect(prompt).toContain('Ishaa');
  });

  it('includes rules about checking current state', async () => {
    const { buildVisionPrompt } = await import('../agent/prompt');
    const prompt = buildVisionPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('profile_get first');
    expect(prompt).toContain('prayer_rules_list');
  });

  it('includes guidance about multiple date ranges', async () => {
    const { buildVisionPrompt } = await import('../agent/prompt');
    const prompt = buildVisionPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('date ranges');
  });

  it('includes Jumuah/Friday guidance', async () => {
    const { buildVisionPrompt } = await import('../agent/prompt');
    const prompt = buildVisionPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('Friday');
    expect(prompt).toContain('Jumu\'ah');
  });

  it('includes domain guide for reference', async () => {
    const { buildVisionPrompt } = await import('../agent/prompt');
    const prompt = buildVisionPrompt(testAdmin, {}, testEnv);
    expect(prompt).toContain('THEME');
    expect(prompt).toContain('PRAYER_RULES');
  });
});
