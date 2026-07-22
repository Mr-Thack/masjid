import type { Env, ParsedWhatsAppMessage } from './types';
import { handleWebhookVerify, parseWebhookEntries } from './webhook';
import {
  resolveTenant,
  getOpenBranch,
  createBranch,
  touchBranch,
  abandonBranch,
  abandonExpiredBranches,
  getMutationCount,
  mergeBranch,
  listBranches,
} from './session';
import { sendReply, buildHelpMessage } from './messaging';
import {
  downloadWhatsAppMedia,
  uploadToR2,
  registerAsset,
  bufferToDataUri,
} from './media';
import { runAgent } from './agent/runner';
import { runVisionAgent } from './agent/runner';
import { formatDiffReceipt, buildConfirmSuccessMessage } from './agent/format';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      return handleWebhookVerify(url, env);
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json() as Record<string, unknown>;
        const messages = parseWebhookEntries(body);

        for (const msg of messages) {
          ctx.waitUntil(processMessage(msg, env, ctx));
        }

        return new Response('ok', { status: 200 });
      } catch (err) {
        console.error('Webhook processing error:', err);
        return new Response('internal error', { status: 500 });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(abandonExpiredBranches(env.DB));
  },
};

async function processMessage(
  msg: ParsedWhatsAppMessage,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const admin = await resolveTenant(msg.from, env.DB);

  if (!admin) {
    await sendReply(
      msg.from,
      "Assalamu Alaikum! This WhatsApp number is not registered as a masjid admin. Please ask your masjid administrator to add your phone number.\n\nIf you need help, reply 'help'.",
      env,
    );
    return;
  }

  await abandonExpiredBranches(env.DB);

  if (msg.type !== 'text' || !msg.body) {
    await handleMediaMessage(msg, admin.id, admin.masjid_id, env);
    return;
  }

  const text = msg.body.trim();
  const lower = text.toLowerCase();

  if (lower === '/help' || lower === 'help') {
    await sendReply(msg.from, buildHelpMessage(), env);
    return;
  }

  if (lower === '/status' || lower === 'status') {
    await handleStatus(msg.from, admin.id, admin.masjid_id, env);
    return;
  }

  let branch = await getOpenBranch(admin.id, admin.masjid_id, env.DB);

  if (lower === '/cancel' || lower === 'cancel') {
    if (branch) {
      await abandonBranch(branch.id, env.DB);
      await sendReply(msg.from, 'Your pending changes have been discarded. Start a new message when you\'re ready.', env);
    } else {
      await sendReply(msg.from, 'No active session to cancel.', env);
    }
    return;
  }

  if (lower === '/confirm' || lower === 'confirm') {
    await handleConfirm(msg.from, admin.id, admin.masjid_id, env, branch);
    return;
  }

  if (!branch) {
    branch = await createBranch(admin.id, admin.masjid_id, env.DB);
    await sendReply(
      msg.from,
      [
        '*New Configuration Session Started*',
        `_Session: ${branch.branch_name}_`,
        '',
        "I'll process your request now...",
      ].join('\n'),
      env,
    );
  } else {
    await touchBranch(branch.id, env.DB);
  }

  const response = await runAgent(text, admin, env, branch.id);

  const diffReceipt = await formatDiffReceipt(branch.id, branch.branch_name, env.DB);
  const mutationCount = await getMutationCount(branch.id, env.DB);

  if (mutationCount > 0 && !response.includes('Type */confirm*')) {
    await sendReply(msg.from, response + '\n\n' + diffReceipt, env);
  } else {
    await sendReply(msg.from, response, env);
  }
}

async function handleConfirm(
  phone: string,
  adminId: string,
  masjidId: string,
  env: Env,
  branch: { id: string; branch_name: string } | null,
): Promise<void> {
  if (!branch) {
    await sendReply(phone, 'No active session to confirm. Send a message to start a new configuration session.', env);
    return;
  }

  const mutationCount = await getMutationCount(branch.id, env.DB);

  if (mutationCount === 0) {
    await sendReply(phone, 'No pending changes to confirm in this session.', env);
    return;
  }

  const summary = `WhatsApp session ${branch.branch_name}: ${mutationCount} change${mutationCount !== 1 ? 's' : ''}`;
  await mergeBranch(branch.id, summary, masjidId, env.DB);

  await sendReply(
    phone,
    buildConfirmSuccessMessage(branch.branch_name, mutationCount),
    env,
  );
}

