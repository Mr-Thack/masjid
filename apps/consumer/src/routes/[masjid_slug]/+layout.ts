import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { fetchPagePayload } from '$lib/api';

export const load: LayoutLoad = async ({ params, fetch }) => {
  try {
    const payload = await fetchPagePayload(params.masjid_slug, fetch);
    return {
      masjid: payload.masjid,
      theme: payload.theme,
      prayer_times: payload.prayer_times,
      jumuah: payload.jumuah,
      pinned_announcement: payload.pinned_announcement,
      recent_announcements: payload.recent_announcements,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('404')) error(404, 'Masjid not found');
    throw e;
  }
};