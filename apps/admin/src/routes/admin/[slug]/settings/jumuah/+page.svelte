<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Plus, Trash2 } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let sessions = $state<unknown[]>([]);
  let showAdd = $state(false);
  let editingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);

  let newSession = $state({ label: '', time: '13:30', khateeb: '', location: '', speech_time: '' });
  let editForm = $state<Record<string, unknown>>({});

  $effect(() => { loadSessions(); });

  async function loadSessions() {
    try {
      const res = await api.getJumuah(auth.admin!.masjid_id);
      sessions = res.sessions || [];
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      loading = false;
    }
  }

  async function addSession(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      const speech_time = newSession.speech_time.trim() || null;
      await api.createJumuah(auth.admin!.masjid_id, { ...newSession, speech_time });
      showAdd = false;
      newSession = { label: '', time: '13:30', khateeb: '', location: '', speech_time: '' };
      toast.success('Session added');
      await loadSessions();
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
      const speech_time = ((editForm.speech_time as string) || '').trim() || null;
      await api.updateJumuah(auth.admin!.masjid_id, editingId!, { ...editForm, speech_time });
      editingId = null;
      toast.success('Session updated');
      await loadSessions();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function toggleActive(session: any) {
    try {
      await api.updateJumuah(auth.admin!.masjid_id, session.id, { is_active: !session.is_active });
      await loadSessions();
      toast.success(session.is_active ? 'Deactivated' : 'Activated');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function deleteSession() {
    if (!confirmDeleteId) return;
    try {
      await api.deleteJumuah(auth.admin!.masjid_id, confirmDeleteId);
      toast.success('Session deleted');
      confirmDeleteId = null;
      await loadSessions();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  function startEdit(session: any) {
    editingId = session.id;
    editForm = {
      label: session.label,
      time: session.time,
      khateeb: session.khateeb || '',
      location: session.location || '',
      speech_time: session.speech_time || '',
    };
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-heading font-bold">Jumu'ah Sessions</h1>
      <p class="text-text-muted text-sm mt-1">Manage Friday prayer sessions</p>
    </div>
    <button class="btn-primary text-sm" onclick={() => showAdd = !showAdd}>
      <Plus size={16} />
      Add Session
    </button>
  </div>

  {#if loading}
    <SkeletonForm fields={3} />
  {:else}
    {#if showAdd}
      <form onsubmit={addSession} class="bg-surface border border-border rounded-xl p-4 mb-4 space-y-3">
        <h3 class="font-heading font-semibold text-sm">New Session</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="form-group">
            <label>Label *</label>
            <input type="text" class="w-full text-sm" bind:value={newSession.label} required placeholder="e.g. English" />
          </div>
          <div class="form-group">
            <label>Time *</label>
            <input type="time" class="w-full text-sm" bind:value={newSession.time} required />
          </div>
          <div class="form-group">
            <label>Khateeb</label>
            <input type="text" class="w-full text-sm" bind:value={newSession.khateeb} placeholder="e.g. Sheikh Abdullah" />
          </div>
          <div class="form-group">
            <label>Location</label>
            <input type="text" class="w-full text-sm" bind:value={newSession.location} placeholder="e.g. Main Hall" />
          </div>
          <div class="form-group">
            <label>Speech Time (HH:MM)</label>
            <input type="text" class="w-full text-sm" bind:value={newSession.speech_time} placeholder="13:00" />
            <p class="form-hint">Optional — leave blank if same as session time</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" disabled={saving}>Add</button>
          <button type="button" class="btn-secondary text-sm" onclick={() => showAdd = false}>Cancel</button>
        </div>
      </form>
    {/if}

    {#if sessions.length === 0}
      <div class="bg-surface border border-border rounded-xl p-8 text-center">
        <p class="text-text-muted">No Jumu'ah sessions defined.</p>
      </div>
    {:else}
      <div class="bg-surface border border-border rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left p-3 text-text-muted font-medium">Label</th>
              <th class="text-left p-3 text-text-muted font-medium">Time</th>
              <th class="text-left p-3 text-text-muted font-medium">Khateeb</th>
              <th class="text-left p-3 text-text-muted font-medium">Location</th>
              <th class="text-left p-3 text-text-muted font-medium">Speech</th>
              <th class="text-left p-3 text-text-muted font-medium">Active</th>
              <th class="text-right p-3 text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each sessions as session (session.id)}
              <tr class="border-b border-border last:border-0 hover:bg-bg/50">
                <td class="p-3 font-medium">{session.label}</td>
                <td class="p-3 text-text-muted">{session.time}</td>
                <td class="p-3 text-text-muted">{session.khateeb || '—'}</td>
                <td class="p-3 text-text-muted">{session.location || '—'}</td>
                <td class="p-3 text-text-muted">{session.speech_time || '—'}</td>
                <td class="p-3">
                  <label class="toggle">
                    <input type="checkbox" checked={session.is_active} onchange={() => toggleActive(session)} />
                    <span class="toggle-slider"></span>
                  </label>
                </td>
                <td class="p-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button class="btn-secondary text-xs py-1 px-2" onclick={() => startEdit(session)}>Edit</button>
                    <button class="p-1 text-red-400 hover:text-red-300" onclick={() => confirmDeleteId = session.id}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if editingId}
        <form onsubmit={saveEdit} class="bg-surface border border-accent rounded-xl p-4 mt-4 space-y-3">
          <h3 class="font-heading font-semibold text-sm">Edit Session</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label>Label</label>
              <input type="text" class="w-full text-sm" bind:value={editForm.label} />
            </div>
            <div class="form-group">
              <label>Time</label>
              <input type="time" class="w-full text-sm" bind:value={editForm.time} />
            </div>
            <div class="form-group">
              <label>Khateeb</label>
              <input type="text" class="w-full text-sm" bind:value={editForm.khateeb} />
            </div>
            <div class="form-group">
              <label>Location</label>
              <input type="text" class="w-full text-sm" bind:value={editForm.location} />
            </div>
            <div class="form-group">
              <label>Speech Time</label>
              <input type="text" class="w-full text-sm" bind:value={editForm.speech_time} placeholder="13:00" />
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn-primary text-sm" disabled={saving}>Save</button>
            <button type="button" class="btn-secondary text-sm" onclick={() => editingId = null}>Cancel</button>
          </div>
        </form>
      {/if}
    {/if}
  {/if}
</div>

<ConfirmDialog
  open={confirmDeleteId !== null}
  title="Delete Session"
  message="This will permanently delete this Jumu'ah session."
  onConfirm={deleteSession}
  onCancel={() => confirmDeleteId = null}
/>
