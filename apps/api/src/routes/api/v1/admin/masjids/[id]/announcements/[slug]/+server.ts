import {
  UpdateAnnouncementSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { announcements, masjids as masjidsTable } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidatePageCache } from '$lib/server/prayer/cache';

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

import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const body = UpdateAnnouncementSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.masjidId, params.id),
          eq(announcements.slug, params.slug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Announcement not found');
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.content_markdown !== undefined) {
      updateData.contentMarkdown = body.content_markdown;
      updateData.compiledHtml = compileMarkdown(body.content_markdown);
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'published' && existing.status !== 'published') {
        updateData.publishedAt = now;
      }
    }
    if (body.is_pinned !== undefined) updateData.isPinned = body.is_pinned;
    if (body.expires_at !== undefined) updateData.expiresAt = body.expires_at;

    await db
      .update(announcements)
      .set(updateData)
      .where(and(eq(announcements.masjidId, params.id), eq(announcements.slug, params.slug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    const updated = await db
      .select()
      .from(announcements)
      .where(and(eq(announcements.masjidId, params.id), eq(announcements.slug, params.slug)))
      .get();

    return JsonResponse({
      id: updated?.id,
      masjid_id: updated?.masjidId,
      title: updated?.title,
      slug: updated?.slug,
      content_markdown: updated?.contentMarkdown,
      compiled_html: updated?.compiledHtml,
      is_pinned: updated?.isPinned,
      status: updated?.status,
      published_at: updated?.publishedAt,
      expires_at: updated?.expiresAt,
      created_at: updated?.createdAt,
      updated_at: updated?.updatedAt,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', (e as Error).message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update announcement');
  }
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only manage your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);

    const existing = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.masjidId, params.id),
          eq(announcements.slug, params.slug),
        ),
      )
      .get();

    if (!existing) {
      return ErrorJsonResponse('NOT_FOUND', 'Announcement not found');
    }

    await db
      .update(announcements)
      .set({ status: 'archived', updatedAt: new Date().toISOString() })
      .where(and(eq(announcements.masjidId, params.id), eq(announcements.slug, params.slug)));

    const masjid = await db
      .select({ slug: masjidsTable.slug })
      .from(masjidsTable)
      .where(eq(masjidsTable.id, params.id))
      .get();

    if (masjid) await invalidatePageCache(platform?.env?.CACHE, masjid.slug);

    return JsonResponse({ success: true });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to archive announcement');
  }
};