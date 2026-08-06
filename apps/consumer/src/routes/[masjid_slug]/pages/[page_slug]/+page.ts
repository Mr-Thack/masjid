import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const { masjid_slug, page_slug } = params;

  const res = await fetch(`/api/v1/masjids/${masjid_slug}/pages/${page_slug}`);

  if (!res.ok) {
    if (res.status === 404) {
      error(404, `Page '${page_slug}' not found`);
    }
    error(res.status, 'Failed to load page');
  }

  const data = await res.json();
  return { page: data };
};