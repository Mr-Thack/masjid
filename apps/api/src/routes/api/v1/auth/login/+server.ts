import { json } from '@sveltejs/kit';
import { LoginSchema, ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { verifyPassword } from '$lib/server/auth/password';
import { signAccessToken } from '$lib/server/auth/jwt';
import { getDb } from '$lib/server/db';
import { admins } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
  try {
    const body = LoginSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);
    const secret = platform?.env?.JWT_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret';

    const adminRow = await db
      .select()
      .from(admins)
      .where(eq(admins.email, body.email.toLowerCase().trim()))
      .get();

    if (!adminRow) {
      return ErrorJsonResponse('UNAUTHORIZED', 'Invalid email or password');
    }

    const valid = await verifyPassword(body.password, adminRow.passwordHash);
    if (!valid) {
      return ErrorJsonResponse('UNAUTHORIZED', 'Invalid email or password');
    }

    const token = await signAccessToken(
      { sub: adminRow.id, masjid_id: adminRow.masjidId },
      secret,
    );

    return JsonResponse({
      token,
      admin: {
        id: adminRow.id,
        email: adminRow.email,
        display_name: adminRow.displayName,
        masjid_id: adminRow.masjidId,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Login failed');
  }
};