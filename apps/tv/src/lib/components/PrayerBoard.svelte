<script lang="ts">
  interface PrayerEntry {
    key: string;
    label: string;
    adhaan: string;
    iqaamah: string;
  }

  let {
    times,
    currentPrayerIndex,
    flashAdhaan,
    flashIqaamah,
    adhaanLabel = 'Adhaan',
    iqaamahLabel = 'Iqaamah',
  }: {
    times: PrayerEntry[];
    currentPrayerIndex: number | null;
    flashAdhaan: string | null;
    flashIqaamah: string | null;
    adhaanLabel: string;
    iqaamahLabel: string;
  } = $props();
</script>

<div class="prayer-grid">
  <div class="prayer-grid-header">
    <div class="prayer-grid-label"></div>
    {#each times as entry}
      <div
        class="prayer-col-header {currentPrayerIndex === times.indexOf(entry) ? 'prayer-col-header--current' : ''}"
      >
        {entry.label}
      </div>
    {/each}
  </div>

  <div class="prayer-grid-row">
    <div class="prayer-grid-label">{adhaanLabel}</div>
    {#each times as entry}
      {@const isFlashing = flashAdhaan === entry.key}
      <div
        class="prayer-cell {currentPrayerIndex === times.indexOf(entry) ? 'prayer-cell--current' : ''} {isFlashing ? 'prayer-cell--flash' : ''}"
      >
        {entry.adhaan}
      </div>
    {/each}
  </div>

  <div class="prayer-grid-row">
    <div class="prayer-grid-label">{iqaamahLabel}</div>
    {#each times as entry}
      {@const isFlashing = flashIqaamah === entry.key}
      <div
        class="prayer-cell {currentPrayerIndex === times.indexOf(entry) ? 'prayer-cell--current' : ''} {isFlashing ? 'prayer-cell--flash' : ''}"
      >
        {entry.iqaamah}
      </div>
    {/each}
  </div>
</div>
