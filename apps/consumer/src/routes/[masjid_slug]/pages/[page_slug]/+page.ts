import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { fetchCustomPage } from '$lib/api';

export const load: PageLoad = async ({ params, fetch }) => {
  try {
    const page = await fetchCustomPage(params.masjid_slug, params.page_slug, fetch);
    return { page };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('404')) error(404, `Page '${params.page_slug}' not found`);
    throw e;
  }
};
