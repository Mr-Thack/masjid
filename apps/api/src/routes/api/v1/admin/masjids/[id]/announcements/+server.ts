import {
  CreateAnnouncementSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { announcements, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';
import type { RequestHandler } from './$types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function compileMarkdown(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '') {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      const level = headingMatch[1]!.length;
      result.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    const hrMatch = trimmed.match(/^[-*_]{3,}$/);
    if (hrMatch) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      result.push('<hr>');
      continue;
    }

    let processed = trimmed
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    if (!inParagraph) {
      result.push('<p>');
      inParagraph = true;
    } else {
      result.push(' ');
    }
    result.push(processed);
  }

  if (inParagraph) {
    result.push('</p>');
  }

  return result.join('');
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
      .from(announcements)
      .where(eq(announcements.masjidId, params.id))
      .orderBy(desc(announcements.publishedAt));

    return JsonResponse({
      announcements: rows.map((a) => ({
        id: a.id,
        masjid_id: a.masjidId,
        title: a.title,
        slug: a.slug,
        content_markdown: a.contentMarkdown,
        compiled_html: a.compiledHtml,
        is_pinned: a.isPinned,
        status: a.status,
        published_at: a.publishedAt,
        expires_at: a.expiresAt,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      })),
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch announcements');
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
    const body = CreateAnnouncementSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const generatedSlug = slugify(body.title);
    const compiledHtml = compileMarkdown(body.content_markdown);
    const now = new Date().toISOString();

    if (body.is_pinned) {
      await db
        .update(announcements)
        .set({ isPinned: false })
        .where(
          and(
            eq(announcements.masjidId, params.id),
            eq(announcements.isPinned, true),
          ),
        );
    }

    const announcementId = crypto.randomUUID();
    await db.insert(announcements).values({
      id: announcementId,
      masjidId: params.id,
      title: body.title,
      slug: generatedSlug,
      contentMarkdown: body.content_markdown,
      compiledHtml,
      isPinned: body.is_pinned,
      status: body.status ?? 'published',
      publishedAt: body.status === 'published' ? now : null,
      expiresAt: body.expires_at ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({
      id: announcementId,
      masjid_id: params.id,
      title: body.title,
      slug: generatedSlug,
      content_markdown: body.content_markdown,
      compiled_html: compiledHtml,
      is_pinned: body.is_pinned,
      status: body.status ?? 'published',
      published_at: body.status === 'published' ? now : null,
      expires_at: body.expires_at ?? null,
      created_at: now,
      updated_at: now,
    }, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to create announcement');
  }
};