import {
  CreateDomainSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { customDomains, masjids as masjidsTable } from '$lib/server/db/schema';
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
    const domain = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.masjidId, params.id))
      .get();

    if (!domain) {
      return JsonResponse({ domain: null });
    }

    return JsonResponse({
      domain: {
        id: domain.id,
        masjid_id: domain.masjidId,
        domain: domain.domain,
        cf_hostname_id: domain.cfHostnameId,
        ssl_status: domain.sslStatus,
        verified_at: domain.verifiedAt,
        created_at: domain.createdAt,
      },
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch domain');
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
    const body = CreateDomainSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const existingByDomain = await db
      .select({ id: customDomains.id })
      .from(customDomains)
      .where(eq(customDomains.domain, body.domain))
      .get();

    if (existingByDomain) {
      return ErrorJsonResponse('CONFLICT', 'This domain is already in use');
    }

    const existingByMasjid = await db
      .select({ id: customDomains.id })
      .from(customDomains)
      .where(eq(customDomains.masjidId, params.id))
      .get();

    if (existingByMasjid) {
      return ErrorJsonResponse('CONFLICT', 'This masjid already has a domain configured');
    }

    const domainId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(customDomains).values({
      id: domainId,
      masjidId: params.id,
      domain: body.domain,
      sslStatus: 'pending',
      createdAt: now,
    });

    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({
      domain: {
        id: domainId,
        masjid_id: params.id,
        domain: body.domain,
        cf_hostname_id: null,
        ssl_status: 'pending',
        verified_at: null,
        created_at: now,
      },
    }, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to add domain');
  }
};