import type { MutationRecord, DiffReceipt, MutationData } from './types';
import { getMutations } from './session';

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function parseMutationPayload(m: MutationRecord): MutationData {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(m.payload_json);
  } catch { /* use empty object */ }

  const summary = buildMutationSummary(m.domain, m.action_type, payload);

  return {
    domain: m.domain,
    action: m.action_type,
    entityKey: m.target_key,
    summary,
    payload,
  };
}

function buildMutationSummary(domain: string, action: string, payload: Record<string, unknown>): string {
  switch (domain) {
    case 'THEME': {
      const changes = Object.keys(payload)
        .filter(k => !['masjid_id'].includes(k))
        .map(k => `${k}: ${truncate(String(payload[k]), 30)}`);
      return changes.length ? changes.join(', ') : 'Theme updated';
    }
    case 'PROFILE': {
      const changes = Object.keys(payload)
        .filter(k => !['masjid_id'].includes(k))
        .map(k => `${k}: ${truncate(String(payload[k]), 30)}`);
      return changes.length ? changes.join(', ') : 'Profile updated';
    }
    case 'PRAYER_RULES': {
      if (action === 'CREATE') {
        const rule = payload;
        return `${rule.rule_name || 'untitled'} (${rule.prayer_name || '?'})`;
      }
      if (action === 'REORDER') return 'Reordered';
      if (action === 'DELETE') return 'Deleted';
      return 'Updated';
    }
    case 'JUMUAH': {
      if (action === 'CREATE') {
        const speech = payload.speech_time ? `, Speech: ${payload.speech_time}` : '';
        return `Khutbah: ${payload.time || '?'}${speech}`;
      }
      if (action === 'DELETE') return 'Deleted';
      return 'Updated';
    }
    case 'ANNOUNCEMENTS': {
      if (action === 'CREATE') {
        return truncate(payload.title as string || '?', 40);
      }
      if (action === 'PIN') return 'Pin/Unpin';
      if (action === 'DELETE') return 'Archived';
      return 'Updated';
    }
    default:
      return `${action}`;
  }
}

export async function buildDiffReceipt(
  branchId: string,
  branchName: string,
  db: D1Database,
): Promise<DiffReceipt> {
  const mutations = await getMutations(branchId, db);

  if (mutations.length === 0) {
    return {
      branchName,
      mutations: [],
      totalCount: 0,
      textResponse: null,
    };
  }

  const parsed = mutations.map((m, i) => parseMutationPayload(m));

  return {
    branchName,
    mutations: parsed,
    totalCount: mutations.length,
    textResponse: null,
  };
}

export function buildNoChangesResult(): DiffReceipt {
  return {
    branchName: '',
    mutations: [],
    totalCount: 0,
    textResponse: null,
  };
}

export function buildConfirmSuccessMessage(branchName: string, mutationCount: number): string {
  const s = mutationCount !== 1 ? 's' : '';
  return `Changes finalized! ${mutationCount} change${s} from session "${branchName}" have been saved. Your masjid's public pages will update immediately.`;
}

export function buildErrorSummary(mutationResults: string[]): string {
  const lines = ['Some changes failed:'];
  for (const err of mutationResults) {
    lines.push(`- ${err}`);
  }
  return lines.join('\n');
}
