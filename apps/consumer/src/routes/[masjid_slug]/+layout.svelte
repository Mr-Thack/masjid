<script lang="ts">
  import { page } from '$app/stores';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import type { Snippet } from 'svelte';
  import { applyTheme } from '$lib/theme/context.svelte.ts';
  import { ambientPhaseFor } from '$lib/ambient';
  import { deviceThemePref } from '$lib/theme/device-pref.svelte.ts';
  import Rosette from '@masjid/ui-utils/components/Rosette.svelte';
  import StarBand from '@masjid/ui-utils/components/StarBand.svelte';
  import { resolveStyleSystem, resolveStyleOptions, parseStyleOptions, type ThemeInput } from '@masjid/ui-utils';

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

  let opts = $derived(resolveStyleOptions(parseStyleOptions(theme?.style_options ?? null)));

  let devicePref = $derived(deviceThemePref.current);
  // Mishkaat reads light/dark from style_options.themeMode; Sakeenah uses
  // layout_preset ('minimal-light' vs 'glass-dark').
  let adminMode = $derived(resolveStyleSystem(theme) === 'mishkaat'
    ? opts.themeMode
    : theme?.layout_preset === 'minimal-light' ? 'light' : 'dark');
  let effectiveMode = $derived(deviceThemePref.resolve(adminMode));

  let effectiveTheme = $derived.by<ThemeInput | null>(() => {
    if (!theme) return null;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(theme)) {
      result[key] = (theme as Record<string, unknown>)[key];
    }
    const effective = Object.keys(result).length > 0 ? result : theme;
    let rawOpts = effective.style_options;
    let parsed = typeof rawOpts === 'string'
      ? rawOpts
      : (rawOpts && typeof rawOpts === 'object' ? structuredClone(rawOpts) : {});
    if (typeof parsed === 'object' && parsed !== null) {
      (parsed as Record<string, unknown>).themeMode = effectiveMode;
    } else {
      parsed = { themeMode: effectiveMode };
    }
    effective.style_options = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    if (resolveStyleSystem(theme as ThemeInput) === 'sakeenah') {
      effective.layout_preset = effectiveMode === 'light' ? 'minimal-light' : 'glass-dark';
    }
    return effective as ThemeInput;
  });

  $effect(() => {
    if (effectiveTheme) {
      applyTheme(effectiveTheme);
      if (typeof document !== 'undefined' && resolveStyleSystem(theme) === 'mishkaat') {
        document.documentElement.setAttribute('data-theme-mode', effectiveMode);
      }
    }
  });

  let embed = $derived($page.url.searchParams.has('embed'));

  // Mishkaat (docs/design-language.md §7.11): style-system branch for the
  // ornament layer — Sakeenah markup stays exactly as before.
  let mishkaat = $derived(resolveStyleSystem(theme) === 'mishkaat');

  let now = $state(new Date());
  $effect(() => {
    const t = setInterval(() => {
      now = new Date();
    }, 60_000);
    return () => clearInterval(t);
  });

  // Ambient palette (§7.4, mild mobile version): one background tint per
  // solar phase, driven by the same shared helper as the TV.
  let ambientPhase = $derived(ambientPhaseFor(theme, $page.data.prayer_times, now));

  const navItems = $derived.by(() => {
    const fromApi = $page.data.nav_items;
    if (fromApi && fromApi.length > 0) {
      const items: Array<{ segment: string; label: string; icon: string; kind: string; page_slug?: string; external_url?: string; show_on_desktop_header: boolean; show_on_mobile_bottom: boolean }> = [
        { segment: '', label: 'Home', icon: 'Home', kind: 'route', show_on_desktop_header: true, show_on_mobile_bottom: true },
      ];
      for (const ni of fromApi) {
        const seg = ni.kind === 'route' ? (ni.route_segment ?? '') : '';
        items.push({
          segment: seg,
          label: ni.label,
          icon: ni.icon ?? '',
          kind: ni.kind,
          page_slug: ni.page_slug ?? undefined,
          external_url: ni.external_url ?? undefined,
          show_on_desktop_header: ni.show_on_desktop_header,
          show_on_mobile_bottom: ni.show_on_mobile_bottom,
        });
      }
      return items;
    }
    // fallback defaults
    return [
      { segment: '', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', kind: 'route', show_on_desktop_header: true, show_on_mobile_bottom: true },
      { segment: 'prayer', label: 'Times', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', kind: 'route', show_on_desktop_header: true, show_on_mobile_bottom: true },
      { segment: 'news', label: 'News', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z', kind: 'route', show_on_desktop_header: true, show_on_mobile_bottom: true },
      { segment: 'info', label: 'Info', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', kind: 'route', show_on_desktop_header: true, show_on_mobile_bottom: true },
      { segment: 'maktab', label: 'Maktab', icon: 'M12 14l9-5-9-5-9 5 9 5z M5 15l7 4 7-4', kind: 'route', show_on_desktop_header: true, show_on_mobile_bottom: true },
    ];
  });

  const ICON_PATHS: Record<string, string> = {
    Home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    Clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    Newspaper: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
    Info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    GraduationCap: 'M12 14l9-5-9-5-9 5 9 5z M5 15l7 4 7-4',
    Heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    Users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    Megaphone: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
    ExternalLink: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
    FileText: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  };

  function iconPath(item: { icon: string }): string {
    return ICON_PATHS[item.icon] ?? ICON_PATHS.Info;
  }

  function isActive(segment: string, kind?: string, page_slug?: string): boolean {
    const slug = masjid?.slug ?? '';
    const base = `/${slug}`;
    if (kind === 'link') return false;
    if (kind === 'page' && page_slug) return pathname.startsWith(`${base}/pages/${page_slug}`);
    if (segment === '') return pathname === base || pathname === `${base}/`;
    if (segment === 'news') return pathname.startsWith(`${base}/news`) || pathname.startsWith(`${base}/posts/`);
    return pathname.startsWith(`${base}/${segment}`);
  }

  function navHref(segment: string, kind?: string, page_slug?: string, external_url?: string): string {
    const slug = masjid?.slug ?? '';
    if (kind === 'link' && external_url) return external_url;
    if (kind === 'page' && page_slug) return `/${slug}/pages/${page_slug}`;
    return `/${slug}${segment ? `/${segment}` : ''}`;
  }

  const themeIcons: Record<string, string> = {
    light: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    dark: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  };
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
  class="min-h-dvh flex flex-col c-app"
  data-ambient-phase={ambientPhase ?? undefined}
  data-content-ready={masjid != null ? '' : undefined}
>
  {#if !embed}
    <header
      class="sticky top-0 z-50 glass border-b"
      style="border-top: 3px solid var(--color-primary); border-color: var(--color-border);"
    >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
      <a href={navHref('')} class="flex items-center gap-3 no-underline min-w-0">
        {#if opts.logoUrl}
          <img class="c-logo-img" src={opts.logoUrl} alt="{masjid?.name ?? 'Masjid'} logo" />
        {:else if mishkaat}
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
        {#each navItems.filter(i => i.show_on_desktop_header !== false) as item}
          <a
            href={navHref(item.segment, item.kind, item.page_slug, item.external_url)}
            aria-current={isActive(item.segment, item.kind, item.page_slug) ? 'page' : undefined}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline {isActive(item.segment, item.kind, item.page_slug) ? 'bg-white/5' : ''}"
            style="color: {isActive(item.segment, item.kind, item.page_slug) ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" class="h-[18px] w-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath(item)} />
            </svg>
            {item.label}
          </a>
        {/each}
      </nav>

      <button
        class="shrink-0 p-2 rounded-lg transition-colors hover:bg-white/5"
        style="color: var(--color-text-muted);"
        onclick={() => deviceThemePref.toggle()}
        title="Toggle light/dark mode ({effectiveMode})"
        aria-label="Toggle light/dark mode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={themeIcons[effectiveMode] ?? themeIcons.dark} />
        </svg>
      </button>
    </div>
    {#if mishkaat}
      <div class="c-starband-strip" aria-hidden="true">
        <StarBand band={26} />
      </div>
    {/if}
  </header>
  {/if}

  <main
    class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 {embed ? 'pb-6' : 'pb-24 lg:pb-8'} {transitioning ? 'opacity-50' : 'opacity-100'}"
    style="transition: opacity 0.2s ease;"
  >
    {@render children()}
  </main>

  {#if !embed}
  <footer class="c-ftr">
    <div class="c-ftr-band" aria-hidden="true">
      <StarBand band={16} />
    </div>
    <div class="c-ftr-body" style="color: var(--color-text-muted); font-size: 0.8rem;">
      <span class="c-ftr-name" style="font-weight: 600;">{masjid?.name ?? 'Masjid'}</span>
      {#if masjid?.city || masjid?.state}
        <Rosette size={12} />
        <span>{[masjid?.city, masjid?.state].filter(Boolean).join(', ')}</span>
      {/if}
      {#if masjid?.contact_phone || masjid?.contact_email}
        <span>{[masjid?.contact_phone, masjid?.contact_email].filter(Boolean).join(' · ')}</span>
      {/if}
    </div>
  </footer>

  <nav
    class="fixed bottom-0 left-0 right-0 z-50 glass border-t lg:hidden"
    style="padding-bottom: var(--safe-bottom); border-color: var(--color-border);"
    aria-label="Mobile navigation"
  >
    <div class="max-w-7xl mx-auto flex items-center justify-around py-2 px-4">
      {#each navItems.filter(i => i.show_on_mobile_bottom !== false) as item}
        <a
          href={navHref(item.segment, item.kind, item.page_slug, item.external_url)}
          aria-current={isActive(item.segment, item.kind, item.page_slug) ? 'page' : undefined}
          class="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors no-underline {isActive(item.segment, item.kind, item.page_slug) ? 'bg-white/5' : ''}"
          style="color: {isActive(item.segment, item.kind, item.page_slug) ? 'var(--color-accent)' : 'var(--color-text-muted)'};"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath(item)} />
          </svg>
          <span class="text-[10px] font-medium">{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>
  {/if}
</div>
