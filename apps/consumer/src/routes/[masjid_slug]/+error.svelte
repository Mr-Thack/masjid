<script lang="ts">
  import { page } from '$app/stores';
  import ErrorState from '$lib/components/ErrorState.svelte';

  let status = $derived($page.status);
</script>

{#if status === 404}
  <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;text-align:center;padding:1rem;">
    <div>
      <h1 style="font-size:1.5rem;font-weight:600;margin:0 0 0.5rem;">Please Verify Your URL</h1>
      <p style="margin:0;opacity:0.8;">We couldn't find a masjid at this address.</p>
    </div>
  </div>
{:else}
  <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;text-align:center;padding:1rem;">
    <ErrorState message="Something went wrong. Please try refreshing the page." />
  </div>
{/if}