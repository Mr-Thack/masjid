import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { fetchBoardPayload } from '$lib/api';

export const load: PageLoad = async ({ params, fetch }) => {
  try {
    return await fetchBoardPayload(params.masjid_slug, fetch);
  } catch (e) {
    error(404, 'Masjid not found');
  }
};