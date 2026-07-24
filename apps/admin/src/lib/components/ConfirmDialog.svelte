<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';

  let { open = false, title = 'Confirm', message = 'Are you sure?', onConfirm, onCancel }:
    { open?: boolean; title?: string; message?: string; onConfirm: () => void; onCancel: () => void } = $props();

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onCancel();
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onclick={handleBackdrop}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-surface border border-border rounded-xl p-6 max-w-sm w-full shadow-xl animate-scale-in">
      <div class="flex items-start gap-3 mb-4">
        <AlertTriangle class="text-yellow-500 shrink-0 mt-0.5" size={20} />
        <div>
          <h3 class="font-heading font-semibold text-text">{title}</h3>
          <p class="text-sm text-text-muted mt-1">{message}</p>
        </div>
      </div>
      <div class="flex justify-end gap-3">
        <button class="btn-secondary text-sm" onclick={onCancel}>Cancel</button>
        <button class="btn-danger text-sm" onclick={onConfirm}>Confirm</button>
      </div>
    </div>
  </div>
{/if}
