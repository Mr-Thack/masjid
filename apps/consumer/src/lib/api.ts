import type { DailyTimes, Announcement } from '@masjid/schemas';

export interface PrayerTimeEntry {
  adhaan: string;
  iqaamah: string;
  right_after_adhaan?: boolean;
}

export interface PrayerTimes {
  fajr: PrayerTimeEntry;
  sunrise: string;
  dhuhr: PrayerTimeEntry;
  asr: PrayerTimeEntry;
  maghrib: PrayerTimeEntry;
  isha: PrayerTimeEntry;
}

export interface JumuahSession {
  id: string;
  label: string;
  time: string;
  khateeb: string | null;
  speech_time: string | null;
}

export interface PagePayload {
  masjid: {
    slug: string;
    name: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    website_url: string | null;
    facebook_url: string | null;
    youtube_url: string | null;
    instagram_url: string | null;
    external_donation_url: string | null;
  };
  theme: {
    primary_color: string;
    accent_color: string;
    font_body: string;
    font_heading: string;
    layout_preset: string;
    time_format: '12h' | '24h';
    label_adhaan: string;
    label_iqaamah: string;
    label_jumuah: string;
    label_speech: string;
    label_sunrise: string;
    label_fajr: string;
    label_dhuhr: string;
    label_asr: string;
    label_maghrib: string;
    label_isha: string;
  };
  prayer_times: PrayerTimes | null;
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