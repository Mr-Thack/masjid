import { writable } from 'svelte/store';

export const page = writable({
  url: new URL('http://localhost/admin/masjid-al-noor'),
  params: { slug: 'masjid-al-noor' },
  data: {},
  status: 200,
  error: null,
});

export const navigating = writable(null);
export const updated = writable(false);
