import type { Theme, JumuahSession, Announcement } from '@masjid/schemas';

interface PrayerTimeEntry {
  adhaan: string;
  iqaamah: string;
  right_after_adhaan?: boolean;
}

interface PrayerTimes {
  fajr: PrayerTimeEntry;
  sunrise: string;
  dhuhr: PrayerTimeEntry;
  asr: PrayerTimeEntry;
  maghrib: PrayerTimeEntry;
  isha: PrayerTimeEntry;
}

declare global {
  namespace App {
    interface PageData {
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
        about_markdown: string | null;
        about_html: string | null;
        donation_links: string | null;
      };
      theme: Theme;
      prayer_times: PrayerTimes | null;
      jumuah: JumuahSession[];
      pinned_announcement: { title: string; compiled_html: string } | null;
      recent_announcements: Announcement[];
    }
  }
}

export {};