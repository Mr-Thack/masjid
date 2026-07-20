import type { PageLoad } from './$types';
import { fetchPagePayload } from '$lib/api';

export const load: PageLoad = async ({ params, fetch }) => {
  const payload = await fetchPagePayload(params.masjid_slug, fetch);
  return payload;
};