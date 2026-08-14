<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    LayoutDashboard, Sparkles, Building2, Palette, Clock, Users, Megaphone,
    Globe, History, UserCog, BookOpen, Menu, X, LogOut, ChevronDown, FileText, Compass, Plug, Heart
  } from 'lucide-svelte';
  import { auth } from '$lib/auth.svelte';
  import type { Snippet } from 'svelte';

  let { masjidSlug, masjidName = 'Masjid', children }:
    { masjidSlug: string; masjidName?: string; children: Snippet } = $props();

  let sidebarOpen = $state(false);

  const navItems = [
    { href: `/admin/${masjidSlug}`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/admin/${masjidSlug}/bot`, label: 'AI Assistant', icon: Sparkles },
    { type: 'section' as const, label: 'Settings' },
    { href: `/admin/${masjidSlug}/settings/profile`, label: 'Profile', icon: Building2 },
    { href: `/admin/${masjidSlug}/settings/theme`, label: 'Theme', icon: Palette },
    { href: `/admin/${masjidSlug}/settings/navigation`, label: 'Navigation', icon: Compass },
    { href: `/admin/${masjidSlug}/settings/donations`, label: 'Donations', icon: Heart },
    { href: `/admin/${masjidSlug}/settings/prayer`, label: 'Prayer Rules', icon: Clock },
    { href: `/admin/${masjidSlug}/settings/jumuah`, label: "Jumu'ah", icon: Users },
    { href: `/admin/${masjidSlug}/settings/maktab`, label: 'Maktab', icon: BookOpen },
    { href: `/admin/${masjidSlug}/settings/announcements`, label: 'Announcements', icon: Megaphone },
    { href: `/admin/${masjidSlug}/settings/content`, label: 'Content', icon: FileText },
    { href: `/admin/${masjidSlug}/settings/integrations`, label: 'Integrations', icon: Plug },
    { href: `/admin/${masjidSlug}/settings/domain`, label: 'Domain', icon: Globe },
    { href: `/admin/${masjidSlug}/settings/snapshots`, label: 'Snapshots', icon: History },
    { href: `/admin/${masjidSlug}/settings/account`, label: 'Account', icon: UserCog },
  ];

  let currentPath = $derived($page.url.pathname);

  function isActive(path: string): boolean {
    if (path === `/admin/${masjidSlug}`) return currentPath === path;
    return currentPath.startsWith(path);
  }

  function handleLogout() {
    auth.logout();
    goto('/login');
  }
</script>

<div class="flex min-h-dvh">
  <!-- Sidebar overlay -->
  {#if sidebarOpen}
    <div
      class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      onclick={() => sidebarOpen = false}
    ></div>
  {/if}

  <!-- Sidebar -->
  <aside
    class="fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col transform transition-transform duration-200 lg:relative lg:translate-x-0 {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
  >
    <div class="flex items-center justify-between p-4 border-b border-border">
      <span class="font-heading font-semibold text-text truncate">{masjidName}</span>
      <button class="lg:hidden text-text-muted hover:text-text p-1" onclick={() => sidebarOpen = false}>
        <X size={20} />
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto p-3 space-y-1">
      {#each navItems as item}
        {#if item.type === 'section'}
          <div class="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
            {item.label}
          </div>
        {:else}
          <a
            href={item.href}
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors {isActive(item.href) ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text hover:bg-bg'}"
            onclick={() => sidebarOpen = false}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </a>
        {/if}
      {/each}
    </nav>

    <div class="p-3 border-t border-border">
      <button
        class="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
        onclick={handleLogout}
      >
        <LogOut size={18} />
        <span>Sign Out</span>
      </button>
    </div>
  </aside>

  <!-- Main content -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Topbar (mobile) -->
    <header class="lg:hidden flex items-center gap-4 p-4 border-b border-border bg-surface">
      <button class="text-text-muted hover:text-text p-1" onclick={() => sidebarOpen = true}>
        <Menu size={24} />
      </button>
      <span class="font-heading font-semibold text-text truncate">{masjidName}</span>
    </header>

    <main class="flex-1 p-4 lg:p-6 overflow-y-auto">
      {@render children()}
    </main>
  </div>
</div>
