<script lang="ts">
  import { getIconComponent } from '$lib/icon-map';
  import type { NavItem } from '$lib/api';

  let {
    navItems = [],
    masjidSlug,
    pathname,
  }: {
    navItems?: NavItem[];
    masjidSlug: string;
    pathname: string;
  } = $props();

  let bottomItems = $derived(
    navItems
      .filter(i => i.show_on_mobile_bottom !== false)
      .slice(0, 5),
  );

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

<nav
  class="fixed bottom-0 left-0 right-0 z-50 glass border-t lg:hidden"
  style="padding-bottom: var(--safe-bottom); border-color: var(--color-border);"
  aria-label="Mobile navigation"
>
  <div class="max-w-7xl mx-auto flex items-center justify-around py-2 px-4">
    {#each bottomItems as item}
      <a
        href={navHref(item)}
        aria-current={isActive(item) ? 'page' : undefined}
        class="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors no-underline {isActive(item) ? 'bg-white/5' : ''}"
        style="color: {isActive(item) ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
      >
        {#if item.icon}
          {@const IconComp = getIconComponent(item.icon, item.kind)}
          <svelte:component this={IconComp as any} size={20} />
        {/if}
        <span class="text-[10px] font-medium">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>