<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Plus, Trash2, Pin, PinOff, Eye, EyeOff, FileText } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let content = $state<unknown[]>([]);
  let showAdd = $state(false);
  let editingSlug = $state<string | null>(null);
  let confirmDeleteSlug = $state<string | null>(null);

  let filter = $state<'all' | 'post' | 'page'>('all');

  let newItem = $state({ title: '', content_markdown: '', content_type: 'post' as string, slug: '', show_on_homepage: false, show_on_info: false, is_hidden: false });
  let editForm = $state<Record<string, unknown>>({});

  $effect(() => { load(); });

  const filtered = $derived(
    filter === 'all' ? content : content.filter(c => (c as any).content_type === filter)
  );

  async function load() {
    try {
      const res = await api.getContent(auth.admin!.masjid_id);
      content = res.content || [];
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      loading = false;
    }
  }

  async function add(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      const payload = { ...newItem };
      if (!(payload as any).slug) delete (payload as any).slug;
      await api.createContent(auth.admin!.masjid_id, payload);
      showAdd = false;
      newItem = { title: '', content_markdown: '', content_type: 'post', slug: '', show_on_homepage: false, show_on_info: false, is_hidden: false };
      toast.success('Created');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function saveEdit(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await api.updateContent(auth.admin!.masjid_id, editingSlug!, editForm);
      editingSlug = null;
      toast.success('Updated');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function deleteItem() {
    if (!confirmDeleteSlug) return;
    try {
      await api.deleteContent(auth.admin!.masjid_id, confirmDeleteSlug);
      toast.success('Deleted');
      confirmDeleteSlug = null;
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function toggleHomepagePin(item: any) {
    try {
      await api.pinContentHomepage(auth.admin!.masjid_id, item.slug);
      toast.success(item.show_on_homepage ? 'Unpinned from homepage' : 'Pinned to homepage');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function toggleInfoPin(item: any) {
    try {
      await api.pinContentInfo(auth.admin!.masjid_id, item.slug);
      toast.success(item.show_on_info ? 'Unpinned from info' : 'Pinned to info page');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  function startEdit(item: any) {
    editingSlug = item.slug;
    editForm = {
      title: item.title,
      content_markdown: item.content_markdown,
      content_type: item.content_type,
      slug: item.slug,
      show_on_homepage: item.show_on_homepage,
      show_on_info: item.show_on_info,
      is_hidden: item.is_hidden,
    };
  }

  const tabs = [
    { value: 'all', label: 'All' },
    { value: 'post', label: 'Posts' },
    { value: 'page', label: 'Pages' },
  ] as const;
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-heading font-bold">Content</h1>
      <p class="text-text-muted text-sm mt-1">{content.length} total</p>
    </div>
    <div class="flex gap-2">
      <button class="btn-primary text-sm" onclick={() => { showAdd = true; editingSlug = null; newItem = { title: '', content_markdown: '', content_type: 'post', slug: '', show_on_homepage: false, show_on_info: false, is_hidden: false }; }}>
        <Plus size={16} />
        Post
      </button>
      <button class="btn-secondary text-sm" onclick={() => { showAdd = true; editingSlug = null; newItem = { title: '', content_markdown: '', content_type: 'page', slug: '', show_on_homepage: false, show_on_info: false, is_hidden: false }; }}>
        <FileText size={16} />
        Page
      </button>
    </div>
  </div>

  <!-- Filter tabs -->
  <div class="flex gap-1 mb-4">
    {#each tabs as tab}
      <button
        class="px-3 py-1.5 rounded-lg text-sm transition-colors {filter === tab.value ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text'}"
        onclick={() => filter = tab.value}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <SkeletonForm fields={3} />
  {:else}
    {#if showAdd}
      <form onsubmit={add} class="bg-surface border border-border rounded-xl p-4 mb-4 space-y-3">
        <h3 class="font-heading font-semibold text-sm">New {newItem.content_type === 'page' ? 'Page' : 'Post'}</h3>
        {#if newItem.content_type === 'page'}
          <div class="form-group">
            <label>Slug *</label>
            <input type="text" class="w-full text-sm font-mono" bind:value={newItem.slug} placeholder="e.g. about-us" />
          </div>
        {/if}
        <div class="form-group">
          <label>Title *</label>
          <input type="text" class="w-full text-sm" bind:value={newItem.title} required />
        </div>
        <div class="form-group">
          <label>Content (Markdown) *</label>
          <textarea class="w-full text-sm font-mono" bind:value={newItem.content_markdown} required rows={8}></textarea>
        </div>
        {#if newItem.content_type === 'post'}
          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" bind:checked={newItem.show_on_homepage} />
              Show on Homepage
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" bind:checked={newItem.show_on_info} />
              Show on Info Page
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" bind:checked={newItem.is_hidden} />
              Hidden
            </label>
          </div>
        {/if}
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" disabled={saving}>Create</button>
          <button type="button" class="btn-secondary text-sm" onclick={() => showAdd = false}>Cancel</button>
        </div>
      </form>
    {/if}

    {#if filtered.length === 0}
      <div class="bg-surface border border-border rounded-xl p-8 text-center">
        <p class="text-text-muted">No content.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each filtered as item (item.id)}
          <div class="bg-surface border border-border rounded-xl p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="font-medium text-text">{item.title}</span>
                  <span class="badge" style="background: var(--color-accent)/10; color: var(--color-accent); border: 1px solid var(--color-accent)/20;">{item.content_type}</span>
                  {#if item.is_hidden}
                    <span class="badge" style="background: #92400e22; color: #f59e0b; border: 1px solid #92400e44;">Hidden</span>
                  {/if}
                  {#if item.show_on_homepage}
                    <span class="badge" style="background: var(--color-accent)/10; color: var(--color-accent); border: 1px solid var(--color-accent)/20;">Homepage</span>
                  {/if}
                  {#if item.show_on_info}
                    <span class="badge" style="background: var(--color-accent)/10; color: var(--color-accent); border: 1px solid var(--color-accent)/20;">Info</span>
                  {/if}
                </div>
                <p class="text-xs text-text-muted mt-1">
                  Slug: {item.slug} &middot;
                  {#if item.created_at}Created: {new Date(item.created_at as string).toLocaleDateString()}{/if}
                  {#if item.updated_at && (item.updated_at as string) !== (item.created_at as string)} &middot; Updated: {new Date(item.updated_at as string).toLocaleDateString()}{/if}
                </p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                {#if (item as any).content_type === 'post'}
                  <button class="p-1 text-text-muted hover:text-accent {item.show_on_homepage ? 'text-accent' : ''}" onclick={() => toggleHomepagePin(item)} title="Toggle homepage pin">
                    {#if item.show_on_homepage}
                      <PinOff size={14} />
                    {:else}
                      <Pin size={14} />
                    {/if}
                  </button>
                  <button class="p-1 text-text-muted hover:text-accent {item.show_on_info ? 'text-accent' : ''}" onclick={() => toggleInfoPin(item)} title="Toggle info pin">
                    {#if item.show_on_info}
                      <PinOff size={14} />
                    {:else}
                      <Pin size={14} />
                    {/if}
                  </button>
                {/if}
                <button class="btn-secondary text-xs py-1 px-2" onclick={() => { showAdd = false; startEdit(item); }}>Edit</button>
                <button class="p-1 text-red-400 hover:text-red-300" onclick={() => confirmDeleteSlug = item.slug}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#if editingSlug}
        <form onsubmit={saveEdit} class="bg-surface border border-accent rounded-xl p-4 mt-4 space-y-3">
          <h3 class="font-heading font-semibold text-sm">Edit {(editForm.content_type as string) === 'page' ? 'Page' : 'Post'}</h3>
          {#if (editForm.content_type as string) === 'page'}
            <div class="form-group">
              <label>Slug</label>
              <input type="text" class="w-full text-sm font-mono" bind:value={editForm.slug} />
            </div>
          {/if}
          <div class="form-group">
            <label>Title</label>
            <input type="text" class="w-full text-sm" bind:value={editForm.title} />
          </div>
          <div class="form-group">
            <label>Content (Markdown)</label>
            <textarea class="w-full text-sm font-mono" bind:value={editForm.content_markdown} rows={8}></textarea>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select class="w-full text-sm" bind:value={editForm.content_type}>
              <option value="post">Post</option>
              <option value="page">Page</option>
            </select>
          </div>
          {#if (editForm.content_type as string) === 'post'}
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={editForm.show_on_homepage} />
                Show on Homepage
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={editForm.show_on_info} />
                Show on Info Page
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={editForm.is_hidden} />
                Hidden
              </label>
            </div>
          {/if}
          <div class="flex gap-2">
            <button type="submit" class="btn-primary text-sm" disabled={saving}>Save</button>
            <button type="button" class="btn-secondary text-sm" onclick={() => editingSlug = null}>Cancel</button>
          </div>
        </form>
      {/if}
    {/if}
  {/if}
</div>

<ConfirmDialog
  open={confirmDeleteSlug !== null}
  title="Delete Content"
  message="This will permanently delete this item. This action cannot be undone."
  onConfirm={deleteItem}
  onCancel={() => confirmDeleteSlug = null}
/>