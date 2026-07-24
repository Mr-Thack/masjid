<script lang="ts">
  import { TriangleAlert } from 'lucide-svelte';

  let { message = 'Something went wrong', onRetry }: {
    message?: string;
    onRetry?: () => void;
  } = $props();
</script>

<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
  <TriangleAlert class="mx-auto mb-2 text-red-400" size={24} />
  <p class="text-red-400 text-sm">{message}</p>
  {#if onRetry}
    <button class="btn-secondary mt-3 text-sm" onclick={onRetry}>
      Try Again
    </button>
  {/if}
</div>
