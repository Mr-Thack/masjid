import { UpdatePasswordSchema, ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { hashPassword, verifyPassword } from '$lib/server/auth/password';
import { getDb } from '$lib/server/db';
import { admins } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = UpdatePasswordSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const adminRow = await db
      .select({ id: admins.id, password_hash: admins.passwordHash })
      .from(admins)
      .where(eq(admins.id, locals.admin.sub))
      .get();

    if (!adminRow) {
      return ErrorJsonResponse('NOT_FOUND', 'Admin not found');
    }

    const valid = await verifyPassword(body.current_password, adminRow.password_hash);
    if (!valid) {
      return ErrorJsonResponse('UNAUTHORIZED', 'Current password is incorrect');
    }

    const newHash = await hashPassword(body.new_password);
    await db
      .update(admins)
      .set({ passwordHash: newHash })
      .where(eq(admins.id, locals.admin.sub));

    return JsonResponse({ success: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update password');
  }
};