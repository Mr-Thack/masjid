<script lang="ts">
  import { formatTime, type TimeFormat } from '$lib/time';
  import Rosette from '@masjid/ui-utils/components/Rosette.svelte';

  interface PrayerEntry {
    name: string;
    adhaan: string;
    iqaamah: string;
    sunrise?: string;
    rightAfterAdhaan?: boolean;
    asrSecondary?: string | null;
    asrSecondaryLabel?: string;
  }

  interface LabelSet {
    adhaan: string;
    iqaamah: string;
    sunrise: string;
  }

  let {
    times,
    labels,
    timeFormat = '24h',
    currentPrayerIndex = -1,
    nextPrayerIndex = -1,
    rosetteMarker = false,
  }: {
    times: PrayerEntry[];
    labels: LabelSet;
    timeFormat?: TimeFormat;
    currentPrayerIndex?: number;
    nextPrayerIndex?: number;
    /** Mishkaat: mark the current prayer with the rosette glyph (§7.11). */
    rosetteMarker?: boolean;
  } = $props();

  const fmt = (t: string) => formatTime(t, timeFormat);
</script>

<div class="c-prayer-table glass-card overflow-hidden">
  <table class="w-full">
    <thead>
      <tr>
        <th scope="col" class="c-pt-head c-pt-head-name"><span class="sr-only">Prayer</span></th>
        <th scope="col" class="c-pt-head">{labels.adhaan}</th>
        <th scope="col" class="c-pt-head c-pt-head-iqaamah">{labels.iqaamah}</th>
      </tr>
    </thead>
    <tbody>
      {#each times as entry, i}
        {@const isCurrent = i === currentPrayerIndex}
        {@const isNext = i === nextPrayerIndex}
        <tr class="c-pt-row" class:c-pt-current={isCurrent}>
          <th scope="row" class="c-pt-name font-heading">
            {#if rosetteMarker && isCurrent}
              <span class="c-prayer-rosette" aria-hidden="true"><Rosette size={12} /></span>
            {/if}
            <span>{entry.name}</span>
            {#if isCurrent}
              <span class="c-pt-chip bg-primary">Current</span>
            {:else if isNext}
              <span class="c-pt-chip bg-accent">Next</span>
            {/if}
          </th>
          <td class="c-pt-time tabular-nums">
            {fmt(entry.adhaan)}
            {#if entry.asrSecondary}
              <span class="c-pt-sub">{entry.asrSecondaryLabel ?? 'Asr'}: {fmt(entry.asrSecondary)}</span>
            {/if}
          </td>
          <td class="c-pt-time c-pt-iqaamah tabular-nums">
            {#if entry.rightAfterAdhaan}
              <span class="c-pt-sub">After {labels.adhaan}</span>
            {:else}
              {fmt(entry.iqaamah)}
            {/if}
          </td>
        </tr>
        {#if entry.sunrise}
          <tr class="c-pt-row c-pt-sunrise">
            <th scope="row" class="c-pt-name">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
              <span>{labels.sunrise}</span>
            </th>
            <td class="c-pt-time tabular-nums">{fmt(entry.sunrise)}</td>
            <td class="c-pt-time tabular-nums" aria-hidden="true">–</td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
