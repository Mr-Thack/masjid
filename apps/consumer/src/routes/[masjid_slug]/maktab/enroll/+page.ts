import type { PageLoad } from './$types';
import { fetchMaktabInfo } from '$lib/api';

export const load: PageLoad = async ({ params, fetch }) => {
  let maktab = null;
  let error: string | null = null;

  try {
    maktab = await fetchMaktabInfo(params.masjid_slug, fetch);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unable to load enrollment information.';
  }

  return {
    maktab,
    maktabError: error,
  };
};
