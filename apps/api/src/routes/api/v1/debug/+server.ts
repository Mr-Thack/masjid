import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { masjids, admins, masjidThemes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
  const results: Record<string, unknown> = {};

  try {
    const db = getDb(platform?.env?.DB);
    const all = await db.select().from(masjids).all();
    results.drizzle = 'ok';
    results.masjid_count = all.length;

    // Debug: raw theme data for Al-Noor
    try {
      const theme = await db.select().from(masjidThemes)
        .innerJoin(masjids, eq(masjidThemes.masjidId, masjids.id))
        .where(eq(masjids.slug, 'masjid-al-noor')).get();
      results.theme_alnoor = theme?.masjid_themes ?? null;
    } catch (e) {
      results.theme_error = String(e);
    }

    const admin = await db.select().from(admins).where(eq(admins.email, 'admin@masjid-alnoor.org')).get();
    if (admin) {
      results.admin_found = true;
      results.hash_prefix = admin.passwordHash.substring(0, 10);
      try {
        results.bcrypt_compare = await bcrypt.compare('password123', admin.passwordHash);
      } catch (e) {
        results.bcrypt_error = String(e);
      }
      try {
        results.bcrypt_hash = (await bcrypt.hash('test', 4)).substring(0, 10);
      } catch (e) {
        results.bcrypt_hash_error = String(e);
      }
    }
  } catch (e) {
    results.error = String(e);
    results.stack = (e as Error).stack;
  }

  return json(results);
};