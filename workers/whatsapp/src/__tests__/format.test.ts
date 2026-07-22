import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MutationRecord } from '../types';

function mutation(overrides: Partial<MutationRecord> = {}): MutationRecord {
  return {
    id: 'mut-1',
    branch_id: 'branch-1',
    domain: 'THEME',
    action_type: 'UPSERT',
    target_key: 'theme',
    payload_json: JSON.stringify({ primary_color: '#1e3a8a', font_body: 'Roboto' }),
    sequence_order: 0,
    created_at: '2026-07-20T12:00:00Z',
    ...overrides,
  };
}

const mockDb = {} as D1Database;

beforeEach(() => {
  vi.resetModules();
});

async function formatWith(muts: MutationRecord[]) {
  vi.doMock('../session', () => ({
    getMutations: vi.fn().mockResolvedValue(muts),
    getMutationCount: vi.fn().mockResolvedValue(muts.length),
  }));
  const { formatDiffReceipt } = await import('../agent/format');
  return formatDiffReceipt('branch-1', 'test-session', mockDb);
}

describe('formatDiffReceipt', () => {
  it('returns no-changes message when no mutations', async () => {
    const result = await formatWith([]);
    expect(result).toContain('No changes were made');
  });

  it('formats a single THEME mutation with changed fields', async () => {
    const result = await formatWith([mutation({ domain: 'THEME', payload_json: JSON.stringify({ primary_color: '#1e3a8a' }) })]);
    expect(result).toContain('*Changes Applied*');
    expect(result).toContain('*~ Theme*');
    expect(result).toContain('primary_color: #1e3a8a');
  });

  it('formats a single PROFILE mutation', async () => {
    const result = await formatWith([mutation({ domain: 'PROFILE', payload_json: JSON.stringify({ name: 'New Name', city: 'Chicago' }) })]);
    expect(result).toContain('*~ Profile*');
    expect(result).toContain('name: New Name');
    expect(result).toContain('city: Chicago');
  });

  it('truncates long field values', async () => {
    const result = await formatWith([mutation({ domain: 'THEME', payload_json: JSON.stringify({ font_body: 'a'.repeat(50) }) })]);
    expect(result).toContain('...');
    expect(result).not.toContain('a'.repeat(50));
  });

  it('filters out masjid_id from displayed changes', async () => {
    const result = await formatWith([mutation({ domain: 'THEME', payload_json: JSON.stringify({ primary_color: '#111', masjid_id: 'xyz' }) })]);
    expect(result).toContain('primary_color');
    expect(result).not.toContain('masjid_id');
  });

  it('shows CREATE prayer rule with rule name and prayer', async () => {
    const result = await formatWith([mutation({
      domain: 'PRAYER_RULES', action_type: 'CREATE',
      payload_json: JSON.stringify({ rule_name: 'Friday Dhuhr', prayer_name: 'dhuhr' }),
    })]);
    expect(result).toContain('*+ Prayer Rules*');
    expect(result).toContain('Friday Dhuhr');
    expect(result).toContain('dhuhr');
  });

  it('shows DELETE prayer rule', async () => {
    const result = await formatWith([mutation({ domain: 'PRAYER_RULES', action_type: 'DELETE', payload_json: '{}' })]);
    expect(result).toContain('rule deleted');
  });

  it('shows REORDER prayer rules', async () => {
    const result = await formatWith([mutation({ domain: 'PRAYER_RULES', action_type: 'REORDER', payload_json: '{}' })]);
    expect(result).toContain('Reorder');
  });

  it('shows UPDATE prayer rule without crash', async () => {
    const result = await formatWith([mutation({ domain: 'PRAYER_RULES', action_type: 'UPDATE', payload_json: '{}' })]);
    expect(result).toContain('rule updated');
  });

  it('shows CREATE Jumuah session with Khutbah time', async () => {
    const result = await formatWith([mutation({
      domain: 'JUMUAH', action_type: 'CREATE',
      payload_json: JSON.stringify({ label: 'First Session', time: '13:15' }),
    })]);
    expect(result).toContain('*+ Jumu\'ah*');
    expect(result).toContain('Khutbah: 13:15');
  });

  it('shows DELETE Jumuah session', async () => {
    const result = await formatWith([mutation({ domain: 'JUMUAH', action_type: 'DELETE', payload_json: '{}' })]);
    expect(result).toContain('session deleted');
  });

  it('shows UPDATE Jumuah session', async () => {
    const result = await formatWith([mutation({ domain: 'JUMUAH', action_type: 'UPDATE', payload_json: '{}' })]);
    expect(result).toContain('session updated');
  });

  it('shows CREATE announcement with title', async () => {
    const result = await formatWith([mutation({
      domain: 'ANNOUNCEMENTS', action_type: 'CREATE',
      payload_json: JSON.stringify({ title: 'Eid Prayer', content_markdown: 'some content' }),
    })]);
    expect(result).toContain('*+ Announcements*');
    expect(result).toContain('Eid Prayer');
  });

  it('shows PIN/UNPIN announcement', async () => {
    const result = await formatWith([mutation({ domain: 'ANNOUNCEMENTS', action_type: 'PIN', payload_json: '{}' })]);
    expect(result).toContain('Pin/Unpin');
  });

  it('shows DELETE announcement as archived', async () => {
    const result = await formatWith([mutation({ domain: 'ANNOUNCEMENTS', action_type: 'DELETE', payload_json: '{}' })]);
    expect(result).toContain('archived');
  });

  it('handles multiple mutations with sequential numbering', async () => {
    const result = await formatWith([
      mutation({ sequence_order: 0, domain: 'THEME' }),
      mutation({ id: 'mut-2', sequence_order: 1, domain: 'PROFILE', payload_json: JSON.stringify({ city: 'NYC' }) }),
    ]);
    expect(result).toContain('1.');
    expect(result).toContain('2.');
  });

  it('handles malformed payload_json gracefully', async () => {
    const result = await formatWith([mutation({ domain: 'THEME', payload_json: 'not-valid-json' })]);
    expect(result).toContain('*~ Theme*');
    expect(result).not.toContain('JSON');
  });

  it('includes confirm/cancel footer', async () => {
    const result = await formatWith([mutation()]);
    expect(result).toContain('/confirm');
    expect(result).toContain('/cancel');
  });

  it('shows correct total count with singular', async () => {
    const result = await formatWith([mutation()]);
    expect(result).toContain('1 change total');
  });

  it('shows correct total count with plural', async () => {
    const result = await formatWith([mutation(), mutation({ id: 'mut-2', sequence_order: 1 })]);
    expect(result).toContain('2 changes total');
  });

  it('includes session name', async () => {
    const result = await formatWith([mutation()]);
    expect(result).toContain('test-session');
  });

  it('handles unknown domain without crashing', async () => {
    const result = await formatWith([mutation({ domain: 'UNKNOWN' })]);
    expect(result).toContain('~ UNKNOWN');
  });

  it('uses correct icons for CREATE/DELETE/UPSERT', async () => {
    const result = await formatWith([
      mutation({ sequence_order: 0, action_type: 'CREATE', domain: 'JUMUAH', payload_json: JSON.stringify({ label: 'S1', time: '13:00' }) }),
      mutation({ id: 'mut-2', sequence_order: 1, action_type: 'DELETE', domain: 'JUMUAH', payload_json: '{}' }),
      mutation({ id: 'mut-3', sequence_order: 2, action_type: 'UPSERT', domain: 'THEME', payload_json: JSON.stringify({ primary_color: '#fff' }) }),
    ]);
    expect(result).toContain('*+ Jumu\'ah*');
    expect(result).toContain('*- Jumu\'ah*');
    expect(result).toContain('*~ Theme*');
  });
});

