import { json } from '@sveltejs/kit';
import {
  CreateMasjidSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { hashPassword } from '$lib/server/auth/password';
import { signAccessToken } from '$lib/server/auth/jwt';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, admins } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
  try {
    const body = CreateMasjidSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);
    const secret = platform?.env?.JWT_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret';

    const existing = await db
      .select({ id: masjids.id })
      .from(masjids)
      .where(eq(masjids.slug, body.slug))
      .get();

    if (existing) {
      return ErrorJsonResponse('CONFLICT', 'A masjid with this slug already exists');
    }

    const adminExisting = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.email, body.admin_email.toLowerCase().trim()))
      .get();

    if (adminExisting) {
      return ErrorJsonResponse('CONFLICT', 'An admin with this email already exists');
    }

    const masjidId = crypto.randomUUID();
    const adminId = crypto.randomUUID();
    const passwordHash = await hashPassword(body.admin_password);
    const now = new Date().toISOString();

    const masjidValues = {
      id: masjidId,
      slug: body.slug,
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      timezone: body.timezone,
      calculationMethod: body.calculation_method,
      asrMadhab: body.asr_madhab,
      highLatitudeRule: body.high_latitude_rule,
      showDualAsr: body.show_dual_asr,
      adminEmail: body.admin_email,
      tenantStatus: 'ACTIVE' as const,
      createdAt: now,
    };
    const themeValues = {
      masjidId,
      // New masjids default to the Mishkaat flagship style system
      // (docs/design-language.md §8); existing masjids keep Sakeenah.
      styleSystem: 'mishkaat',
      styleOptions: '{}',
      layoutPreset: 'mishkaat',
      primaryColor: '#9c7c1e',
      accentColor: '#d4af37',
      fontHeading: 'Amiri',
      fontBody: 'Inter',
    };
    const adminValues = {
      id: adminId,
      masjidId,
      email: body.admin_email.toLowerCase().trim(),
      passwordHash,
      displayName: body.admin_display_name ?? null,
      createdAt: now,
    };

    try {
      // D1 (production) supports db.batch for atomic multi-table inserts;
      // better-sqlite3 (local dev) uses a synchronous transaction instead.
      const batched = db as unknown as { batch?: (ops: unknown[]) => Promise<unknown> };
      if (typeof batched.batch === 'function') {
        await batched.batch([
          db.insert(masjids).values(masjidValues),
          db.insert(masjidThemes).values(themeValues),
          db.insert(admins).values(adminValues),
        ]);
      } else {
        db.transaction((tx) => {
          tx.insert(masjids).values(masjidValues).run();
          tx.insert(masjidThemes).values(themeValues).run();
          tx.insert(admins).values(adminValues).run();
        });
      }
    } catch (e) {
      return ErrorJsonResponse('INTERNAL_ERROR', `batch insert failed: ${String(e)}`);
    }

    const token = await signAccessToken(
      { sub: adminId, masjid_id: masjidId },
      secret,
    );

    return JsonResponse({
      token,
      admin: {
        id: adminId,
        email: body.admin_email.toLowerCase().trim(),
        display_name: body.admin_display_name ?? null,
        masjid_id: masjidId,
      },
    }, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', `Registration failed: ${String(e)}`);
  }
};