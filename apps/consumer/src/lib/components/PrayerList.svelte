<script lang="ts">
  import PrayerCard from './PrayerCard.svelte';
  import type { TimeFormat } from '$lib/time';

  interface PrayerEntry {
    name: string;
    adhaan: string;
    iqaamah: string;
    sunrise?: string;
    rightAfterAdhaan?: boolean;
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
  }: {
    times: PrayerEntry[];
    labels: LabelSet;
    timeFormat?: TimeFormat;
    currentPrayerIndex?: number;
    nextPrayerIndex?: number;
  } = $props();
</script>

<div class="flex flex-wrap justify-center gap-3">
  {#each times as entry, i}
    <div class="w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.5rem)]">
      <PrayerCard
        name={entry.name}
        adhaan={entry.adhaan}
        iqaamah={entry.iqaamah}
        adhaanLabel={labels.adhaan}
        iqaamahLabel={labels.iqaamah}
        sunrise={entry.sunrise}
        sunriseLabel={labels.sunrise}
        rightAfterAdhaan={entry.rightAfterAdhaan}
        {timeFormat}
        isCurrent={i === currentPrayerIndex}
        isNext={i === nextPrayerIndex}
        isPast={currentPrayerIndex >= 0 ? i < currentPrayerIndex : i < nextPrayerIndex && nextPrayerIndex >= 0}
      />
    </div>
  {/each}
</div>