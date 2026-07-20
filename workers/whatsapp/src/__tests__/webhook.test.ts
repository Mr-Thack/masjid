import { describe, it, expect } from 'vitest';
import { handleWebhookVerify, parseWebhookEntries } from '../webhook';
import type { Env } from '../types';

const testEnv: Env = {
  DB: {} as D1Database,
  ASSETS: {} as R2Bucket,
  API_URL: 'http://localhost:5173',
  JWT_SECRET: 'secret',
  WHATSAPP_TOKEN: 'token',
  WHATSAPP_PHONE_ID: 'phone-id',
  WHATSAPP_VERIFY_TOKEN: 'my-verify-token',
};

describe('handleWebhookVerify', () => {
  it('returns challenge when mode=subscribe and token matches', async () => {
    const url = new URL('https://example.com/webhook?hub.mode=subscribe&hub.verify_token=my-verify-token&hub.challenge=abc123');
    const response = handleWebhookVerify(url, testEnv);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe('abc123');
  });

  it('returns 403 when mode is not subscribe', () => {
    const url = new URL('https://example.com/webhook?hub.mode=invalid&hub.verify_token=my-verify-token&hub.challenge=abc');
    const response = handleWebhookVerify(url, testEnv);
    expect(response.status).toBe(403);
  });

  it('returns 403 when token does not match', () => {
    const url = new URL('https://example.com/webhook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=abc');
    const response = handleWebhookVerify(url, testEnv);
    expect(response.status).toBe(403);
  });

  it('returns 403 when challenge is missing', () => {
    const url = new URL('https://example.com/webhook?hub.mode=subscribe&hub.verify_token=my-verify-token');
    const response = handleWebhookVerify(url, testEnv);
    expect(response.status).toBe(403);
  });
});

describe('parseWebhookEntries', () => {
  it('returns empty array when object is not whatsapp_business_account', () => {
    const body = { object: 'something_else' };
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('returns empty array when body has no entry', () => {
    const body = { object: 'whatsapp_business_account' };
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('returns empty array when entry has no changes', () => {
    const body = { object: 'whatsapp_business_account', entry: [{ id: '1' }] };
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('returns empty array when messaging_product is not whatsapp', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '1',
        changes: [{ value: { messaging_product: 'something_else' } }],
      }],
    };
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('returns empty array when no metadata', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '1',
        changes: [{ value: { messaging_product: 'whatsapp' } }],
      }],
    };
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('returns empty array when no messages', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '1',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '123', phone_number_id: '456' },
          },
        }],
      }],
    };
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('parses a text message', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'entry-1',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '123', phone_number_id: '456' },
            messages: [{
              from: '15550000001',
              id: 'msg-1',
              timestamp: '1234567890',
              type: 'text',
              text: { body: 'Hello world' },
            }],
          },
        }],
      }],
    };
    const messages = parseWebhookEntries(body);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      from: '15550000001',
      id: 'msg-1',
      type: 'text',
      body: 'Hello world',
    });
  });

  it('parses text message with empty body', () => {
    const body = buildMsg('text', 'from-1', 'msg-1', { body: '' });
    const messages = parseWebhookEntries(body);
    expect(messages[0]?.body).toBe('');
  });

  it('parses an image message', () => {
    const body = buildMediaMsg('image', { id: 'media-1', mime_type: 'image/jpeg' });
    const messages = parseWebhookEntries(body);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: 'image',
      mediaId: 'media-1',
      mediaMimeType: 'image/jpeg',
    });
  });

  it('parses an audio message', () => {
    const body = buildMediaMsg('audio', { id: 'audio-1', mime_type: 'audio/ogg' });
    const messages = parseWebhookEntries(body);
    expect(messages[0]).toMatchObject({
      type: 'audio',
      mediaId: 'audio-1',
    });
  });

  it('parses a video message', () => {
    const body = buildMediaMsg('video', { id: 'video-1', mime_type: 'video/mp4' });
    const messages = parseWebhookEntries(body);
    expect(messages[0]).toMatchObject({
      type: 'video',
      mediaId: 'video-1',
    });
  });

  it('parses a document message with filename', () => {
    const body = buildMediaMsg('document', { id: 'doc-1', mime_type: 'application/pdf', filename: 'timetable.pdf' });
    const messages = parseWebhookEntries(body);
    expect(messages[0]).toMatchObject({
      type: 'document',
      mediaId: 'doc-1',
      mediaFilename: 'timetable.pdf',
    });
  });

  it('skips messages with missing type', () => {
    const body = buildBody({ from: '123', id: 'msg-1' });
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('skips messages with missing from', () => {
    const body = buildBody({ type: 'text', id: 'msg-1', text: { body: 'hi' } });
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('skips messages with missing id', () => {
    const body = buildBody({ type: 'text', from: '123', text: { body: 'hi' } });
    expect(parseWebhookEntries(body)).toEqual([]);
  });

  it('handles multiple messages in one change', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'e1',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '123', phone_number_id: '456' },
            messages: [
              { from: '123', id: 'm1', type: 'text', text: { body: 'first' } },
              { from: '456', id: 'm2', type: 'text', text: { body: 'second' } },
            ],
          },
        }],
      }],
    };
    const messages = parseWebhookEntries(body);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.body).toBe('first');
    expect(messages[1]?.body).toBe('second');
  });

  it('handles entries without timestamp gracefully', () => {
    const body = buildBody({ type: 'text', from: '123', id: 'm1', text: { body: 'hi' } });
    const messages = parseWebhookEntries(body);
    expect(messages[0]?.timestamp).toBeDefined();
  });
});

function buildBody(msg: Record<string, unknown>): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'entry-1',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '123', phone_number_id: '456' },
          messages: [msg],
        },
      }],
    }],
  };
}

function buildMsg(type: string, from: string, id: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return buildBody({ from, id, type, timestamp: '123', ...extras });
}

function buildMediaMsg(type: string, media: Record<string, unknown>): Record<string, unknown> {
  const msg: Record<string, unknown> = { from: 'test-from', id: 'test-id', type, timestamp: '123' };
  msg[type] = media;
  return buildBody(msg);
}
