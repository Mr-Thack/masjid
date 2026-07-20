<script lang="ts">
  import { page } from '$app/stores';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
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
  });

  afterNavigate(() => {
    transitioning = false;
  });

  let masjid = $derived($page.data.masjid);
  let theme = $derived($page.data.theme);

  $effect(() => {
    applyTheme(theme);
  });

  const navItems = [
    {
      segment: '',
      label: 'Home',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      segment: 'prayer',
      label: 'Prayer',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      segment: 'announcements',
      label: 'News',
      icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
    },
    {
      segment: 'info',
      label: 'Info',
      icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  ];

  function isActive(segment: string): boolean {
    const slug = masjid?.slug ?? '';
    const base = `/${slug}`;
    if (segment === '') return pathname === base || pathname === `${base}/`;
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
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
      <a href={navHref('')} class="flex items-center gap-3 no-underline min-w-0">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold bg-primary text-white flex-shrink-0">
          {masjid?.name?.charAt(0) ?? 'M'}
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-lg font-bold leading-tight font-heading truncate" style="color: var(--color-text);">
            {masjid?.name ?? 'Masjid'}
          </span>
        </div>
      </a>

      <nav class="hidden lg:flex items-center gap-1" aria-label="Main navigation">
        {#each navItems as item}
          <a
            href={navHref(item.segment)}
            aria-current={isActive(item.segment) ? 'page' : undefined}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline {isActive(item.segment) ? 'bg-white/5' : ''}"
            style="color: {isActive(item.segment) ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" class="h-[18px] w-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
            </svg>
            {item.label}
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <main
    class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 {transitioning ? 'opacity-50' : 'opacity-100'}"
    style="transition: opacity 0.2s ease;"
  >
    {@render children()}
  </main>

  <nav
    class="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 lg:hidden"
    style="padding-bottom: var(--safe-bottom);"
    aria-label="Mobile navigation"
  >
    <div class="max-w-7xl mx-auto flex items-center justify-around py-2 px-4">
      {#each navItems as item}
        <a
          href={navHref(item.segment)}
          aria-current={isActive(item.segment) ? 'page' : undefined}
          class="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors no-underline {isActive(item.segment) ? 'bg-white/5' : ''}"
          style="color: {isActive(item.segment) ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
          </svg>
          <span class="text-[10px] font-medium">{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>
</div>