describe('buildNoChangesMessage', () => {
  it('returns guidance text', async () => {
    const { buildNoChangesMessage } = await import('../agent/format');
    const msg = buildNoChangesMessage();
    expect(msg).toContain('No changes detected');
    expect(msg).toContain('/help');
  });
});

describe('buildConfirmSuccessMessage', () => {
  it('includes branch name and mutation count (singular)', async () => {
    const { buildConfirmSuccessMessage } = await import('../agent/format');
    const msg = buildConfirmSuccessMessage('whatsapp-2026-07-20', 1);
    expect(msg).toContain('finalized');
    expect(msg).toContain('whatsapp-2026-07-20');
    expect(msg).toContain('1 change');
    expect(msg).not.toContain('1 changes');
  });

  it('includes branch name and mutation count (plural)', async () => {
    const { buildConfirmSuccessMessage } = await import('../agent/format');
    const msg = buildConfirmSuccessMessage('whatsapp-2026-07-20', 5);
    expect(msg).toContain('5 changes');
  });

  it('mentions public pages update', async () => {
    const { buildConfirmSuccessMessage } = await import('../agent/format');
    const msg = buildConfirmSuccessMessage('test', 1);
    expect(msg).toContain('public pages');
  });
});

describe('buildErrorSummary', () => {
  it('renders bullet list from error strings', async () => {
    const { buildErrorSummary } = await import('../agent/format');
    const msg = buildErrorSummary(['Error one', 'Error two']);
    expect(msg).toContain('Some changes failed');
    expect(msg).toContain('Error one');
    expect(msg).toContain('Error two');
  });

  it('renders empty section for empty errors', async () => {
    const { buildErrorSummary } = await import('../agent/format');
    const msg = buildErrorSummary([]);
    expect(msg).toContain('Some changes failed');
  });
});
