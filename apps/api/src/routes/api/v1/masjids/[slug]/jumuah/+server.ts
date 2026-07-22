import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, jumuahSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ id: masjids.id, name: masjids.name })
      .from(masjids)
      .where(eq(masjids.slug, params.slug))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const sessions = await db
      .select()
      .from(jumuahSessions)
      .where(eq(jumuahSessions.masjidId, masjid.id));

    return JsonResponse({
      masjid_slug: params.slug,
      masjid_name: masjid.name,
      sessions: sessions
        .filter((s) => s.isActive)
        .map((s) => ({
          id: s.id,
          label: s.label,
          time: s.time,
          khateeb: s.khateeb,
          location: s.location,
          speech_time: s.speechTime,
          is_active: s.isActive,
        })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch jumuah sessions');
  }
};