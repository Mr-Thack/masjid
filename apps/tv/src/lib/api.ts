export interface BoardPayload {
  masjid: {
    slug: string;
    name: string;
    city: string | null;
    state: string | null;
    asr_madhab?: string;
    external_donation_url: string | null;
  };
  theme: {
    style_system: 'sakeenah' | 'mishkaat';
    style_options: Record<string, unknown>;
    primary_color: string;
    accent_color: string;
    font_heading: string;
    font_body: string;
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
  /** Server-synchronized time (ISO) — see docs/design-language.md §7.7. */
  server_time?: string;
  today: {
    date: string;
    times: {
      fajr: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean };
      sunrise: string;
      dhuhr: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean };
      asr: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean };
      asr_secondary?: string;
      maghrib: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean };
      isha: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean };
    };
  };
  upcoming_days: Array<{
    date: string;
    times: {
      fajr: { adhaan: string; iqaamah: string };
      sunrise: string;
      dhuhr: { adhaan: string; iqaamah: string };
      asr: { adhaan: string; iqaamah: string };
      maghrib: { adhaan: string; iqaamah: string };
      isha: { adhaan: string; iqaamah: string };
    };
  }>;
  jumuah: Array<{
    id: string;
    label: string;
    time: string;
    khateeb: string | null;
    speech_time: string | null;
  }>;
  pinned_announcement: {
    title: string;
    compiled_html: string;
  } | null;
  recent_announcements?: Array<{
    id: string;
    title: string;
    slug: string;
    compiled_html: string | null;
    status: string;
    published_at: string | null;
    expires_at: string | null;
  }>;
}

const BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1/masjids`;

export async function fetchBoardPayload(
  slug: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<BoardPayload> {
  const res = await customFetch(`${BASE}/${slug}/board`);
  if (!res.ok) {
    throw new Error(`Failed to fetch board: ${res.status}`);
  }
  return res.json();
}