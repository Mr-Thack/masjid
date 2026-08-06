import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { fetchPost } from '$lib/api';

export const load: PageLoad = async ({ params, fetch }) => {
  try {
    const post = await fetchPost(params.masjid_slug, params.post_slug, fetch);
    return { post };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('404')) error(404, 'Post not found');
    throw e;
  }
};