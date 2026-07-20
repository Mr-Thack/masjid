<script lang="ts">
  import { page } from '$app/stores';
  import { fetchAnnouncements } from '$lib/api';
  import AnnouncementCard from '$lib/components/AnnouncementCard.svelte';

  let data = $derived($page.data);
  let theme = $derived(data.theme);
  let masjid = $derived(data.masjid);

  let announcements = $state(data.recent_announcements ?? []);
  let loading = $state(false);
  let error = $state('');

  async function load() {
    if (!masjid?.slug) return;
    loading = true;
    error = '';
    try {
      const result = await fetchAnnouncements(masjid.slug);
      announcements = result.announcements;
    } catch {
      error = 'Failed to load announcements.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load();
  });
</script>

<div class="space-y-6">
  <div>
    <h1
      class="text-2xl font-bold mb-1"
      style="font-family: var(--font-heading); color: var(--color-accent);"
    >
      Announcements
    </h1>
    <p class="text-sm text-gray-400">Stay updated with the latest news</p>
  </div>

  {#if loading}
    <div class="flex justify-center py-12">
      <div
        class="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style="border-color: var(--color-accent); border-top-color: transparent;"
      ></div>
    </div>
  {:else if error}
    <div class="glass-card p-6 text-center">
      <p class="text-red-400">{error}</p>
    </div>
  {:else if announcements.length === 0}
    <div class="glass-card p-10 text-center space-y-4">
      <div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style="background: rgba(255,255,255,0.03);">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      </div>
      <h2
        class="text-lg font-semibold text-gray-300"
        style="font-family: var(--font-heading);"
      >
        No Announcements Yet
      </h2>
      <p class="text-sm text-gray-500">Check back for updates and community news.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each announcements as announcement}
        <AnnouncementCard
          {announcement}
          accentColor={theme?.accent_color ?? '#10b981'}
        />
      {/each}
    </div>
  {/if}
</div>