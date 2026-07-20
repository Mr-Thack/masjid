import type { PageLoad } from './$types';
import { fetchPagePayload } from '$lib/api';

export const load: PageLoad = async ({ params }) => {
  const payload = await fetchPagePayload(params.masjid_slug);
  return payload;
};