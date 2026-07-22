import type { MutationRecord } from '../types';
import { getMutations, getMutationCount } from '../session';

const DOMAIN_LABELS: Record<string, string> = {
  THEME: 'Theme',
  PROFILE: 'Profile',
  PRAYER_RULES: 'Prayer Rules',
  JUMUAH: "Jumu'ah",
  ANNOUNCEMENTS: 'Announcements',
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function formatMutation(m: MutationRecord, index: number): string {
  const domain = DOMAIN_LABELS[m.domain] || m.domain;
  const action = m.action_type === 'CREATE' ? '+' : m.action_type === 'DELETE' ? '-' : '~';

  try {
    const payload = JSON.parse(m.payload_json);

    switch (m.domain) {
      case 'THEME': {
        const changes = Object.keys(payload)
          .filter(k => !['masjid_id'].includes(k))
          .map(k => `  ${k}: ${truncate(String(payload[k]), 30)}`);
        return `${index}. *${action} ${domain}* ${changes.length ? '\n' + changes.join('\n') : ''}`;
      }
      case 'PROFILE': {
        const changes = Object.keys(payload)
          .filter(k => !['masjid_id'].includes(k))
          .map(k => `  ${k}: ${truncate(String(payload[k]), 30)}`);
        return `${index}. *${action} ${domain}* ${changes.length ? '\n' + changes.join('\n') : ''}`;
      }
      case 'PRAYER_RULES': {
        if (m.action_type === 'CREATE') {
          const rule = payload;
          return `${index}. *${action} ${domain}*\n  Rule: ${rule.rule_name || 'untitled'}\n  Prayer: ${rule.prayer_name || '?'}`;
        }
        if (m.action_type === 'REORDER') {
          return `${index}. *${action} Reorder ${domain}*`;
        }
        if (m.action_type === 'DELETE') {
          return `${index}. *${action} ${domain}* (rule deleted)`;
        }
        return `${index}. *${action} ${domain}* (rule updated)`;
      }
      case 'JUMUAH': {
        if (m.action_type === 'CREATE') {
          const speech = payload.speech_time ? `\n  Speech: ${payload.speech_time}` : '';
          return `${index}. *${action} ${domain}*\n  Khutbah: ${payload.time || '?'}${speech}`;
        }
        if (m.action_type === 'DELETE') {
          return `${index}. *${action} ${domain}* (session deleted)`;
        }
        return `${index}. *${action} ${domain}* (session updated)`;
      }
      case 'ANNOUNCEMENTS': {
        if (m.action_type === 'CREATE') {
          return `${index}. *${action} ${domain}*\n  Title: ${truncate(payload.title || '?', 40)}`;
        }
        if (m.action_type === 'PIN') {
          return `${index}. *Pin/Unpin* announcement`;
        }
        if (m.action_type === 'DELETE') {
          return `${index}. *${action} ${domain}* (archived)`;
        }
        return `${index}. *${action} ${domain}* (updated)`;
      }
      default:
        return `${index}. *${action} ${domain}*`;
    }
  } catch {
    return `${index}. *${action} ${domain}*`;
  }
}

export async function formatDiffReceipt(
  branchId: string,
  branchName: string,
  db: D1Database,
): Promise<string> {
  const mutations = await getMutations(branchId, db);
  const count = mutations.length;

  if (count === 0) {
    return [
      '*No changes were made in this session.*',
      '',
      'Send me details of what you\'d like to change — prayer times, announcements, theme, or masjid profile.',
    ].join('\n');
  }

  const lines = [
    '*Changes Applied*',
    `_Session: ${branchName}_`,
    '',
  ];

  for (let i = 0; i < mutations.length; i++) {
    const m = mutations[i];
    if (!m) continue;
    lines.push(formatMutation(m, i + 1));
    lines.push('');
  }

  lines.push(`_${count} change${count !== 1 ? 's' : ''} total_`);
  lines.push('');
  lines.push('Type */confirm* to finalize these changes, or */cancel* to discard them.');

  return lines.join('\n');
}

export function buildNoChangesMessage(): string {
  return [
    '*No changes detected*',
    '',
    'I couldn\'t determine what you wanted to change. Try being more specific, or use `/help` to see available commands.',
  ].join('\n');
}

export function buildConfirmSuccessMessage(
  branchName: string,
  mutationCount: number,
): string {
  return [
    `*Changes finalized!*`,
    '',
    `${mutationCount} change${mutationCount !== 1 ? 's' : ''} from session "${branchName}" have been saved.`,
    '',
    'Your masjid\'s public pages will update immediately.',
  ].join('\n');
}

export function buildErrorSummary(mutationResults: string[]): string {
  const lines = ['*Some changes failed*', ''];
  for (const err of mutationResults) {
    lines.push(`• ${err}`);
  }
  return lines.join('\n');
}
