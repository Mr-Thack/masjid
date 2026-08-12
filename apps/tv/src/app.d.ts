import type { Theme } from '@masjid/schemas';

declare global {
  namespace App {
    interface PageData {
      masjid: {
        slug: string;
        name: string;
        city?: string | null;
      };
      theme: Theme;
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
        location: string | null;
        is_active: boolean;
      }>;
      pinned_announcement: {
        title: string;
        compiled_html: string;
      } | null;
    }
  }
}

export {};