<script lang="ts">
  import { page } from '$app/stores';
  import { fetchAnnouncements } from '$lib/api';
  import AnnouncementCard from '$lib/components/AnnouncementCard.svelte';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let data = $derived($page.data);
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
    <h1 class="text-2xl font-bold mb-1 font-heading text-accent">Announcements</h1>
    <p style="color: var(--color-text-muted);">Stay updated with the latest news</p>
  </div>

  {#if loading}
    <LoadingSpinner />
  {:else if error}
    <ErrorState message={error} />
  {:else if announcements.length === 0}
    <EmptyState
      icon="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
      title="No Announcements Yet"
      message="Check back for updates and community news."
    />
  {:else}
    <div class="space-y-3">
      {#each announcements as announcement}
        <AnnouncementCard {announcement} />
      {/each}
    </div>
  {/if}
</div>