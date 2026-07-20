import type { DailyTimes } from '@masjid/schemas';

export interface PagePayload {
  masjid: {
    slug: string;
    name: string;
    city: string | null;
    external_donation_url: string | null;
  };
  theme: {
    primary_color: string;
    accent_color: string;
    font_heading: string;
    font_body: string;
    layout_preset: string;
  };
  prayer_times: {
    fajr: { adhaan: string; iqaamah: string };
    sunrise: string;
    dhuhr: { adhaan: string; iqaamah: string };
    asr: { adhaan: string; iqaamah: string };
    maghrib: { adhaan: string; iqaamah: string };
    isha: { adhaan: string; iqaamah: string };
  };
  jumuah: Array<{
    id: string;
    label: string;
    time: string;
    khateeb: string | null;
    language: string;
    location: string | null;
    is_active: boolean;
  }>;
  pinned_announcement: {
    title: string;
    compiled_html: string;
  } | null;
}

const BASE = '/api/v1/masjids';

export async function fetchPagePayload(slug: string): Promise<PagePayload> {
  const res = await fetch(`${BASE}/${slug}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch page payload: ${res.status}`);
  }
  return res.json();
}

export async function fetchPrayerTimes(
  slug: string,
  date?: string,
): Promise<DailyTimes> {
  const params = date ? `?date=${date}` : '';
  const res = await fetch(`${BASE}/${slug}/prayer-times${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch prayer times: ${res.status}`);
  }
  return res.json();
}