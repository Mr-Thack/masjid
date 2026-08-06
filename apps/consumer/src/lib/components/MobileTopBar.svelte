<script lang="ts">
  import { getIconComponent } from '$lib/icon-map';
  import { Menu } from 'lucide-svelte';
  import type { NavItem } from '$lib/api';

  let {
    masjid,
    navItems = [],
    theme,
    pathname,
    onToggleDrawer,
  }: {
    masjid: { slug: string; name: string } | null;
    navItems?: NavItem[];
    theme: Record<string, unknown> | null;
    pathname: string;
    onToggleDrawer: () => void;
  } = $props();

  let slug = $derived(masjid?.slug ?? '');

  let highlightedItem = $derived(navItems.find(i => i.is_highlighted));

  function navHref(item: NavItem): string {
    if (item.kind === 'link') return item.external_url!;
    if (item.kind === 'page') return `/${slug}/pages/${item.page_slug}`;
    return `/${slug}${item.route_segment ? `/${item.route_segment}` : ''}`;
  }
</script>

<div class="lg:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
  <a
    href={`/${slug}`}
    class="truncate font-heading font-bold no-underline"
    style="color: var(--color-text);"
  >
    {masjid?.name ?? 'Masjid'}
  </a>
  <div class="flex items-center gap-2">
    {#if highlightedItem}
      <a
        href={navHref(highlightedItem)}
        class="flex items-center gap-1.5 px-2 py-1 text-xs rounded-full no-underline bg-accent/15"
        style="color: var(--color-accent);"
      >
        {#if highlightedItem.icon}
          {@const IconComp = getIconComponent(highlightedItem.icon, highlightedItem.kind)}
          <svelte:component this={IconComp} size={16} />
        {/if}
        {highlightedItem.label}
      </a>
    {/if}
    <button
      class="p-1"
      style="color: var(--color-text-muted);"
      onclick={onToggleDrawer}
      aria-label="Open navigation menu"
    >
      <Menu size={24} />
    </button>
  </div>
</div>