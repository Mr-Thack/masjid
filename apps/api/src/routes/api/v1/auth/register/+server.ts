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

    await db.batch([
      db.insert(masjids).values({
        id: masjidId,
        slug: body.slug,
        name: body.name,
        latitude: body.latitude,
        longitude: body.longitude,
        timezone: body.timezone,
        calculationMethod: body.calculation_method,
        adminEmail: body.admin_email,
        tenantStatus: 'ACTIVE',
        createdAt: now,
      }),
      db.insert(masjidThemes).values({
        masjidId,
        layoutPreset: 'modern_minimal',
        primaryColor: '#1e3a8a',
        accentColor: '#10b981',
        fontHeading: 'Inter',
        fontBody: 'Roboto',
      }),
      db.insert(admins).values({
        id: adminId,
        masjidId,
        email: body.admin_email.toLowerCase().trim(),
        passwordHash,
        displayName: body.admin_display_name ?? null,
        createdAt: now,
      }),
    ]);

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
    return ErrorJsonResponse('INTERNAL_ERROR', 'Registration failed');
  }
};