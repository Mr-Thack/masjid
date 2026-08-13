import { error } from '@sveltejs/kit';
import { fetchBoardPayload } from '$lib/api';

export const load = (async ({ params, fetch }: any) => {
  try {
    return await fetchBoardPayload(params.masjid_slug, fetch);
  } catch (e) {
    error(404, 'Masjid not found');
  }
}) as any;