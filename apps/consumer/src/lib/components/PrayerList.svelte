<script lang="ts">
  import PrayerCard from './PrayerCard.svelte';

  interface PrayerEntry {
    name: string;
    adhaan: string;
    iqaamah: string;
  }

  let {
    times,
    nextPrayerIndex = -1,
    accentColor = '#10b981',
  }: {
    times: PrayerEntry[];
    nextPrayerIndex?: number;
    accentColor?: string;
  } = $props();
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {#each times as entry, i}
    <PrayerCard
      name={entry.name}
      adhaan={entry.adhaan}
      iqaamah={entry.iqaamah}
      isNext={i === nextPrayerIndex}
      isPast={i < nextPrayerIndex && nextPrayerIndex >= 0}
      {accentColor}
    />
  {/each}
</div>