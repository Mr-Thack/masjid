export function bufferToDataUri(buffer: ArrayBuffer, contentType: string): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:${contentType};base64,${base64}`;
}

export async function uploadToR2(
  buffer: ArrayBuffer,
  key: string,
  contentType: string,
  assets: R2Bucket,
): Promise<void> {
  await assets.put(key, buffer, {
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
