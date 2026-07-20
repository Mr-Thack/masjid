import { error } from '@masjid/schemas';
import { verifyAccessToken } from '$lib/server/auth/jwt';
import { getDb } from '$lib/server/db';
import { admins } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = [
  /^\/api\/v1\/auth\/login$/,
  /^\/api\/v1\/auth\/register$/,
  /^\/api\/v1\/webhooks\/stripe$/,
];

const PUBLIC_MASJID_PATTERN = /^\/api\/v1\/masjids\/(?!.*\b[a-f0-9-]{36}\b)([a-z0-9-]+)/;

function isPublicPath(pathname: string): boolean {
  for (const pattern of PUBLIC_PATHS) {
    if (pattern.test(pathname)) return true;
  }
  if (PUBLIC_MASJID_PATTERN.test(pathname)) return true;
  return false;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  const pathname = new URL(event.request.url).pathname;

  if (isPublicPath(pathname) || event.request.method === 'OPTIONS') {
    return resolve(event);
  }

  const authHeader = event.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(error('UNAUTHORIZED', 'Missing or invalid Authorization header'), 401);
  }

  const token = authHeader.slice(7);
  try {
    const secret = event.platform?.env?.JWT_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret';
    const payload = await verifyAccessToken(token, secret);

    const db = getDb(event.platform?.env?.DB);
    const adminRow = await db
      .select({
        id: admins.id,
        email: admins.email,
        display_name: admins.displayName,
        masjid_id: admins.masjidId,
      })
      .from(admins)
      .where(eq(admins.id, payload.sub))
      .get();

    if (!adminRow) {
      return jsonResponse(error('UNAUTHORIZED', 'Admin not found'), 401);
    }

    event.locals.admin = {
      sub: adminRow.id,
      masjid_id: adminRow.masjid_id,
      email: adminRow.email,
      display_name: adminRow.display_name ?? null,
    };
  } catch {
    return jsonResponse(error('UNAUTHORIZED', 'Invalid or expired token'), 401);
  }

  return resolve(event);
};