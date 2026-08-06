<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Plus, Trash2, Pin, PinOff, Info } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let announcements = $state<unknown[]>([]);
  let showAdd = $state(false);
  let editingSlug = $state<string | null>(null);
  let confirmDeleteSlug = $state<string | null>(null);

  let filter = $state<'all' | 'draft' | 'published' | 'archived'>('all');

  let newAnn = $state({ title: '', content_markdown: '', status: 'published' as string, is_pinned: false, expires_at: '' });
  let editForm = $state<Record<string, unknown>>({});

  $effect(() => { load(); });

  const filtered = $derived(
    filter === 'all' ? announcements : announcements.filter(a => (a as any).status === filter)
  );

  async function load() {
    try {
      const res = await api.getAnnouncements(auth.admin!.masjid_id);
      announcements = res.announcements || [];
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
      await api.createAnnouncement(auth.admin!.masjid_id, {
        ...newAnn,
        expires_at: newAnn.expires_at ? new Date(newAnn.expires_at).toISOString() : null,
      });
      showAdd = false;
      newAnn = { title: '', content_markdown: '', status: 'published', is_pinned: false, expires_at: '' };
      toast.success('Announcement created');
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
      const expires_at = (editForm.expires_at as string) ? new Date(editForm.expires_at as string).toISOString() : null;
      await api.updateAnnouncement(auth.admin!.masjid_id, editingSlug!, { ...editForm, expires_at });
      editingSlug = null;
      toast.success('Announcement updated');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function deleteAnnouncement() {
    if (!confirmDeleteSlug) return;
    try {
      await api.deleteAnnouncement(auth.admin!.masjid_id, confirmDeleteSlug);
      toast.success('Announcement archived');
      confirmDeleteSlug = null;
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function togglePin(ann: any) {
    try {
      await api.pinAnnouncement(auth.admin!.masjid_id, ann.slug);
      toast.success(ann.is_pinned ? 'Unpinned' : 'Pinned');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  function startEdit(ann: any) {
    editingSlug = ann.slug;
    editForm = {
      title: ann.title,
      content_markdown: ann.content_markdown,
      status: ann.status,
      is_pinned: ann.is_pinned,
      expires_at: ann.expires_at ? ann.expires_at.slice(0, 16) : '',
    };
  }

  const tabs = [
    { value: 'all', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
  ] as const;

  function statusBadge(status: string) {
    return status === 'published' ? 'badge-green' : status === 'draft' ? 'badge-yellow' : 'badge-grey';
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-heading font-bold">Announcements</h1>
      <p class="text-text-muted text-sm mt-1">{announcements.length} total</p>
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
        <h3 class="font-heading font-semibold text-sm">New Announcement</h3>
        <div class="form-group">
          <label>Title *</label>
          <input type="text" class="w-full text-sm" bind:value={newAnn.title} required />
        </div>
        <div class="form-group">
          <label>Content (Markdown) *</label>
          <textarea class="w-full text-sm font-mono" bind:value={newAnn.content_markdown} required rows={5}></textarea>
        </div>
        {#if (newAnn.title.length + newAnn.content_markdown.length) > 300}
          <div class="flex items-center gap-2 p-3 rounded-lg text-sm" style="background: var(--color-accent)/10; color: var(--color-accent); border: 1px solid var(--color-accent)/20;">
            <Info size={16} />
            <span>This looks lengthy — consider creating a Post instead. Posts support rich, permanent content and can be pinned to the homepage or Info page.</span>
          </div>
        {/if}
        <div class="grid grid-cols-2 gap-3">
          <div class="form-group">
            <label>Status</label>
            <select class="w-full text-sm" bind:value={newAnn.status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div class="form-group">
            <label>Expiry (optional)</label>
            <input type="datetime-local" class="w-full text-sm" bind:value={newAnn.expires_at} />
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={newAnn.is_pinned} />
          Pin to top
        </label>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" disabled={saving}>Create</button>
          <button type="button" class="btn-secondary text-sm" onclick={() => showAdd = false}>Cancel</button>
        </div>
      </form>
    {/if}

    {#if filtered.length === 0}
      <div class="bg-surface border border-border rounded-xl p-8 text-center">
        <p class="text-text-muted">No {filter === 'all' ? '' : filter} announcements.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each filtered as ann (ann.id)}
          <div class="bg-surface border border-border rounded-xl p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-medium text-text">{ann.title}</span>
                  <span class="badge {statusBadge(ann.status)}">{ann.status}</span>
                  {#if ann.is_pinned}
                    <span class="badge badge-amber">Pinned</span>
                  {/if}
                </div>
                <p class="text-xs text-text-muted mt-1">
                  Slug: {ann.slug} &middot;
                  {#if ann.published_at}Published: {new Date(ann.published_at).toLocaleDateString()}{/if}
                  {#if ann.expires_at} &middot; Expires: {new Date(ann.expires_at).toLocaleDateString()}{/if}
                </p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button class="p-1 text-text-muted hover:text-amber-400 {ann.is_pinned ? 'text-amber-400' : ''}" onclick={() => togglePin(ann)} title="Toggle pin">
                  {#if ann.is_pinned}
                    <PinOff size={14} />
                  {:else}
                    <Pin size={14} />
                  {/if}
                </button>
                <button class="btn-secondary text-xs py-1 px-2" onclick={() => { showAdd = false; startEdit(ann); }}>Edit</button>
                <button class="p-1 text-red-400 hover:text-red-300" onclick={() => confirmDeleteSlug = ann.slug}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#if editingSlug}
        <form onsubmit={saveEdit} class="bg-surface border border-accent rounded-xl p-4 mt-4 space-y-3">
          <h3 class="font-heading font-semibold text-sm">Edit Announcement</h3>
          <div class="form-group">
            <label>Title</label>
            <input type="text" class="w-full text-sm" bind:value={editForm.title} />
          </div>
          <div class="form-group">
            <label>Content (Markdown)</label>
            <textarea class="w-full text-sm font-mono" bind:value={editForm.content_markdown} rows={5}></textarea>
          </div>
          {#if (editForm.title as string)?.length && ((editForm.title as string).length + ((editForm.content_markdown as string)?.length ?? 0) > 300)}
            <div class="flex items-center gap-2 p-3 rounded-lg text-sm" style="background: var(--color-accent)/10; color: var(--color-accent); border: 1px solid var(--color-accent)/20;">
              <Info size={16} />
              <span>This looks lengthy — consider creating a Post instead. Posts support rich, permanent content and can be pinned to the homepage or Info page.</span>
            </div>
          {/if}
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label>Status</label>
              <select class="w-full text-sm" bind:value={editForm.status}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="form-group">
              <label>Expiry</label>
              <input type="datetime-local" class="w-full text-sm" bind:value={editForm.expires_at} />
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={editForm.is_pinned} />
            Pin to top
          </label>
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
  title="Archive Announcement"
  message="This will archive the announcement. It won't appear publicly."
  onConfirm={deleteAnnouncement}
  onCancel={() => confirmDeleteSlug = null}
/>
