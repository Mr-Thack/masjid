<script lang="ts">
  import type { Snippet } from 'svelte';
  import '../app.css';

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    document.documentElement.dataset.hydrated = 'true';
  });
</script>

{@render children()}
