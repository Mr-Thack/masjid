interface CachedTimes {
  date: string;
  masjid: { slug: string; name: string };
  calculation_method: string;
  times: Record<string, unknown>;
}

function getKey(masjidId: string, date: string): string {
  return `prayer:${masjidId}:${date}`;
}

export async function getCachedTimes(
  cache: KVNamespace | undefined,
  masjidId: string,
  date: string,
): Promise<CachedTimes | null> {
  if (!cache) return null;
  try {
    const raw = await cache.get(getKey(masjidId, date));
    if (!raw) return null;
    return JSON.parse(raw) as CachedTimes;
  } catch {
    return null;
  }
}

export async function setCachedTimes(
  cache: KVNamespace | undefined,
  masjidId: string,
  date: string,
  data: CachedTimes,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(getKey(masjidId, date), JSON.stringify(data), { expirationTtl: 60 * 60 * 25 });
  } catch {
  }
}

export async function invalidateMasjidCache(
  cache: KVNamespace | undefined,
  masjidId: string,
): Promise<void> {
  if (!cache) return;
  try {
    const prefix = `prayer:${masjidId}:`;
    const list = await cache.list({ prefix });
    const keys = list.keys.map((k) => k.name);
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => cache.delete(key)));
    }
  } catch {
  }
}

export async function getCachedPagePayload(
  cache: KVNamespace | undefined,
  slug: string,
): Promise<unknown | null> {
  if (!cache) return null;
  try {
    const raw = await cache.get(`page:${slug}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setCachedPagePayload(
  cache: KVNamespace | undefined,
  slug: string,
  data: unknown,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(`page:${slug}`, JSON.stringify(data), { expirationTtl: 60 * 60 * 25 });
  } catch {
  }
}

export async function invalidatePageCache(
  cache: KVNamespace | undefined,
  slug: string,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.delete(`page:${slug}`);
  } catch {
  }
}