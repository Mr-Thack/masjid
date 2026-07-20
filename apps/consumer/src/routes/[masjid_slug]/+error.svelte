<script lang="ts">
  import { page } from '$app/stores';
  import ErrorState from '$lib/components/ErrorState.svelte';

  let error = $derived($page.data);
</script>

<div class="min-h-dvh flex flex-col items-center justify-center p-4" style="background: var(--color-bg); color: var(--color-text);">
  <ErrorState message="Something went wrong. Please try refreshing the page." />
</div>