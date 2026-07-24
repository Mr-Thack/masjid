import type { Env } from './types';
import {
  bufferToDataUri as coreBufferToDataUri,
  uploadToR2 as coreUploadToR2,
  registerAsset as coreRegisterAsset,
} from '@masjid/agent';

const WHATSAPP_API_BASE = 'https://graph.facebook.com/v22.0';

export const bufferToDataUri = coreBufferToDataUri;

export async function uploadToR2(
  buffer: ArrayBuffer,
  key: string,
  contentType: string,
  env: Env,
): Promise<void> {
  return coreUploadToR2(buffer, key, contentType, env.ASSETS);
}

export const registerAsset = coreRegisterAsset;

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
