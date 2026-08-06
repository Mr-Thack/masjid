<script lang="ts">
  import { getIconComponent } from '$lib/icon-map';
  import { resolveStyleSystem } from '@masjid/ui-utils';
  import Rosette from '@masjid/ui-utils/components/Rosette.svelte';
  import StarBand from '@masjid/ui-utils/components/StarBand.svelte';
  import { Menu } from 'lucide-svelte';
  import type { NavItem } from '$lib/api';

  let {
    masjid,
    navItems = [],
    theme,
    pathname,
  }: {
    masjid: { slug: string; name: string } | null;
    navItems?: NavItem[];
    theme: Record<string, unknown> | null;
    pathname: string;
  } = $props();

  let dropdownOpen = $state(false);
  let slug = $derived(masjid?.slug ?? '');
  let mishkaat = $derived(resolveStyleSystem(theme) === 'mishkaat');

  let desktopItems = $derived(navItems.filter(i => i.show_on_desktop_header !== false));
  let hasOverflow = $derived(desktopItems.length > 5);
  let visibleCount = $derived(hasOverflow ? 4 : Math.min(desktopItems.length, 5));
  let shownItems = $derived(desktopItems.slice(0, visibleCount));
  let overflowItems = $derived(desktopItems.slice(4));

  function navHref(item: NavItem): string {
    if (item.kind === 'link') return item.external_url!;
    if (item.kind === 'page') return `/${slug}/pages/${item.page_slug}`;
    return `/${slug}${item.route_segment ? `/${item.route_segment}` : ''}`;
  }

  function isActive(item: NavItem): boolean {
    const base = `/${slug}`;
    if (item.kind === 'link') return false;
    if (item.kind === 'page') return pathname.startsWith(`${base}/pages/${item.page_slug}`);
    const segment = item.route_segment ?? '';
    if (segment === '') return pathname === base || pathname === `${base}/`;
    if (segment === 'news') return pathname.startsWith(`${base}/news`) || pathname.startsWith(`${base}/posts/`);
    return pathname.startsWith(`${base}/${segment}`);
  }

  function closeDropdown() {
    dropdownOpen = false;
  }

  $effect(() => {
    if (!dropdownOpen) return;
    function handler(e: MouseEvent) {
      if (!(e.target instanceof Element)) return;
      const dropdown = document.getElementById('nav-dropdown');
      const trigger = document.getElementById('nav-overflow-btn');
      if (dropdown && !dropdown.contains(e.target) && trigger && !trigger.contains(e.target)) {
        closeDropdown();
      }
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  });
</script>

<header class="hidden lg:block sticky top-0 z-50 glass border-b" style="border-top: 3px solid var(--color-primary); border-color: var(--color-border);">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
    <a href={navHref({ kind: 'route', route_segment: '', label: '', is_highlighted: false, show_on_desktop_header: true, show_on_mobile_bottom: true } as NavItem)} class="flex items-center gap-3 no-underline min-w-0">
      {#if mishkaat}
        <div class="c-header-rosette" aria-hidden="true">
          <Rosette size={20} stroke />
        </div>
      {:else}
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold bg-primary text-white flex-shrink-0">
          {masjid?.name?.charAt(0) ?? 'M'}
        </div>
      {/if}
      <div class="flex flex-col min-w-0">
        <span class="text-lg font-bold leading-tight font-heading truncate" style="color: var(--color-text);">
          {masjid?.name ?? 'Masjid'}
        </span>
      </div>
    </a>

    <nav class="hidden lg:flex items-center gap-1" aria-label="Main navigation">
      {#each shownItems as item}
        {#if item.is_highlighted}
          <a
            href={navHref(item)}
            aria-current={isActive(item) ? 'page' : undefined}
            class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors no-underline bg-accent/15"
            style="color: var(--color-accent);"
          >
            {#if item.icon}
              {@const IconComp = getIconComponent(item.icon, item.kind)}
              <svelte:component this={IconComp} size={18} />
            {/if}
            {item.label}
          </a>
        {:else}
          <a
            href={navHref(item)}
            aria-current={isActive(item) ? 'page' : undefined}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline {isActive(item) ? 'bg-white/5' : ''}"
            style="color: {isActive(item) ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
          >
            {#if item.icon}
              {@const IconComp = getIconComponent(item.icon, item.kind)}
              <svelte:component this={IconComp} size={18} />
            {/if}
            {item.label}
          </a>
        {/if}
      {/each}

      {#if hasOverflow}
        <div class="relative">
          <button
            id="nav-overflow-btn"
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style="color: var(--color-text-muted);"
            onclick={() => (dropdownOpen = !dropdownOpen)}
            aria-label="More navigation items"
          >
            <Menu size={18} />
          </button>

          {#if dropdownOpen}
            <div
              id="nav-dropdown"
              class="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-lg shadow-lg p-2 z-50"
            >
              {#each overflowItems as item}
                <a
                  href={navHref(item)}
                  onclick={closeDropdown}
                  class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm no-underline {isActive(item) ? 'bg-white/5' : ''}"
                  style="color: {isActive(item) ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
                >
                  {#if item.icon}
                    {@const IconComp = getIconComponent(item.icon, item.kind)}
                    <svelte:component this={IconComp} size={18} />
                  {/if}
                  {item.label}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </nav>
  </div>

  {#if mishkaat}
    <div class="c-starband-strip" aria-hidden="true">
      <StarBand band={26} />
    </div>
  {/if}
</header>