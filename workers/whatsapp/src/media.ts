import type { Env } from './types';

const WHATSAPP_API_BASE = 'https://graph.facebook.com/v22.0';

export function bufferToDataUri(buffer: ArrayBuffer, contentType: string): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:${contentType};base64,${base64}`;
}

export async function downloadWhatsAppMedia(
  mediaId: string,
  env: Env,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const urlResponse = await fetch(
    `${WHATSAPP_API_BASE}/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
    },
  );

  if (!urlResponse.ok) {
    throw new Error(`Failed to get media URL: ${urlResponse.status}`);
  }

  const mediaInfo = await urlResponse.json() as { url: string; mime_type: string };

  const downloadResponse = await fetch(mediaInfo.url, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
  });

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download media: ${downloadResponse.status}`);
  }

  const buffer = await downloadResponse.arrayBuffer();

  return { buffer, contentType: mediaInfo.mime_type || 'application/octet-stream' };
}

export async function uploadToR2(
  buffer: ArrayBuffer,
  key: string,
  contentType: string,
  env: Env,
): Promise<void> {
  await env.ASSETS.put(key, buffer, {
    httpMetadata: { contentType },
  });
}

export async function registerAsset(
  masjidId: string,
  associatedDomain: string,
  r2Key: string,
  publicUrl: string,
  contentType: string,
  fileSize: number,
  db: D1Database,
): Promise<string> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      'INSERT INTO masjid_assets (id, masjid_id, associated_domain, r2_key, public_url, content_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, masjidId, associatedDomain, r2Key, publicUrl, contentType, fileSize)
    .run();

  return id;
}