<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, RotateCcw, ChevronDown, ChevronRight } from 'lucide-svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let restoring = $state(false);
  let snapshots = $state<unknown[]>([]);
  let expandedIdx = $state<number | null>(null);
  let confirmRestoreId = $state<string | null>(null);

  $effect(() => { load(); });

  async function load() {
    try {
      const res = await api.getProfile(auth.admin!.masjid_id);
      // Snapshots aren't exposed by profile endpoint — placeholder
      snapshots = [];
    } catch {
      snapshots = [];
    } finally {
      loading = false;
    }
  }

  async function restore() {
    if (!confirmRestoreId) return;
    restoring = true;
    try {
      await api.rollback(auth.admin!.masjid_id, confirmRestoreId);
      toast.success('Snapshot restored');
      confirmRestoreId = null;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      restoring = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto">
  <h1 class="text-2xl font-heading font-bold mb-2">Snapshots</h1>
  <p class="text-text-muted text-sm mb-6">Restore your masjid configuration to a previous state</p>

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <Loader class="animate-spin text-accent" size={24} />
    </div>
  {:else if snapshots.length === 0}
    <div class="bg-surface border border-border rounded-xl p-8 text-center">
      <p class="text-text-muted mb-2">No snapshots available yet</p>
      <p class="text-text-muted text-xs">Snapshots are created when you confirm changes via the AI bot chat.</p>
      <p class="text-text-muted text-xs mt-1">Use the AI Assistant to make configuration changes and generate snapshots.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each snapshots as snap, i (snap.id)}
        <div class="bg-surface border border-border rounded-xl overflow-hidden">
          <div
            class="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-bg/50 transition-colors"
            onclick={() => expandedIdx = expandedIdx === i ? null : i}
            role="button"
            tabindex="0"
            onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') expandedIdx = expandedIdx === i ? null : i; }}
          >
            <div class="flex items-center gap-3">
              {#if expandedIdx === i}
                <ChevronDown size={16} class="text-text-muted" />
              {:else}
                <ChevronRight size={16} class="text-text-muted" />
              {/if}
              <div>
                <p class="font-medium text-sm">{snap.summary || `Snapshot ${i + 1}`}</p>
                <p class="text-xs text-text-muted">{new Date(snap.created_at).toLocaleString()}</p>
              </div>
            </div>
            <button
              class="btn-secondary text-xs py-1 px-3 shrink-0"
              onclick={(e: Event) => { e.stopPropagation(); confirmRestoreId = snap.id as string; }}
            >
              <RotateCcw size={12} />
              Restore
            </button>
          </div>
          {#if expandedIdx === i}
            <div class="border-t border-border p-4 bg-bg/30">
              <p class="text-xs text-text-muted">Snapshot details would appear here.</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<ConfirmDialog
  open={confirmRestoreId !== null}
  title="Restore Snapshot"
  message="This will revert your masjid configuration to this snapshot. Current settings will be lost. Continue?"
  onConfirm={restore}
  onCancel={() => confirmRestoreId = null}
/>
