<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Plus, Trash2, Pin, PinOff, Eye, EyeOff, Newspaper } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let posts = $state<unknown[]>([]);
  let showAdd = $state(false);
  let editingSlug = $state<string | null>(null);
  let confirmDeleteSlug = $state<string | null>(null);

  let filter = $state<'all' | 'visible' | 'hidden'>('all');

  let newPost = $state({ title: '', content_markdown: '', show_on_homepage: false, show_on_info: false, is_hidden: false });
  let editForm = $state<Record<string, unknown>>({});

  $effect(() => { load(); });

  const filtered = $derived(
    filter === 'all' ? posts : filter === 'hidden' ? posts.filter(p => (p as any).is_hidden) : posts.filter(p => !(p as any).is_hidden)
  );

  async function load() {
    try {
      const res = await api.getPosts(auth.admin!.masjid_id);
      posts = res.posts || [];
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
      await api.createPost(auth.admin!.masjid_id, { ...newPost });
      showAdd = false;
      newPost = { title: '', content_markdown: '', show_on_homepage: false, show_on_info: false, is_hidden: false };
      toast.success('Post created');
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
      await api.updatePost(auth.admin!.masjid_id, editingSlug!, editForm);
      editingSlug = null;
      toast.success('Post updated');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function deletePost() {
    if (!confirmDeleteSlug) return;
    try {
      await api.deletePost(auth.admin!.masjid_id, confirmDeleteSlug);
      toast.success('Post deleted');
      confirmDeleteSlug = null;
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function toggleHomepagePin(post: any) {
    try {
      await api.pinPostHomepage(auth.admin!.masjid_id, post.slug);
      toast.success(post.show_on_homepage ? 'Unpinned from homepage' : 'Pinned to homepage');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function toggleInfoPin(post: any) {
    try {
      await api.pinPostInfo(auth.admin!.masjid_id, post.slug);
      toast.success(post.show_on_info ? 'Unpinned from info' : 'Pinned to info page');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  function startEdit(post: any) {
    editingSlug = post.slug;
    editForm = {
      title: post.title,
      content_markdown: post.content_markdown,
      show_on_homepage: post.show_on_homepage,
      show_on_info: post.show_on_info,
      is_hidden: post.is_hidden,
    };
  }

  const tabs = [
    { value: 'all', label: 'All' },
    { value: 'visible', label: 'Visible' },
    { value: 'hidden', label: 'Hidden' },
  ] as const;
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-heading font-bold">Posts</h1>
      <p class="text-text-muted text-sm mt-1">{posts.length} total</p>
    </div>
    <button class="btn-primary text-sm" onclick={() => { showAdd = true; editingSlug = null; }}>
      <Plus size={16} />
      New
    </button>
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
        <h3 class="font-heading font-semibold text-sm">New Post</h3>
        <div class="form-group">
          <label>Title *</label>
          <input type="text" class="w-full text-sm" bind:value={newPost.title} required />
        </div>
        <div class="form-group">
          <label>Content (Markdown) *</label>
          <textarea class="w-full text-sm font-mono" bind:value={newPost.content_markdown} required rows={8}></textarea>
        </div>
        <div class="flex flex-wrap gap-4">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={newPost.show_on_homepage} />
            Show on Homepage
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={newPost.show_on_info} />
            Show on Info Page
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={newPost.is_hidden} />
            Hidden
          </label>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" disabled={saving}>Create</button>
          <button type="button" class="btn-secondary text-sm" onclick={() => showAdd = false}>Cancel</button>
        </div>
      </form>
    {/if}

    {#if filtered.length === 0}
      <div class="bg-surface border border-border rounded-xl p-8 text-center">
        <p class="text-text-muted">No {filter === 'all' ? '' : filter} posts.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each filtered as post (post.id)}
          <div class="bg-surface border border-border rounded-xl p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="font-medium text-text">{post.title}</span>
                  {#if post.is_hidden}
                    <span class="badge" style="background: #92400e22; color: #f59e0b; border: 1px solid #92400e44;">Hidden</span>
                  {/if}
                  {#if post.show_on_homepage}
                    <span class="badge" style="background: var(--color-accent)/10; color: var(--color-accent); border: 1px solid var(--color-accent)/20;">Homepage</span>
                  {/if}
                  {#if post.show_on_info}
                    <span class="badge" style="background: var(--color-accent)/10; color: var(--color-accent); border: 1px solid var(--color-accent)/20;">Info</span>
                  {/if}
                </div>
                <p class="text-xs text-text-muted mt-1">
                  Slug: {post.slug} &middot;
                  {#if post.created_at}Created: {new Date(post.created_at as string).toLocaleDateString()}{/if}
                  {#if post.updated_at && (post.updated_at as string) !== (post.created_at as string)} &middot; Updated: {new Date(post.updated_at as string).toLocaleDateString()}{/if}
                </p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button class="p-1 text-text-muted hover:text-accent {post.show_on_homepage ? 'text-accent' : ''}" onclick={() => toggleHomepagePin(post)} title="Toggle homepage pin">
                  {#if post.show_on_homepage}
                    <PinOff size={14} />
                  {:else}
                    <Pin size={14} />
                  {/if}
                </button>
                <button class="p-1 text-text-muted hover:text-accent {post.show_on_info ? 'text-accent' : ''}" onclick={() => toggleInfoPin(post)} title="Toggle info pin">
                  {#if post.show_on_info}
                    <PinOff size={14} />
                  {:else}
                    <Pin size={14} />
                  {/if}
                </button>
                <button class="btn-secondary text-xs py-1 px-2" onclick={() => { showAdd = false; startEdit(post); }}>Edit</button>
                <button class="p-1 text-red-400 hover:text-red-300" onclick={() => confirmDeleteSlug = post.slug}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#if editingSlug}
        <form onsubmit={saveEdit} class="bg-surface border border-accent rounded-xl p-4 mt-4 space-y-3">
          <h3 class="font-heading font-semibold text-sm">Edit Post</h3>
          <div class="form-group">
            <label>Title</label>
            <input type="text" class="w-full text-sm" bind:value={editForm.title} />
          </div>
          <div class="form-group">
            <label>Content (Markdown)</label>
            <textarea class="w-full text-sm font-mono" bind:value={editForm.content_markdown} rows={8}></textarea>
          </div>
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
  title="Delete Post"
  message="This will permanently delete the post. This action cannot be undone."
  onConfirm={deletePost}
  onCancel={() => confirmDeleteSlug = null}
/>