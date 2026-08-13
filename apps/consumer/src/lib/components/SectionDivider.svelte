<script lang="ts">
  import StarBand from '@masjid/ui-utils/components/StarBand.svelte';
  let { band = 14 }: { band?: number } = $props();
</script>

<div class="c-section-divider" aria-hidden="true">
  <StarBand {band} />
</div>