<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte';
  import AdminShell from '$lib/components/AdminShell.svelte';
  import { api } from '$lib/api';
  import { Loader } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { data, children }: { data: { masjidSlug: string }; children: Snippet } = $props();

  let masjidName = $state<string>('');
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!auth.isAuthenticated) {
      auth.checkAuth().then(valid => {
        if (!valid) goto('/login');
        else loadProfile();
      });
    } else {
      loadProfile();
    }
  });

  async function loadProfile() {
    try {
      const profile = await api.getProfile(auth.admin!.masjid_id);
      masjidName = profile.name;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load profile';
    } finally {
      loading = false;
    }
  }
</script>

{#if loading}
  <div class="min-h-dvh flex items-center justify-center bg-bg">
    <Loader class="animate-spin text-accent" size={32} />
  </div>
{:else if error}
  <div class="min-h-dvh flex items-center justify-center bg-bg p-4">
    <div class="text-center">
      <p class="text-red-400 text-lg mb-4">{error}</p>
      <button class="btn-secondary" onclick={() => goto('/login')}>Back to Login</button>
    </div>
  </div>
{:else}
  <AdminShell masjidSlug={data.masjidSlug} masjidName={masjidName}>
    {@render children()}
  </AdminShell>
{/if}
