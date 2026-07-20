<script lang="ts">
  import { page } from '$app/stores';
  import { beforeNavigate } from '$app/navigation';
  import type { Snippet } from 'svelte';
  import { applyTheme } from '$lib/theme/context.svelte.ts';

  let { children }: { children: Snippet } = $props();

  let pathname = $state('/');

  $effect(() => {
    const unsubscribe = page.subscribe(($page) => {
      pathname = $page.url.pathname;
    });
    return unsubscribe;
  });

  let transitioning = $state(false);

  beforeNavigate(() => {
    transitioning = true;
    return () => {
      setTimeout(() => {
        transitioning = false;
      }, 300);
    };
  });

  let masjid = $derived($page.data.masjid);
  let theme = $derived($page.data.theme);

  $effect(() => {
    applyTheme(theme);
  });

  function isActive(segment: string): boolean {
    const slug = masjid?.slug ?? '';
    const base = `/${slug}`;
    if (segment === 'home') return pathname === base || pathname === `${base}/`;
    return pathname.startsWith(`${base}/${segment}`);
  }

  function navHref(segment: string): string {
    return `/${masjid?.slug ?? ''}${segment ? `/${segment}` : ''}`;
  }
</script>

<svelte:head>
  <title>{masjid?.name ?? 'Masjid'}</title>
  {#if masjid?.city}
    <meta name="description" content="Prayer times, announcements, and more for {masjid.name} in {masjid.city}." />
  {:else}
    <meta name="description" content="Prayer times, announcements, and more." />
  {/if}
</svelte:head>

<div
  class="min-h-dvh flex flex-col"
  style="background-color: var(--color-bg); color: var(--color-text);"
>
  <header
    class="sticky top-0 z-50 glass border-b border-white/5"
    style="border-top: 3px solid var(--color-primary);"
  >
    <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href={navHref('')} class="flex items-center gap-3 no-underline">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold bg-primary text-white">
          {masjid?.name?.charAt(0) ?? 'M'}
        </div>
        <div class="flex flex-col">
          <span class="text-lg font-bold leading-tight font-heading" style="color: var(--color-text);">
            {masjid?.name ?? 'Masjid'}
          </span>
          {#if masjid?.city}
            <span class="text-xs" style="color: var(--color-text-muted);">{masjid.city}</span>
          {/if}
        </div>
      </a>
    </div>
  </header>

  <main
    class="flex-1 max-w-4xl mx-auto w-full px-4 py-6 pb-24"
    class:opacity-0={transitioning}
    class:opacity-100={!transitioning}
    style="transition: opacity 0.2s ease;"
  >
    {@render children()}
  </main>

  <nav
    class="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5"
    style="padding-bottom: var(--safe-bottom);"
  >
    <div class="max-w-4xl mx-auto flex items-center justify-around py-2 px-4">
      <a
        href={navHref('')}
        class="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors no-underline {isActive('home') ? 'bg-white/5' : ''}"
        style="color: {isActive('home') ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span class="text-[10px] font-medium">Home</span>
      </a>

      <a
        href={navHref('prayer')}
        class="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors no-underline {isActive('prayer') ? 'bg-white/5' : ''}"
        style="color: {isActive('prayer') ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-[10px] font-medium">Prayer</span>
      </a>

      <a
        href={navHref('jumuah')}
        class="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors no-underline {isActive('jumuah') ? 'bg-white/5' : ''}"
        style="color: {isActive('jumuah') ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span class="text-[10px] font-medium">Jumu'ah</span>
      </a>

      <a
        href={navHref('announcements')}
        class="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors no-underline {isActive('announcements') ? 'bg-white/5' : ''}"
        style="color: {isActive('announcements') ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        <span class="text-[10px] font-medium">News</span>
      </a>
    </div>
  </nav>
</div>