<script lang="ts">
  import Rosette from './Rosette.svelte';

  interface PrayerEntry {
    key: string;
    label: string;
    adhaan: string;
    iqaamah: string;
    asrSecondary?: string;
    asrSecondaryLabel?: string;
  }

  let {
    times,
    currentPrayerIndex,
    flashAdhaan,
    flashIqaamah,
    adhaanLabel = 'Adhaan',
    iqaamahLabel = 'Iqaamah',
    rosetteMarker = false,
  }: {
    times: PrayerEntry[];
    currentPrayerIndex: number | null;
    flashAdhaan: string | null;
    flashIqaamah: string | null;
    adhaanLabel: string;
    iqaamahLabel: string;
    /** Mishkaat: eight-point star rosette marks the current prayer (§7.3). */
    rosetteMarker?: boolean;
  } = $props();
</script>

<div class="prayer-grid">
  <div class="prayer-board-header-cell prayer-board-header-cell--left">Prayer</div>
  <div class="prayer-board-header-cell">{adhaanLabel}</div>
  <div class="prayer-board-header-cell">{iqaamahLabel}</div>

  {#each times as entry, rowIndex}
    {@const isCurrent = currentPrayerIndex === rowIndex}
    {@const isAdhaanFlashing = flashAdhaan === entry.key}
    {@const isIqaamahFlashing = flashIqaamah === entry.key}

    <div class="prayer-name {isCurrent ? 'prayer-name--current' : ''}">
      {#if rosetteMarker && isCurrent}
        <span class="prayer-name-rosette"><Rosette size={20} /></span>
      {/if}
      {entry.label}
    </div>
    <div
      class="prayer-cell {isCurrent ? 'prayer-cell--current' : ''} {isAdhaanFlashing ? 'prayer-cell--flash' : ''}"
    >
      {entry.adhaan}
    </div>
    <div
      class="prayer-cell {isCurrent ? 'prayer-cell--current' : ''} {isIqaamahFlashing ? 'prayer-cell--flash' : ''}"
    >
      <div class="prayer-cell-inner">
        <span>{entry.iqaamah}</span>
        {#if entry.asrSecondary}
          <span class="prayer-asr-secondary">{entry.asrSecondaryLabel} {entry.asrSecondary}</span>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .prayer-name-rosette {
    display: inline-flex;
    margin-right: 0.5rem;
    color: var(--color-accent, #d4af37);
  }
</style>

