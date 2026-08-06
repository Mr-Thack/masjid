import {
  CreatePageSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjidPages, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import { compileMarkdown } from '$lib/server/markdown';
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
    const rows = await db
      .select()
      .from(masjidPages)
      .where(eq(masjidPages.masjidId, params.id))
      .orderBy(desc(masjidPages.lastUpdated));

    return JsonResponse({
      pages: rows.map((p) => ({
        id: p.id,
        masjid_id: p.masjidId,
        slug: p.slug,
        title: p.title,
        compiled_html: p.compiledHtml,
        raw_markdown: p.rawMarkdown,
        last_updated: p.lastUpdated,
      })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch pages');
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
    const body = CreatePageSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const existing = await db
      .select({ id: masjidPages.id })
      .from(masjidPages)
      .where(
        and(
          eq(masjidPages.masjidId, params.id),
          eq(masjidPages.slug, body.slug),
        ),
      )
      .get();

    if (existing) {
      return ErrorJsonResponse('CONFLICT', `A page with slug "${body.slug}" already exists`);
    }

    const compiledHtml = compileMarkdown(body.raw_markdown);
    const now = new Date().toISOString();
    const pageId = crypto.randomUUID();

    await db.insert(masjidPages).values({
      id: pageId,
      masjidId: params.id,
      slug: body.slug,
      title: body.title,
      compiledHtml,
      rawMarkdown: body.raw_markdown,
      lastUpdated: now,
    });

    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({
      id: pageId,
      masjid_id: params.id,
      slug: body.slug,
      title: body.title,
      compiled_html: compiledHtml,
      raw_markdown: body.raw_markdown,
      last_updated: now,
    }, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create page');
  }
};