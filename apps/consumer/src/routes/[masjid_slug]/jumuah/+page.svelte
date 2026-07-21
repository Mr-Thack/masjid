<script lang="ts">
  import { page } from '$app/stores';
  import { fetchJumuah, type JumuahSession } from '$lib/api';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { formatTime } from '$lib/time';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let theme = $derived(data.theme);

  let timeFormat = $derived(theme?.time_format ?? '24h');
  let sessions = $state<JumuahSession[]>([]);
  let loading = $state(false);
  let error = $state('');

  async function load() {
    if (!masjid?.slug) return;
    loading = true;
    error = '';
    try {
      const result = await fetchJumuah(masjid.slug);
      sessions = result.sessions;
    } catch {
      error = 'Failed to load Jumu\'ah sessions.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!masjid?.slug) return;
    load();
  });
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold mb-1 font-heading text-accent">Jumu'ah</h1>
    <p style="color: var(--color-text-muted);">Friday congregational prayer sessions</p>
  </div>

  {#if loading}
    <LoadingSpinner />
  {:else if error}
    <ErrorState message={error} />
  {:else if sessions.length === 0}
    <EmptyState
      icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      title="No Jumu'ah Sessions Configured Yet"
      message="Please check back later for Friday prayer schedules."
    />
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {#each sessions as session}
        <div class="glass-card p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div class="absolute top-0 left-0 w-1 h-full bg-accent"></div>

          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background: rgba(255,255,255,0.04);">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold" style="color: var(--color-text);">{session.label}</h3>
              <p class="text-3xl font-extrabold tabular-nums mt-2 text-accent">
                {formatTime(session.time, timeFormat)}
              </p>

              {#if session.khateeb}
                <div class="mt-3 pt-3 border-t" style="border-color: var(--color-border);">
                  <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-dim);">Khateeb</p>
                  <p class="text-sm font-medium mt-0.5" style="color: var(--color-text-muted);">{session.khateeb}</p>
                </div>
              {/if}

            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>