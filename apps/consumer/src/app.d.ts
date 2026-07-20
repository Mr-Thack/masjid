import type { Theme } from '@masjid/schemas';

declare global {
  namespace App {
    interface PageData {
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
      theme: Theme;
    }
  }
}

export {};