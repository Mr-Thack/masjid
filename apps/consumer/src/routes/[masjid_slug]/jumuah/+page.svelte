<script lang="ts">
  import { page } from '$app/stores';
  import { fetchJumuah } from '$lib/api';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);

  let sessions = $state(data.jumuah ?? []);
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
    <ErrorState {message} />
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
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold" style="color: var(--color-text);">{session.label}</h3>
              <p class="text-3xl font-extrabold tabular-nums mt-2 text-accent">{session.time}</p>

              {#if session.khateeb}
                <div class="mt-3 pt-3 border-t border-white/5">
                  <p class="text-xs uppercase tracking-wider" style="color: var(--color-text-dim);">Khateeb</p>
                  <p class="text-sm font-medium mt-0.5" style="color: var(--color-text-muted);">{session.khateeb}</p>
                </div>
              {/if}

              <div class="flex items-center gap-3 mt-3">
                {#if session.language && session.language !== 'en'}
                  <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded" style="background: rgba(255,255,255,0.06); color: var(--color-text-muted);">
                    {session.language}
                  </span>
                {/if}
                {#if session.location}
                  <div class="flex items-center gap-1 text-xs" style="color: var(--color-text-dim);">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {session.location}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>