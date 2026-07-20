import type { Env } from './types';

const WHATSAPP_API_BASE = 'https://graph.facebook.com/v22.0';

export async function sendReply(
  to: string,
  text: string,
  env: Env,
): Promise<void> {
  const url = `${WHATSAPP_API_BASE}/${env.WHATSAPP_PHONE_ID}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`WhatsApp API error (${response.status}): ${errorText}`);
  }
}

export async function sendMediaReply(
  to: string,
  mediaId: string,
  caption: string | null,
  env: Env,
): Promise<void> {
  const url = `${WHATSAPP_API_BASE}/${env.WHATSAPP_PHONE_ID}/messages`;

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { id: mediaId },
  };

  if (caption) {
    (body.image as Record<string, string>).caption = caption;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`WhatsApp API error (${response.status}): ${errorText}`);
  }
}

export function buildHelpMessage(): string {
  return [
    '*Masjid Platform — Zero-UI Admin*',
    '',
    'Send me any text to start configuring your masjid.',
    'I can help with prayer times, announcements, themes, and more.',
    '',
    'Commands:',
    '• `/help` — show this message',
    '• `/status` — view your current configuration',
    '• `/cancel` — discard pending changes',
    '• `/confirm` — apply pending changes (future)',
  ].join('\n');
}

export function buildSessionSummary(
  branchName: string,
  createdAt: string,
  messageCount: number,
): string {
  return [
    `*Active Session: ${branchName}*`,
    `Created: ${new Date(createdAt).toLocaleString()}`,
    `Messages in this session: ${messageCount}`,
    '',
    'What would you like to change?',
  ].join('\n');
}