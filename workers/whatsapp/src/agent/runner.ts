import type { Env, AdminRecord } from '../types';
import type { BotContext } from '@masjid/agent';
import {
  runAgent as coreRunAgent,
  runVisionAgent as coreRunVisionAgent,
  buildDiffReceipt,
  type DiffReceipt,
  type MutationData,
} from '@masjid/agent';
import { getMutationCount } from '../session';

function toBotContext(env: Env, adminId: string, masjidId: string, branchId: string, branchName: string): BotContext {
  return {
    adminId,
    masjidId,
    branchId,
    branchName,
    db: env.DB,
    apiUrl: env.API_URL,
    jwtSecret: env.JWT_SECRET,
    llmConfig: {
      url: env.LLM_API_URL || 'https://openrouter.ai/api/v1',
      key: env.LLM_API_KEY || '',
      model: env.LLM_MODEL || 'google/gemma-4-31b-it',
    },
    assets: env.ASSETS,
    cdnBaseUrl: env.CDN_BASE_URL,
  };
}

export async function runVisionAgent(
  dataUri: string,
  contentType: string,
  admin: AdminRecord,
  env: Env,
  branchId: string,
): Promise<string> {
  const ctx = toBotContext(env, admin.id, admin.masjid_id, branchId, `whatsapp-${new Date().toISOString().slice(0, 10)}`);

  if (!env.LLM_API_KEY) {
    return [
      '*Image received*',
      '',
      'I received your image but LLM-powered processing is not configured (LLM_API_KEY not set).',
      'Your admin needs to add an LLM_API_KEY environment variable.',
    ].join('\n');
  }

  try {
    const result = await coreRunVisionAgent(dataUri, contentType, admin, ctx);

    const textResponse = result.textResponse ? formatAsWhatsApp(result.textResponse) : '';

    if (result.diffReceipt && result.diffReceipt.totalCount > 0) {
      const whatsappDiff = formatDiffReceiptAsWhatsApp(result.diffReceipt);
      return [textResponse || '*Prayer rules extracted from timetable.*', '', whatsappDiff].join('\n');
    }

    return textResponse || 'I analyzed the image but could not extract any prayer rules. Please try sending a clearer photo of the timetable.';
  } catch (err) {
    console.error('Vision agent error:', err);
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('LLM_API_KEY not configured')) {
      return [
        '*Image received*',
        '',
        'I received your image but LLM-powered processing is not configured.',
      ].join('\n');
    }

    return [
      '*Image processing failed*',
      '',
      'I encountered an error while analyzing the image. Please try again.',
    ].join('\n');
  }
}

export async function runAgent(
  userMessage: string,
  admin: AdminRecord,
  env: Env,
  branchId: string,
): Promise<string> {
  const ctx = toBotContext(env, admin.id, admin.masjid_id, branchId, `whatsapp-${new Date().toISOString().slice(0, 10)}`);

  if (!env.LLM_API_KEY) {
    return buildFallbackResponse(userMessage, branchId, env);
  }

  try {
    const result = await coreRunAgent(userMessage, admin, ctx);

    const textResponse = result.textResponse ? formatAsWhatsApp(result.textResponse) : '';

    if (result.diffReceipt && result.diffReceipt.totalCount > 0) {
      const whatsappDiff = formatDiffReceiptAsWhatsApp(result.diffReceipt);
      return [textResponse || '*Changes have been prepared.*', '', whatsappDiff].join('\n');
    }

    return textResponse || formatNoChangesMessage();
  } catch (err) {
    console.error('Agent error:', err);
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('LLM_API_KEY not configured')) {
      return buildFallbackResponse(userMessage, branchId, env);
    }

    return [
      '*Something went wrong*',
      '',
      'I encountered an error while processing your request. Please try again or use `/help` for available commands.',
    ].join('\n');
  }
}

function formatAsWhatsApp(text: string): string {
  return text;
}

function formatDiffReceiptAsWhatsApp(diff: DiffReceipt): string {
  if (diff.totalCount === 0) {
    return [
      '*No changes were made in this session.*',
      '',
      'Send me details of what you\'d like to change — prayer times, announcements, theme, or masjid profile.',
    ].join('\n');
  }

  const lines = [
    '*Changes Applied*',
    `_Session: ${diff.branchName}_`,
    '',
  ];

  for (let i = 0; i < diff.mutations.length; i++) {
    const m = diff.mutations[i]!;
    lines.push(formatMutationAsWhatsApp(m, i + 1));
    lines.push('');
  }

  lines.push(`_${diff.totalCount} change${diff.totalCount !== 1 ? 's' : ''} total_`);
  lines.push('');
  lines.push('Type */confirm* to finalize these changes, or */cancel* to discard them.');

  return lines.join('\n');
}

