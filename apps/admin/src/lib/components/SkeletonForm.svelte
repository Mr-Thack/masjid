<script lang="ts">
  let { fields = 4 }: { fields?: number } = $props();
</script>

<div class="bg-surface border border-border rounded-lg p-6">
  {#each Array(fields) as _}
    <div class="mb-4 last:mb-0">
      <div class="h-4 w-24 bg-border/50 rounded animate-shimmer mb-2"></div>
      <div class="h-9 bg-border/30 rounded animate-shimmer"></div>
    </div>
  {/each}
</div>

<style>
  .animate-shimmer {
    background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.04) 50%, transparent 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
</style>
