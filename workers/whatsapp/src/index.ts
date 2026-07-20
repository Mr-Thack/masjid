import type { Env, ParsedWhatsAppMessage } from './types';
import { handleWebhookVerify, parseWebhookEntries } from './webhook';
import {
  resolveTenant,
  getOpenBranch,
  createBranch,
  touchBranch,
  abandonBranch,
  abandonExpiredBranches,
  getBranchTimeoutWarning,
  listBranches,
} from './session';
import { sendReply, buildHelpMessage, buildSessionSummary } from './messaging';
import {
  downloadWhatsAppMedia,
  uploadToR2,
  registerAsset,
} from './media';

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

  if (lower === '/status' || lower === 'status') {
    await handleStatus(msg.from, admin.id, admin.masjid_id, env);
    return;
  }

  if (lower === '/confirm' || lower === 'confirm') {
    await sendReply(
      msg.from,
      'The confirm feature is not yet available. Your changes are being tracked and will be applied once you confirm.\n\nFor now, the WhatsApp admin only records your intent — LLM-powered processing is coming in the next update.',
      env,
    );
    return;
  }

  if (!branch) {
    branch = await createBranch(admin.id, admin.masjid_id, env.DB);
    await sendReply(
      msg.from,
      `*New Configuration Session Started*\n\n${buildSessionSummary(branch.branch_name, branch.created_at, 1)}\n\nSend me details of what you'd like to change — prayer times, announcements, colors, Jumu'ah times, etc.`,
      env,
    );
    return;
  }

  const timeoutWarning = await getBranchTimeoutWarning(branch.id, env.DB);

  await touchBranch(branch.id, env.DB);

  await sendReply(
    msg.from,
    [
      buildSessionSummary(branch.branch_name, branch.created_at, 0),
      `*Last message:* "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`,
      '',
      "I've recorded your message. Send more details or use `/status` to see your session. LLM-powered processing is coming soon.",
      timeoutWarning
        ? '\n_Note: Your session is about to expire. Reply to keep it active._'
        : '',
    ].join('\n'),
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
    const r2Key = `masjids/${masjidId}/inbox/${crypto.randomUUID()}.${ext}`;
    const publicUrl = `https://cdn.example.com/${r2Key}`;

    await uploadToR2(buffer, r2Key, contentType, env);

    const domain =
      msg.type === 'document' ? 'ANNOUNCEMENTS' :
      msg.type === 'image' && msg.mediaMimeType?.startsWith('image/') ? 'TIMETABLE_PARSER' : 'ANNOUNCEMENTS';

    await registerAsset(
      masjidId,
      domain,
      r2Key,
      publicUrl,
      contentType,
      buffer.byteLength,
      env.DB,
    );

    await sendReply(
      msg.from,
      [
        "I've received your media file.",
        `Type: ${msg.type} (${contentType})`,
        msg.mediaFilename ? `File: ${msg.mediaFilename}` : '',
        '',
        'Image and document processing (OCR, timetable parsing) will be available in a future update.',
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