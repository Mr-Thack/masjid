import type { DailyTimes, Announcement, JumuahSession } from '@masjid/schemas';

export interface PagePayload {
  masjid: {
    slug: string;
    name: string;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    external_donation_url: string | null;
    contact_phone: string | null;
    contact_email: string | null;
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
  jumuah: JumuahSession[];
  pinned_announcement: {
    title: string;
    compiled_html: string;
  } | null;
  recent_announcements: Announcement[];
}

const BASE = '/api/v1/masjids';

export async function fetchPagePayload(
  slug: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<PagePayload> {
  const res = await customFetch(`${BASE}/${slug}`);
  if (!res.ok) throw new Error(`Failed to fetch page payload: ${res.status}`);
  return res.json();
}

export async function fetchPrayerTimes(
  slug: string,
  date?: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<DailyTimes> {
  const params = date ? `?date=${date}` : '';
  const res = await customFetch(`${BASE}/${slug}/prayer${params}`);
  if (!res.ok) throw new Error(`Failed to fetch prayer times: ${res.status}`);
  return res.json();
}

export async function fetchAnnouncements(
  slug: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<{ announcements: Announcement[] }> {
  const res = await customFetch(`${BASE}/${slug}/announcements`);
  if (!res.ok) throw new Error(`Failed to fetch announcements: ${res.status}`);
  return res.json();
}

export async function fetchJumuah(
  slug: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<{ sessions: JumuahSession[] }> {
  const res = await customFetch(`${BASE}/${slug}/jumuah`);
  if (!res.ok) throw new Error(`Failed to fetch jumuah: ${res.status}`);
  return res.json();
}