function formatMutationAsWhatsApp(m: MutationData, index: number): string {
  const action = m.action === 'CREATE' ? '+' : m.action === 'DELETE' ? '-' : '~';
  const domain = domainLabel(m.domain);
  const bullet = `*${action} ${domain}*`;

  switch (m.domain) {
    case 'THEME':
    case 'PROFILE': {
      const changes = Object.keys(m.payload)
        .filter(k => !['masjid_id'].includes(k))
        .map(k => `  ${k}: ${truncate(String(m.payload[k]), 30)}`);
      return `${index}. ${bullet} ${changes.length ? '\n' + changes.join('\n') : ''}`;
    }
    case 'PRAYER_RULES': {
      if (m.action === 'CREATE') {
        return `${index}. ${bullet}\n  Rule: ${m.payload.rule_name || 'untitled'}\n  Prayer: ${m.payload.prayer_name || '?'}`;
      }
      if (m.action === 'REORDER') return `${index}. *~ Reorder ${domain}*`;
      if (m.action === 'DELETE') return `${index}. *${action} ${domain}* (rule deleted)`;
      return `${index}. *${action} ${domain}* (rule updated)`;
    }
    case 'JUMUAH': {
      if (m.action === 'CREATE') {
        const speech = m.payload.speech_time ? `\n  Speech: ${m.payload.speech_time}` : '';
        return `${index}. ${bullet}\n  Khutbah: ${m.payload.time || '?'}${speech}`;
      }
      if (m.action === 'DELETE') return `${index}. *${action} ${domain}* (session deleted)`;
      return `${index}. *${action} ${domain}* (session updated)`;
    }
    case 'ANNOUNCEMENTS': {
      if (m.action === 'CREATE') return `${index}. ${bullet}\n  Title: ${truncate(m.payload.title as string || '?', 40)}`;
      if (m.action === 'PIN') return `${index}. *Pin/Unpin* announcement`;
      if (m.action === 'DELETE') return `${index}. *${action} ${domain}* (archived)`;
      return `${index}. *${action} ${domain}* (updated)`;
    }
case 'POSTS': {
      if (m.action === 'CREATE') return `${index}. ${bullet}\n  Title: ${truncate(m.payload.title as string || '?', 40)}`;
      if (m.action === 'PIN_HOMEPAGE') return `${index}. *Toggle homepage pin* for post`;
      if (m.action === 'PIN_INFO') return `${index}. *Toggle info pin* for post`;
      if (m.action === 'DELETE') return `${index}. *${action} ${domain}* (deleted)`;
      return `${index}. *${action} ${domain}* (updated)`;
    }
    case 'TIMETABLE_IMPORT': {
      const ruleCount = m.payload.rules ? (Array.isArray(m.payload.rules) ? m.payload.rules.length : String(m.payload.rules)) : '?';
      const del = m.payload.deleted;
      const parts = [`${index}. *+ Imported ${ruleCount} rule(s)*`];
      if (del) parts.push(`  Deleted ${del} existing rule(s)`);
      return parts.join('\n');
    }
    default:
      return `${index}. *${action} ${m.domain}*`;
  }
}

function domainLabel(domain: string): string {
  const labels: Record<string, string> = {
    THEME: 'Theme',
    PROFILE: 'Profile',
    PRAYER_RULES: 'Prayer Rules',
    JUMUAH: "Jumu'ah",
    ANNOUNCEMENTS: 'Announcements',
    POSTS: 'Posts',
    TIMETABLE_IMPORT: 'Timetable Import',
  };
  return labels[domain] || domain;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function formatNoChangesMessage(): string {
  return [
    '*No changes detected*',
    '',
    'I couldn\'t determine what you wanted to change. Try being more specific, or use `/help` to see available commands.',
  ].join('\n');
}

async function buildFallbackResponse(
  _userMessage: string,
  branchId: string,
  env: Env,
): Promise<string> {
  return [
    '*Message received*',
    '',
    'I\'ve noted your request. LLM-powered processing is not yet configured (LLM_API_KEY not set).',
    '',
    'Available commands:',
    '• `/help` — show available commands',
    '• `/status` — view your session history',
    '• `/cancel` — discard this session',
    '',
    'Your admin will need to add an LLM_API_KEY environment variable to enable automatic configuration.',
  ].join('\n');
}