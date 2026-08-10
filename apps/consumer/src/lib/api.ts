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
  asr_secondary?: string | null;
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

export interface Post {
  id: string;
  masjid_id: string;
  title: string;
  slug: string;
  content_markdown?: string;
  compiled_html: string | null;
  show_on_homepage: boolean;
  show_on_info: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface PagePayload {
  masjid: {
    slug: string;
    name: string;
    asr_madhab?: string;
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
    /** Style system: 'sakeenah' (default) or 'mishkaat' (docs/design-language.md). */
    style_system?: string;
    /** Per-system theme options (JSON); see StyleOptionsSchema in @masjid/schemas. */
    style_options?: Record<string, unknown>;
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
  homepage_post: {
    title: string;
    slug: string;
    compiled_html: string | null;
    created_at: string;
  } | null;
  info_post: {
    title: string;
    slug: string;
    compiled_html: string | null;
    created_at: string;
  } | null;
}

export interface MaktabInfo {
  open: boolean;
  term: {
    id: string;
    name: string;
    length_months: number;
    billing_months: number;
    prices: { '1': number; '2': number; '3plus': number };
  } | null;
  status_message: string | null;
  program_info: {
    goal?: string;
    schedule_days?: string;
    schedule_time?: string;
    curriculum?: { name: string; description: string }[];
    faqs?: { question: string; answer: string }[];
  };
  square_config: {
    app_id: string;
    location_id: string;
    environment: 'sandbox' | 'production';
  } | null;
}

export const BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1/masjids`;

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

export interface WeeklyPrayerTimes {
  start_date: string;
  base_date: string;
  masjid: { slug: string; name: string };
  days: Array<{
    date: string;
    times: PrayerTimes | null;
    error?: string;
  }>;
  changes: Array<{
    date: string;
    prayer: string;
    from: string;
    to: string;
  }>;
}

export async function fetchWeeklyPrayerTimes(
  slug: string,
  startDate?: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<WeeklyPrayerTimes> {
  const params = startDate ? `?start=${startDate}` : '';
  const res = await customFetch(`${BASE}/${slug}/prayer/weekly${params}`);
  if (!res.ok) throw new Error(`Failed to fetch weekly prayer times: ${res.status}`);
  return res.json();
}

export async function fetchMaktabInfo(
  slug: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<MaktabInfo> {
  const res = await customFetch(`${BASE}/${slug}/maktab`);
  if (!res.ok) throw new Error(`Failed to fetch maktab info: ${res.status}`);
  return res.json();
}

export async function submitMaktabEnrollment(
  slug: string,
  body: Record<string, unknown>,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<{ registration_id: string; subscription_id: string; status: string }> {
  const res = await customFetch(`${BASE}/${slug}/maktab/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    throw new Error(err.error?.message || `Enrollment failed: ${res.status}`);
  }
  return res.json();
}

export async function verifyAssistanceCode(
  slug: string,
  card_holder_name: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<{ needs_payment: boolean }> {
  const res = await customFetch(`${BASE}/${slug}/maktab/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_holder_name }),
  });
  if (!res.ok) return { needs_payment: true };
  return res.json();
}

export async function fetchPosts(
  slug: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<{ masjid_slug: string; masjid_name: string; posts: Post[] }> {
  const res = await customFetch(`${BASE}/${slug}/posts`);
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  return res.json();
}

export async function fetchPost(
  slug: string,
  postSlug: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<Post & { masjid_slug: string; masjid_name: string }> {
  const res = await customFetch(`${BASE}/${slug}/posts/${postSlug}`);
  if (!res.ok) throw new Error(`Failed to fetch post: ${res.status}`);
  return res.json();
}