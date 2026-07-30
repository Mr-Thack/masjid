<script lang="ts">
  import PrayerCard from './PrayerCard.svelte';
  import type { TimeFormat } from '$lib/time';

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
</script>

<div class="flex flex-wrap justify-center gap-3 items-stretch">
  {#each times as entry, i}
    <div class="w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.5rem)] flex flex-col">
      <PrayerCard
        name={entry.name}
        adhaan={entry.adhaan}
        iqaamah={entry.iqaamah}
        adhaanLabel={labels.adhaan}
        iqaamahLabel={labels.iqaamah}
        sunrise={entry.sunrise}
        sunriseLabel={labels.sunrise}
        rightAfterAdhaan={entry.rightAfterAdhaan}
        asrSecondary={entry.asrSecondary}
        asrSecondaryLabel={entry.asrSecondaryLabel}
        {timeFormat}
        isCurrent={i === currentPrayerIndex}
        isNext={i === nextPrayerIndex}
        isPast={currentPrayerIndex >= 0 ? i < currentPrayerIndex : i < nextPrayerIndex && nextPrayerIndex >= 0}
        {rosetteMarker}
      />
    </div>
  {/each}
</div>
