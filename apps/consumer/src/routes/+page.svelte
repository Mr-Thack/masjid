<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    goto('/masjid-al-noor', { replaceState: true });
  });
</script>

<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:var(--color-bg,#0f172a);color:var(--color-text,#e2e8f0);">
  <p>Loading…</p>
</div>