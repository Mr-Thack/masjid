import { ErrorJsonResponse, JsonResponse } from '@masjid/schemas';
import { getDb } from '$lib/server/db';
import { masjids, posts } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
  try {
    const db = getDb(platform?.env?.DB);

    const masjid = await db
      .select({ id: masjids.id, name: masjids.name })
      .from(masjids)
      .where(eq(masjids.slug, params.slug))
      .get();

    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    const post = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.masjidId, masjid.id),
          eq(posts.slug, params.post_slug),
          eq(posts.isHidden, false),
        ),
      )
      .get();

    if (!post) {
      return ErrorJsonResponse('NOT_FOUND', 'Post not found');
    }

    return JsonResponse({
      id: post.id,
      title: post.title,
      slug: post.slug,
      content_markdown: post.contentMarkdown,
      compiled_html: post.compiledHtml,
      show_on_homepage: post.showOnHomepage,
      show_on_info: post.showOnInfo,
      created_at: post.createdAt,
      updated_at: post.updatedAt,
      masjid_slug: params.slug,
      masjid_name: masjid.name,
    });
  } catch {
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to fetch post');
  }
};