import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { fetchPagePayload, fetchNavItems, type NavItem } from '$lib/api';

export const load: LayoutLoad = async ({ params, fetch }) => {
  try {
    const payload = await fetchPagePayload(params.masjid_slug, fetch);
    let navItems: NavItem[] = [];
    try {
      navItems = await fetchNavItems(params.masjid_slug, fetch);
    } catch {
      // nav endpoint failure is non-fatal — layout falls back to defaults
      console.warn('Failed to fetch nav items, using defaults');
    }
    return {
      masjid: payload.masjid,
      theme: payload.theme,
      prayer_times: payload.prayer_times,
      jumuah: payload.jumuah,
      pinned_announcement: payload.pinned_announcement,
      recent_announcements: payload.recent_announcements,
      homepage_post: payload.homepage_post,
      info_post: payload.info_post,
      nav_items: navItems,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('404')) error(404, 'Masjid not found');
    throw e;
  }
};