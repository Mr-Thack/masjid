export interface BoardPayload {
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
    time_format: '12h' | '24h';
    label_adhaan: string;
    label_iqaamah: string;
    label_jumuah: string;
    label_sunrise: string;
    label_fajr: string;
    label_dhuhr: string;
    label_asr: string;
    label_maghrib: string;
    label_isha: string;
  };
  today: {
    date: string;
    times: {
      fajr: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean };
      sunrise: string;
      dhuhr: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean };
      asr: { adhaan: string; iqaamah: string; right_after_adhaan?: boolean };
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
    language: string;
  }>;
  pinned_announcement: {
    title: string;
    compiled_html: string;
  } | null;
}

const BASE = '/api/v1/masjids';

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