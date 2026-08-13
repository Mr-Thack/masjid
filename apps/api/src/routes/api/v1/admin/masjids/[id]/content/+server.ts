import {
  CreateContentSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { content, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import { compileMarkdown } from '$lib/server/markdown';
import type { RequestHandler } from './$types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

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
      .from(content)
      .where(eq(content.masjidId, params.id))
      .orderBy(desc(content.updatedAt));

    return JsonResponse({
      content: rows.map((c) => ({
        id: c.id,
        masjid_id: c.masjidId,
        title: c.title,
        slug: c.slug,
        content_markdown: c.contentMarkdown,
        compiled_html: c.compiledHtml,
        content_type: c.contentType,
        show_on_homepage: c.showOnHomepage,
        show_on_info: c.showOnInfo,
        is_hidden: c.isHidden,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch content');
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
    const body = CreateContentSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const generatedSlug = body.slug || slugify(body.title);
    const compiledHtml = compileMarkdown(body.content_markdown);
    const now = new Date().toISOString();

    const existing = await db
      .select({ id: content.id })
      .from(content)
      .where(
        and(
          eq(content.masjidId, params.id),
          eq(content.slug, generatedSlug),
        ),
      )
      .get();

    if (existing) {
      return ErrorJsonResponse('CONFLICT', `A ${body.content_type} with slug "${generatedSlug}" already exists`);
    }

    if (body.show_on_homepage) {
      await db
        .update(content)
        .set({ showOnHomepage: false })
        .where(
          and(
            eq(content.masjidId, params.id),
            eq(content.showOnHomepage, true),
            eq(content.contentType, 'post'),
          ),
        );
    }

    if (body.show_on_info) {
      await db
        .update(content)
        .set({ showOnInfo: false })
        .where(
          and(
            eq(content.masjidId, params.id),
            eq(content.showOnInfo, true),
            eq(content.contentType, 'post'),
          ),
        );
    }

    const contentId = crypto.randomUUID();
    await db.insert(content).values({
      id: contentId,
      masjidId: params.id,
      title: body.title,
      slug: generatedSlug,
      contentMarkdown: body.content_markdown,
      compiledHtml,
      contentType: body.content_type,
      showOnHomepage: body.show_on_homepage,
      showOnInfo: body.show_on_info,
      isHidden: body.is_hidden,
      createdAt: now,
      updatedAt: now,
    });

    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({
      id: contentId,
      masjid_id: params.id,
      title: body.title,
      slug: generatedSlug,
      content_markdown: body.content_markdown,
      compiled_html: compiledHtml,
      content_type: body.content_type,
      show_on_homepage: body.show_on_homepage,
      show_on_info: body.show_on_info,
      is_hidden: body.is_hidden,
      created_at: now,
      updated_at: now,
    }, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create content');
  }
};