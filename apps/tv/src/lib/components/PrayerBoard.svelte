<script lang="ts">
  import Rosette from '@masjid/ui-utils/components/Rosette.svelte';
  import type { BoardPhase } from '$lib/board-cycle';

  interface PrayerEntry {
    key: string;
    label: string;
    adhaan: string;
    iqaamah: string;
    asrSecondary?: string;
    asrSecondaryLabel?: string;
  }

  /** Per-prayer upcoming iqaamah change, keyed by prayer key (Mishkaat). */
  export interface BoardChange {
    /** Short effective date, e.g. "Fri, Aug 1". */
    date: string;
    /** The new iqaamah time, formatted for display. */
    to: string;
  }

  let {
    times,
    currentPrayerIndex,
    flashAdhaan,
    flashIqaamah,
    adhaanLabel = 'Adhaan',
    iqaamahLabel = 'Iqaamah',
    rosetteMarker = false,
    changes = {},
    phase = 'times',
  }: {
    times: PrayerEntry[];
    currentPrayerIndex: number | null;
    flashAdhaan: string | null;
    flashIqaamah: string | null;
    adhaanLabel: string;
    iqaamahLabel: string;
    /** Mishkaat: eight-point star rosette marks the current prayer (§7.3). */
    rosetteMarker?: boolean;
    /** Mishkaat: upcoming iqaamah changes to roll into the board (§7.5). */
    changes?: Record<string, BoardChange>;
    /** Mishkaat: board roll cycle phase; 'changes' shifts changed rows. */
    phase?: BoardPhase;
  } = $props();

  let hasChanges = $derived(Object.keys(changes).length > 0);
  let rollingHeaders = $derived(phase === 'changes' && hasChanges);
</script>

<div class="prayer-grid">
  <div class="prayer-board-header-cell prayer-board-header-cell--left">Prayer</div>
  {#if hasChanges}
    <!-- Headers roll with the columns (§7.5): in the changes phase the
         adhaan column holds today's iqaamah and the iqaamah column holds
         the new iqaamah, so the labels travel with their numerals. -->
    <div class="prayer-board-header-cell prayer-board-header-cell--roll">
      <div class="prayer-roll" class:prayer-roll--shifted={rollingHeaders}>
        <span class="prayer-roll-item">{adhaanLabel}</span>
        <span class="prayer-roll-item">{iqaamahLabel}</span>
      </div>
    </div>
    <div class="prayer-board-header-cell prayer-board-header-cell--roll">
      <div class="prayer-roll" class:prayer-roll--shifted={rollingHeaders}>
        <span class="prayer-roll-item">{iqaamahLabel}</span>
        <span class="prayer-roll-item prayer-roll-item--new">New {iqaamahLabel}</span>
      </div>
    </div>
  {:else}
    <div class="prayer-board-header-cell">{adhaanLabel}</div>
    <div class="prayer-board-header-cell">{iqaamahLabel}</div>
  {/if}

  {#each times as entry, rowIndex}
    {@const isCurrent = currentPrayerIndex === rowIndex}
    {@const isAdhaanFlashing = flashAdhaan === entry.key}
    {@const isIqaamahFlashing = flashIqaamah === entry.key}
    {@const change = changes[entry.key]}
    {@const rolling = phase === 'changes' && !!change}

    <div class="prayer-name {isCurrent ? 'prayer-name--current' : ''}">
      {#if rosetteMarker && isCurrent}
        <span class="prayer-name-rosette"><Rosette size={20} /></span>
      {/if}
      {entry.label}
      {#if rolling && change}
        <span class="prayer-change-date">{change.date}</span>
      {/if}
    </div>

    {#if change}
      <!-- Changed row: two clipped tracks. In the changes phase both roll
           one cell left — the adhaan exits toward the prayer label while
           today's iqaamah slides into the adhaan column and the new
           iqaamah rises in the iqaamah column (§7.5). -->
      <div
        class="prayer-cell prayer-cell--roll {isCurrent ? 'prayer-cell--current' : ''} {isAdhaanFlashing ? 'prayer-cell--flash' : ''}"
      >
        <div class="prayer-roll" class:prayer-roll--shifted={rolling}>
          <span class="prayer-roll-item">{entry.adhaan}</span>
          <span class="prayer-roll-item">{entry.iqaamah}</span>
        </div>
      </div>
      <div
        class="prayer-cell prayer-cell--roll {isCurrent ? 'prayer-cell--current' : ''} {isIqaamahFlashing ? 'prayer-cell--flash' : ''}"
      >
        <div class="prayer-roll" class:prayer-roll--shifted={rolling}>
          <span class="prayer-roll-item">
            <span class="prayer-cell-inner">
              <span>{entry.iqaamah}</span>
              {#if entry.asrSecondary}
                <span class="prayer-asr-secondary">{entry.asrSecondaryLabel} {entry.asrSecondary}</span>
              {/if}
            </span>
          </span>
          <span class="prayer-roll-item prayer-roll-item--new">{change.to}</span>
        </div>
      </div>
    {:else}
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
    {/if}
  {/each}
</div>

<style>
  .prayer-name-rosette {
    display: inline-flex;
    margin-right: 0.5rem;
    color: var(--color-accent, #d4af37);
  }
</style>