async function handleMediaMessage(
  msg: ParsedWhatsAppMessage,
  adminId: string,
  masjidId: string,
  env: Env,
): Promise<void> {
  if (!msg.mediaId) {
    await sendReply(msg.from, "I couldn't process this media. Please try sending it again.", env);
    return;
  }

  try {
    const { buffer, contentType } = await downloadWhatsAppMedia(msg.mediaId, env);

    const ext = contentType.split('/')[1] || 'bin';
    const cdnBase = env.CDN_BASE_URL || 'https://cdn.example.com';
    const r2Key = `masjids/${masjidId}/inbox/${crypto.randomUUID()}.${ext}`;
    const publicUrl = `${cdnBase}/${r2Key}`;

    await uploadToR2(buffer, r2Key, contentType, env);

    const isImage = contentType.startsWith('image/');
    const isDocument = msg.type === 'document';
    const isSpreadsheet = isDocument && (
      contentType.includes('spreadsheet') ||
      contentType.includes('excel') ||
      contentType.includes('csv') ||
      msg.mediaMimeType?.includes('spreadsheet') ||
      msg.mediaMimeType?.includes('excel') ||
      msg.mediaMimeType?.includes('csv') ||
      msg.mediaFilename?.endsWith('.csv') ||
      msg.mediaFilename?.endsWith('.xlsx')
    );

    const domain = isImage ? 'TIMETABLE_PARSER' : 'ANNOUNCEMENTS';

    await registerAsset(
      masjidId,
      domain,
      r2Key,
      publicUrl,
      contentType,
      buffer.byteLength,
      env.DB,
    );

    const admin = await resolveTenant(msg.from, env.DB);
    if (!admin) {
      await sendReply(msg.from, "I've saved your file but couldn't process it further.", env);
      return;
    }

    let branch = await getOpenBranch(adminId, masjidId, env.DB);
    if (!branch) {
      branch = await createBranch(adminId, masjidId, env.DB);
    } else {
      await touchBranch(branch.id, env.DB);
    }

    if (isImage) {
      const dataUri = bufferToDataUri(buffer, contentType);
      const response = await runVisionAgent(dataUri, contentType, admin, env, branch.id);

      const diffReceipt = await formatDiffReceipt(branch.id, branch.branch_name, env.DB);
      const mutationCount = await getMutationCount(branch.id, env.DB);

      if (mutationCount > 0 && !response.includes('Type */confirm*')) {
        await sendReply(msg.from, response + '\n\n' + diffReceipt, env);
      } else {
        await sendReply(msg.from, response, env);
      }
      return;
    }

    if (isSpreadsheet) {
      const text = new TextDecoder().decode(buffer);
      const preview = text.slice(0, 500);
      await sendReply(
        msg.from,
        [
          '*Spreadsheet received*',
          `File: ${msg.mediaFilename || 'unnamed'} (${contentType})`,
          '',
          'CSV data preview:',
          '```',
          preview,
          text.length > 500 ? '...' : '',
          '```',
          '',
          'Processing spreadsheet data for timetable extraction...',
        ].join('\n'),
        env,
      );

      const response = await runAgent(
        `Parse this CSV/tabular prayer timetable data and create prayer rules:\n\n${text}`,
        admin,
        env,
        branch.id,
      );

      const diffReceipt = await formatDiffReceipt(branch.id, branch.branch_name, env.DB);
      const mutationCount = await getMutationCount(branch.id, env.DB);

      if (mutationCount > 0 && !response.includes('Type */confirm*')) {
        await sendReply(msg.from, response + '\n\n' + diffReceipt, env);
      } else {
        await sendReply(msg.from, response, env);
      }
      return;
    }

    await sendReply(
      msg.from,
      [
        "I've received your file.",
        `Type: ${msg.type} (${contentType})`,
        msg.mediaFilename ? `File: ${msg.mediaFilename}` : '',
        '',
        'This file type will be processed in a future update (PDF/DOCX parsing coming soon).',
      ]
        .filter(Boolean)
        .join('\n'),
      env,
    );
  } catch (err) {
    console.error('Media processing error:', err);
    await sendReply(msg.from, "Sorry, I couldn't process that media file. Please try sending it again.", env);
  }
}

async function handleStatus(
  phone: string,
  adminId: string,
  masjidId: string,
  env: Env,
): Promise<void> {
  const branches = await listBranches(masjidId, env.DB);

  if (branches.length === 0) {
    await sendReply(phone, '*No active sessions.*\n\nSend a message to start a new configuration session.', env);
    return;
  }

  const lines = ['*Your Sessions*', ''];

  for (const b of branches) {
    const icon = b.status === 'OPEN' ? '🟢' : b.status === 'MERGED' ? '✅' : '⚫';
    lines.push(`${icon} *${b.branch_name}* — ${b.status}`);
    lines.push(`  Updated: ${new Date(b.updated_at).toLocaleString()}`);
    lines.push('');
  }

  await sendReply(phone, lines.join('\n'), env);
}