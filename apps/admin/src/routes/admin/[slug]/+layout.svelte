<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte';
  import AdminShell from '$lib/components/AdminShell.svelte';
  import { api } from '$lib/api';
  import { Loader } from 'lucide-svelte';
  import { applyTheme, type ThemeInput } from '@masjid/ui-utils';
  import type { Snippet } from 'svelte';

  let { data, children }: { data: { masjidSlug: string }; children: Snippet } = $props();

  let masjidName = $state<string>('');
  let themeData = $state<ThemeInput | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let initDone = $state(false);
  let useTheme = $state(true);

  $effect(() => {
    if (initDone) return;
    initDone = true;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('notheme')) {
        sessionStorage.setItem('admin-notheme', '1');
        useTheme = false;
      } else if (params.has('theme')) {
        sessionStorage.removeItem('admin-notheme');
        useTheme = true;
      } else if (sessionStorage.getItem('admin-notheme')) {
        useTheme = false;
      }
    }

    if (!auth.isAuthenticated) {
      auth.checkAuth().then(valid => {
        if (!valid) goto('/login');
        else loadProfile();
      });
    } else {
      loadProfile();
    }
  });

  $effect(() => {
    if (initDone && !auth.isAuthenticated && !auth.loading) {
      goto('/login');
    }
  });

  $effect(() => {
    if (themeData && useTheme) {
      try {
        applyTheme(themeData);
      } catch {
        // theme caused a crash, silently ignore — admin can use ?notheme to bypass
      }
    }
  });

  async function loadProfile() {
    try {
      const profile = await api.getProfile(auth.admin!.masjid_id);
      if (profile.slug !== data.masjidSlug) {
        loading = false;
        goto(`/admin/${profile.slug}`);
        return;
      }
      masjidName = profile.name;
      themeData = profile.theme ?? null;
      loading = false;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load profile';
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
  <div data-content-ready="">
    <AdminShell masjidSlug={data.masjidSlug} masjidName={masjidName}>
      {@render children()}
    </AdminShell>
  </div>
{/if}
