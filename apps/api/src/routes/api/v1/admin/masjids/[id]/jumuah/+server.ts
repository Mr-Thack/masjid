import {
  CreateJumuahSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { jumuahSessions, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);
    const sessions = await db
      .select()
      .from(jumuahSessions)
      .where(eq(jumuahSessions.masjidId, params.id));

    return JsonResponse({
      sessions: sessions.map((s) => ({
        id: s.id,
        masjid_id: s.masjidId,
        label: s.label,
        time: s.time,
        khateeb: s.khateeb,
        location: s.location,
        is_active: s.isActive,
      })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch jumuah sessions');
  }
};

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = CreateJumuahSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const sessionId = crypto.randomUUID();
    await db.insert(jumuahSessions).values({
      id: sessionId,
      masjidId: params.id,
      label: body.label,
      time: body.time,
      khateeb: body.khateeb ?? null,
      location: body.location ?? null,
    });

    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({
      id: sessionId,
      masjid_id: params.id,
      label: body.label,
      time: body.time,
      khateeb: body.khateeb ?? null,
      location: body.location ?? null,
      is_active: true,
    }, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create jumuah session');
  }
};