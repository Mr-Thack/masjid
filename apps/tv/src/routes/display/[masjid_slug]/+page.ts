import type { PageLoad } from './$types';
import { fetchBoardPayload } from '$lib/api';

export const load: PageLoad = async ({ params, fetch }) => {
  return await fetchBoardPayload(params.masjid_slug, fetch);
};