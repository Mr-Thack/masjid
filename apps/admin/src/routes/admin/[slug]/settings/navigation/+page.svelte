<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import {
    Loader, Plus, Trash2, ArrowUp, ArrowDown, GripVertical, X, Check,
    Clock, Newspaper, Info, GraduationCap, Heart, Users, Megaphone, ExternalLink, FileText, Globe
  } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let navItems = $state<any[]>([]);
  let allPages = $state<any[]>([]);
  let showAddRoute = $state(false);
  let showAddLink = $state(false);
  let showAddPage = $state(false);
  let confirmDeleteId = $state<string | null>(null);
  let confirmReset = $state(false);
  let editingLabelId = $state<string | null>(null);
  let editLabelValue = $state('');

  let newRoute = $state({ route_segment: '', label: '', icon: '' });
  let newLink = $state({ external_url: '', label: '', icon: '' });
  let newPage = $state({ slug: '', title: '', raw_markdown: '' });

  $effect(() => { load(); });

  const sortedItems = $derived([...navItems].sort((a, b) => a.sort_order - b.sort_order));

  const AVAILABLE_ROUTES = [
    { segment: 'prayer', label: 'Times', icon: 'Clock' },
    { segment: 'news', label: 'News', icon: 'Newspaper' },
    { segment: 'info', label: 'Info', icon: 'Info' },
    { segment: 'maktab', label: 'Maktab', icon: 'GraduationCap' },
    { segment: 'donate', label: 'Donate', icon: 'Heart' },
    { segment: 'jumuah', label: "Jumu'ah", icon: 'Users' },
    { segment: 'announcements', label: 'Announcements', icon: 'Megaphone' },
  ];

  const unusedRoutes = $derived(
    AVAILABLE_ROUTES.filter(r => !navItems.some(i => i.kind === 'route' && i.route_segment === r.segment))
  );

  const iconMap: Record<string, any> = {
    Clock, Newspaper, Info, GraduationCap, Heart, Users, Megaphone, ExternalLink, FileText, Globe
  };

  async function load() {
    try {
      const [navRes, pagesRes] = await Promise.all([
        api.getNavItems(auth.admin!.masjid_id),
        api.getPages(auth.admin!.masjid_id),
      ]);
      navItems = navRes.nav_items || [];
      allPages = pagesRes.pages || [];
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      loading = false;
    }
  }

  async function addRoute(e: Event) {
    e.preventDefault();
    if (!newRoute.route_segment) return;
    const routeInfo = AVAILABLE_ROUTES.find(r => r.segment === newRoute.route_segment);
    const label = newRoute.label || routeInfo?.label || newRoute.route_segment;
    const icon = newRoute.icon || routeInfo?.icon || '';
    saving = true;
    try {
      await api.createNavItem(auth.admin!.masjid_id, {
        kind: 'route',
        route_segment: newRoute.route_segment,
        label,
        icon,
      });
      showAddRoute = false;
      newRoute = { route_segment: '', label: '', icon: '' };
      toast.success('Route added');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function addLink(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await api.createNavItem(auth.admin!.masjid_id, {
        kind: 'link',
        external_url: newLink.external_url,
        label: newLink.label,
        icon: newLink.icon || null,
      });
      showAddLink = false;
      newLink = { external_url: '', label: '', icon: '' };
      toast.success('Link added');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function addPage(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await api.createPage(auth.admin!.masjid_id, {
        slug: newPage.slug,
        title: newPage.title,
        raw_markdown: newPage.raw_markdown,
      });
      await api.createNavItem(auth.admin!.masjid_id, {
        kind: 'page',
        page_slug: newPage.slug,
        label: newPage.title,
        icon: 'FileText',
      });
      showAddPage = false;
      newPage = { slug: '', title: '', raw_markdown: '' };
      toast.success('Page added');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function toggleField(item: any, field: string, value: boolean) {
    try {
      await api.updateNavItem(auth.admin!.masjid_id, item.id, { [field]: value });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      item[field] = !value; // revert on error
    }
  }

  async function setHighlighted(item: any) {
    const wasHighlighted = item.is_highlighted;
    // Clear all others
    for (const i of navItems) i.is_highlighted = false;
    item.is_highlighted = true;
    try {
      await api.updateNavItem(auth.admin!.masjid_id, item.id, { is_highlighted: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      item.is_highlighted = wasHighlighted;
    }
  }

  function startEditLabel(item: any) {
    editingLabelId = item.id;
    editLabelValue = item.label;
  }

  async function saveLabel(item: any) {
    const newLabel = editLabelValue.trim();
    if (!newLabel) return;
    try {
      await api.updateNavItem(auth.admin!.masjid_id, item.id, { label: newLabel });
      item.label = newLabel;
      editingLabelId = null;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  function cancelEditLabel() {
    editingLabelId = null;
    editLabelValue = '';
  }

  async function deleteItem() {
    if (!confirmDeleteId) return;
    try {
      await api.deleteNavItem(auth.admin!.masjid_id, confirmDeleteId);
      toast.success('Item deleted');
      confirmDeleteId = null;
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function moveItem(item: any, direction: 'up' | 'down') {
    const idx = sortedItems.findIndex(i => i.id === item.id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sortedItems.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = [...sortedItems];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    const newIds = newOrder.map(i => i.id);
    try {
      await api.reorderNavItems(auth.admin!.masjid_id, newIds);
      navItems = newOrder.map((i, si) => ({ ...i, sort_order: si }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function resetToDefaults() {
    saving = true;
    try {
      for (const item of navItems) {
        await api.deleteNavItem(auth.admin!.masjid_id, item.id);
      }
      const defaults = [
        { kind: 'route', route_segment: 'prayer', label: 'Times', icon: 'Clock', is_highlighted: true },
        { kind: 'route', route_segment: 'news', label: 'News', icon: 'Newspaper' },
        { kind: 'route', route_segment: 'info', label: 'Info', icon: 'Info' },
        { kind: 'route', route_segment: 'maktab', label: 'Maktab', icon: 'GraduationCap' },
      ];
      for (const d of defaults) {
        await api.createNavItem(auth.admin!.masjid_id, d);
      }
      toast.success('Reset to defaults');
      confirmReset = false;
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  function kindBadge(kind: string): string {
    if (kind === 'route') return 'Route';
    if (kind === 'page') return 'Page';
    return 'Link';
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-heading font-bold">Navigation</h1>
      <p class="text-text-muted text-sm mt-1">Configure which links appear on your masjid's public page.</p>
    </div>
  </div>

  {#if loading}
    <SkeletonForm fields={4} />
  {:else}
    <!-- Items List -->
    {#if sortedItems.length === 0}
      <div class="bg-surface border border-border rounded-xl p-8 text-center mb-4">
        <p class="text-text-muted">No navigation items configured.</p>
      </div>
    {:else}
      <div class="space-y-3 mb-6">
        {#each sortedItems as item, idx}
          <div class="bg-surface border border-border rounded-xl p-4">
            <div class="flex items-start gap-3">
              <!-- Drag/reorder controls -->
              <div class="flex flex-col gap-0.5 shrink-0 pt-0.5">
                <button
                  class="p-0.5 text-text-muted hover:text-text disabled:opacity-30"
                  disabled={idx === 0}
                  onclick={() => moveItem(item, 'up')}
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  class="p-0.5 text-text-muted hover:text-text disabled:opacity-30"
                  disabled={idx === sortedItems.length - 1}
                  onclick={() => moveItem(item, 'down')}
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              <GripVertical size={14} class="text-text-dim shrink-0 mt-1" />

              <!-- Icon + label -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  {#if item.icon && iconMap[item.icon]}
                    <svelte:component this={iconMap[item.icon]} size={18} class="text-text-muted shrink-0" />
                  {/if}
                  {#if editingLabelId === item.id}
                    <div class="flex items-center gap-1">
                      <input
                        type="text"
                        class="text-sm border border-border rounded px-2 py-0.5 bg-bg"
                        bind:value={editLabelValue}
                        onkeydown={(e) => { if (e.key === 'Enter') saveLabel(item); if (e.key === 'Escape') cancelEditLabel(); }}
                      />
                      <button class="p-1 text-green-400 hover:text-green-300" onclick={() => saveLabel(item)} title="Save"><Check size={14} /></button>
                      <button class="p-1 text-text-muted hover:text-text" onclick={cancelEditLabel} title="Cancel"><X size={14} /></button>
                    </div>
                  {:else}
                    <span class="font-medium text-text">{item.label}</span>
                    <span class="badge text-xs" style="background: var(--color-accent)/10; color: var(--color-accent); border: 1px solid var(--color-accent)/20;">
                      {kindBadge(item.kind)}
                    </span>
                  {/if}
                </div>
                <div class="text-xs text-text-muted mt-0.5">
                  {#if item.kind === 'route' && item.route_segment}{item.route_segment}{/if}
                  {#if item.kind === 'page' && item.page_slug}{item.page_slug}{/if}
                  {#if item.kind === 'link' && item.external_url}{item.external_url}{/if}
                </div>
              </div>

              <!-- Toggles -->
              <div class="flex flex-col gap-1.5 shrink-0 text-xs">
                <label class="flex items-center gap-1.5 text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.show_on_desktop_header}
                    onchange={(e) => {
                      item.show_on_desktop_header = (e.target as HTMLInputElement).checked;
                      toggleField(item, 'show_on_desktop_header', (e.target as HTMLInputElement).checked);
                    }}
                  />
                  Desktop
                </label>
                <label class="flex items-center gap-1.5 text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.show_on_mobile_bottom}
                    onchange={(e) => {
                      item.show_on_mobile_bottom = (e.target as HTMLInputElement).checked;
                      toggleField(item, 'show_on_mobile_bottom', (e.target as HTMLInputElement).checked);
                    }}
                  />
                  Mobile bottom
                </label>
                <label class="flex items-center gap-1.5 text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.is_highlighted}
                    onchange={() => setHighlighted(item)}
                  />
                  Highlight
                </label>
              </div>

              <!-- Edit / Delete -->
              <div class="flex items-center gap-1 shrink-0">
                <button class="btn-secondary text-xs py-1 px-2" onclick={() => startEditLabel(item)}>Edit</button>
                <button class="p-1 text-red-400 hover:text-red-300" onclick={() => confirmDeleteId = item.id}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Add Buttons -->
    <div class="flex flex-wrap gap-2">
      {#if !showAddRoute}
        <button class="btn-secondary text-sm" onclick={() => { showAddRoute = true; showAddLink = false; showAddPage = false; }}>
          <Plus size={16} />
          Add Built-in Route
        </button>
      {/if}
      {#if !showAddPage}
        <button class="btn-secondary text-sm" onclick={() => { showAddPage = true; showAddRoute = false; showAddLink = false; }}>
          <Plus size={16} />
          Add Custom Page
        </button>
      {/if}
      {#if !showAddLink}
        <button class="btn-secondary text-sm" onclick={() => { showAddLink = true; showAddRoute = false; showAddPage = false; }}>
          <Plus size={16} />
          Add External Link
        </button>
      {/if}
      <button class="btn-secondary text-sm" onclick={() => confirmReset = true}>
        Reset to Defaults
      </button>
    </div>

    <!-- Add Route Form -->
    {#if showAddRoute}
      <form onsubmit={addRoute} class="bg-surface border border-accent rounded-xl p-4 mt-4 space-y-3">
        <h3 class="font-heading font-semibold text-sm">Add Built-in Route</h3>
        <div class="form-group">
          <label>Route</label>
          {#if unusedRoutes.length === 0}
            <p class="text-sm text-text-muted">All routes are already in your navigation.</p>
          {:else}
            <div class="flex flex-wrap gap-2 mt-1">
              {#each unusedRoutes as route}
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg text-sm border transition-colors {newRoute.route_segment === route.segment ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted hover:border-accent/50'}"
                  onclick={() => {
                    newRoute = { ...newRoute, route_segment: route.segment, label: route.label, icon: route.icon };
                  }}
                >
                  {#if iconMap[route.icon]}
                    <svelte:component this={iconMap[route.icon]} size={14} class="inline-block mr-1" />
                  {/if}
                  {route.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        {#if newRoute.route_segment}
          <div class="form-group">
            <label>Label</label>
            <input type="text" class="w-full text-sm" bind:value={newRoute.label} maxlength={30} />
          </div>
        {/if}
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" disabled={saving || !newRoute.route_segment}>Add</button>
          <button type="button" class="btn-secondary text-sm" onclick={() => { showAddRoute = false; newRoute = { route_segment: '', label: '', icon: '' }; }}>Cancel</button>
        </div>
      </form>
    {/if}

    <!-- Add Link Form -->
    {#if showAddLink}
      <form onsubmit={addLink} class="bg-surface border border-accent rounded-xl p-4 mt-4 space-y-3">
        <h3 class="font-heading font-semibold text-sm">Add External Link</h3>
        <div class="form-group">
          <label>URL *</label>
          <input type="url" class="w-full text-sm" bind:value={newLink.external_url} placeholder="https://..." required />
        </div>
        <div class="form-group">
          <label>Label *</label>
          <input type="text" class="w-full text-sm" bind:value={newLink.label} maxlength={30} required />
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" disabled={saving}>Add</button>
          <button type="button" class="btn-secondary text-sm" onclick={() => { showAddLink = false; newLink = { external_url: '', label: '', icon: '' }; }}>Cancel</button>
        </div>
      </form>
    {/if}

    <!-- Add Page Form -->
    {#if showAddPage}
      <form onsubmit={addPage} class="bg-surface border border-accent rounded-xl p-4 mt-4 space-y-3">
        <h3 class="font-heading font-semibold text-sm">Add Custom Page</h3>
        <div class="form-group">
          <label>Slug *</label>
          <input type="text" class="w-full text-sm font-mono" bind:value={newPage.slug} placeholder="e.g. about-us" required />
        </div>
        <div class="form-group">
          <label>Title *</label>
          <input type="text" class="w-full text-sm" bind:value={newPage.title} required />
        </div>
        <div class="form-group">
          <label>Content (Markdown)</label>
          <textarea class="w-full text-sm font-mono" bind:value={newPage.raw_markdown} rows={6}></textarea>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" disabled={saving}>Add</button>
          <button type="button" class="btn-secondary text-sm" onclick={() => { showAddPage = false; newPage = { slug: '', title: '', raw_markdown: '' }; }}>Cancel</button>
        </div>
      </form>
    {/if}

    <!-- Existing Custom Pages -->
    {#if allPages.length > 0}
      <div class="mt-8">
        <h2 class="text-lg font-heading font-semibold mb-3">Custom Pages</h2>
        <div class="space-y-2">
          {#each allPages as page}
            <div class="bg-surface border border-border rounded-lg p-3 flex items-center justify-between">
              <div>
                <span class="text-sm font-medium text-text">{page.title}</span>
                <span class="text-xs text-text-muted ml-2">{page.slug}</span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="text-xs text-text-muted hover:text-red-400"
                  onclick={async () => {
                    const inNav = navItems.some(i => i.kind === 'page' && i.page_slug === page.slug);
                    if (inNav) {
                      toast.error('Page is in navigation. Remove the nav item first.');
                      return;
                    }
                    try {
                      await api.deletePage(auth.admin!.masjid_id, page.slug);
                      toast.success('Page deleted');
                      await load();
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : 'Failed');
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<ConfirmDialog
  open={confirmDeleteId !== null}
  title="Delete Nav Item"
  message="This will permanently remove this item from your navigation. This action cannot be undone."
  onConfirm={deleteItem}
  onCancel={() => confirmDeleteId = null}
/>

<ConfirmDialog
  open={confirmReset}
  title="Reset Navigation"
  message="This will delete all your custom navigation items and restore the defaults (Times, News, Info, Maktab). Are you sure?"
  onConfirm={resetToDefaults}
  onCancel={() => confirmReset = false}
/>