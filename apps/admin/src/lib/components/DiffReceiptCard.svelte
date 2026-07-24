<script lang="ts">
  import { Plus, FileEdit, Trash2, Pin, MoveVertical } from 'lucide-svelte';

  let { diff }: { diff: Record<string, unknown> } = $props();

  let expanded = $state<Record<string, boolean>>({});

  const domainColors: Record<string, string> = {
    THEME: 'badge-purple',
    PROFILE: 'badge-blue',
    PRAYER_RULES: 'badge-amber',
    JUMUAH: 'badge-green',
    ANNOUNCEMENTS: 'badge-cyan',
  };

  const actionIcons: Record<string, typeof Plus> = {
    UPSERT: Plus,
    DELETE: Trash2,
    PATCH: FileEdit,
    PIN: Pin,
    REORDER: MoveVertical,
  };

  const actionLabels: Record<string, string> = {
    UPSERT: 'Create',
    DELETE: 'Delete',
    PATCH: 'Update',
    PIN: 'Pin',
    REORDER: 'Reorder',
  };

  function toggleDomain(domain: string) {
    expanded[domain] = !expanded[domain];
  }

  let domains = $derived(Object.keys(diff));
</script>

<div class="bg-surface border border-accent/30 rounded-xl overflow-hidden">
  <div class="bg-accent/10 border-b border-accent/20 px-4 py-2 flex items-center gap-2">
    <span class="text-xs font-semibold text-accent uppercase tracking-wider">Config Changes</span>
  </div>

  <div class="divide-y divide-border">
    {#each domains as domain}
      {@const items = diff[domain] as unknown[]}
      <div>
        <button
          class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg/50 text-sm"
          onclick={() => toggleDomain(domain)}
        >
          <div class="flex items-center gap-2">
            <span class="badge {domainColors[domain] || 'badge-grey'}">{domain.replace('_', ' ')}</span>
            <span class="text-text-muted">{items.length} change{items.length !== 1 ? 's' : ''}</span>
          </div>
        </button>

        {#if expanded[domain]}
          <div class="px-4 pb-3 space-y-1.5">
            {#each items as item}
              <div class="flex items-start gap-2 text-xs bg-bg/50 rounded-lg p-2">
                <span class="shrink-0 text-text-muted mt-0.5">
                  {#if item.action === 'UPSERT'}
                    <Plus size={12} class="text-accent" />
                  {:else if item.action === 'DELETE'}
                    <Trash2 size={12} class="text-red-400" />
                  {:else if item.action === 'PIN'}
                    <Pin size={12} class="text-amber-400" />
                  {:else if item.action === 'REORDER'}
                    <MoveVertical size={12} class="text-blue-400" />
                  {:else}
                    <FileEdit size={12} class="text-yellow-400" />
                  {/if}
                </span>
                <div>
                  <span class="font-medium">{item.target || item.key || '—'}</span>
                  {#if item.summary}
                    <p class="text-text-muted mt-0.5">{item.summary}</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
