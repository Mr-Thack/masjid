<script lang="ts">
  import { getIconComponent } from '$lib/icon-map';
  import { X } from 'lucide-svelte';
  import type { NavItem } from '$lib/api';

  let {
    navItems = [],
    masjidSlug,
    pathname,
    isOpen,
    onClose,
  }: {
    navItems?: NavItem[];
    masjidSlug: string;
    pathname: string;
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  function navHref(item: NavItem): string {
    if (item.kind === 'link') return item.external_url!;
    if (item.kind === 'page') return `/${masjidSlug}/pages/${item.page_slug}`;
    return `/${masjidSlug}${item.route_segment ? `/${item.route_segment}` : ''}`;
  }

  function isActive(item: NavItem): boolean {
    const base = `/${masjidSlug}`;
    if (item.kind === 'link') return false;
    if (item.kind === 'page') return pathname.startsWith(`${base}/pages/${item.page_slug}`);
    const segment = item.route_segment ?? '';
    if (segment === '') return pathname === base || pathname === `${base}/`;
    if (segment === 'news') return pathname.startsWith(`${base}/news`) || pathname.startsWith(`${base}/posts/`);
    return pathname.startsWith(`${base}/${segment}`);
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40 bg-black/50" onclick={onClose}></div>

  <aside class="fixed inset-y-0 right-0 z-50 w-72 bg-surface border-l border-border flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-border">
      <span class="font-heading font-semibold" style="color: var(--color-text);">Menu</span>
      <button
        class="p-1 rounded-lg"
        style="color: var(--color-text-muted);"
        onclick={onClose}
        aria-label="Close navigation menu"
      >
        <X size={20} />
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto p-3 space-y-1">
      {#each navItems as item}
        <a
          href={navHref(item)}
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors no-underline {isActive(item) ? 'bg-accent/15' : ''}"
          style="color: {isActive(item) ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
          onclick={onClose}
        >
          {#if item.icon}
            {@const IconComp = getIconComponent(item.icon, item.kind)}
            <svelte:component this={IconComp} size={20} />
          {/if}
          <span class="text-sm font-medium">{item.label}</span>
        </a>
      {/each}
    </nav>
  </aside>
{/if}