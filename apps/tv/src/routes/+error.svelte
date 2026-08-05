<script lang="ts">
  let { status, message } = $props();
</script>

<div class="tv-error">
  <div class="tv-error-icon">&#9888;</div>
  <h1 class="tv-error-title">Unable to load display</h1>
  <p class="tv-error-message">
    {#if message}
      {message}
    {:else}
      The prayer time display could not be loaded. This may be due to a network issue
      or the masjid data being unavailable. The display will retry automatically.
    {/if}
  </p>
</div>