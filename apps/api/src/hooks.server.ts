import { error } from '@masjid/schemas';
import { verifyAccessToken } from '$lib/server/auth/jwt';
import { getDb } from '$lib/server/db';
import { admins } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Handle } from '@sveltejs/kit';

const ALLOWED_ORIGINS = [
  'https://masjid-live.pages.dev',
  // Staging pages (docs/integration-testing.md) — points at this same API:
  'https://masjid-staging.pages.dev',
  // Mirror pages — advanced code vs prod D1:
  'https://masjid-mirror.pages.dev',
  'http://localhost:5175',
  'http://localhost:5176',
];

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
  }
  return {};
}

function withCors(response: Response, origin: string | null): Response {
  const headers = corsHeaders(origin);
  const res = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}

const PUBLIC_PATTERNS = [
  /^\/api\/v1\/auth\/(login|register)$/,
  /^\/api\/v1\/webhooks\/stripe$/,
  /^\/api\/v1\/masjids\//,
  /^\/api\/v1\/status$/,
  /^\/api\/v1\/debug$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((p) => p.test(pathname));
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const handle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('origin');
  const pathname = new URL(event.request.url).pathname;

  if (event.request.method === 'OPTIONS') {
    const headers = corsHeaders(origin);
    if (Object.keys(headers).length > 0) {
      return new Response(null, { status: 204, headers });
    }
    return new Response(null, { status: 204 });
  }

  if (!isPublicPath(pathname)) {
    const authHeader = event.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return withCors(jsonResponse(error('UNAUTHORIZED', 'Missing or invalid Authorization header'), 401), origin);
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
        return withCors(jsonResponse(error('UNAUTHORIZED', 'Admin not found'), 401), origin);
      }

      event.locals.admin = {
        sub: adminRow.id,
        masjid_id: adminRow.masjid_id,
        email: adminRow.email,
        display_name: adminRow.display_name ?? null,
      };
    } catch {
      return withCors(jsonResponse(error('UNAUTHORIZED', 'Invalid or expired token'), 401), origin);
    }
  }

  const response = await resolve(event);
  return withCors(response, origin);
};