import type { Env, ParsedWhatsAppMessage } from './types';

export function handleWebhookVerify(url: URL, env: Env): Response {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

export function parseWebhookEntries(body: Record<string, unknown>): ParsedWhatsAppMessage[] {
  const messages: ParsedWhatsAppMessage[] = [];

  if (body.object !== 'whatsapp_business_account') return messages;

  const entries = body.entry as Array<Record<string, unknown>> | undefined;
  if (!entries) return messages;

  for (const entry of entries) {
    const changes = entry.changes as Array<Record<string, unknown>> | undefined;
    if (!changes) continue;

    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      if (!value || value.messaging_product !== 'whatsapp') continue;

      const metadata = value.metadata as Record<string, string> | undefined;
      if (!metadata) continue;

      const msgList = value.messages as Array<Record<string, unknown>> | undefined;
      if (!msgList) continue;

      for (const msg of msgList) {
        const parsed = parseSingleMessage(msg);
        if (parsed) messages.push(parsed);
      }
    }
  }

  return messages;
}

function parseSingleMessage(msg: Record<string, unknown>): ParsedWhatsAppMessage | null {
  const type = msg.type as string | undefined;
  const from = msg.from as string | undefined;
  const id = msg.id as string | undefined;
  const timestamp = msg.timestamp as string | undefined;

  if (!type || !from || !id) return null;

  const base: Omit<ParsedWhatsAppMessage, 'type'> = {
    from,
    id,
    timestamp: timestamp || new Date().toISOString(),
  };

  switch (type) {
    case 'text': {
      const text = msg.text as Record<string, string> | undefined;
      return { ...base, type: 'text', body: text?.body || '' };
    }
    case 'image': {
      const image = msg.image as Record<string, string> | undefined;
      return {
        ...base,
        type: 'image',
        mediaId: image?.id,
        mediaMimeType: image?.mime_type,
      };
    }
    case 'audio': {
      const audio = msg.audio as Record<string, string> | undefined;
      return {
        ...base,
        type: 'audio',
        mediaId: audio?.id,
        mediaMimeType: audio?.mime_type,
      };
    }
    case 'video': {
      const video = msg.video as Record<string, string> | undefined;
      return {
        ...base,
        type: 'video',
        mediaId: video?.id,
        mediaMimeType: video?.mime_type,
      };
    }
    case 'document': {
      const document = msg.document as Record<string, string> | undefined;
      return {
        ...base,
        type: 'document',
        mediaId: document?.id,
        mediaMimeType: document?.mime_type,
        mediaFilename: document?.filename,
      };
    }
    default:
      return null;
  }
}