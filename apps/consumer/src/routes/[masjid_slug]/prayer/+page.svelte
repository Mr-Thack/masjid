<script lang="ts">
  import { page } from '$app/stores';
  import { fetchPrayerTimes } from '$lib/api';
  import PrayerCard from '$lib/components/PrayerCard.svelte';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let theme = $derived(data.theme);

  let weekOffset = $state(0);
  let weekData = $state<Map<string, Record<string, { adhaan: string; iqaamah: string }>>>(new Map());
  let loading = $state(false);
  let error = $state('');
  let today = $state(new Date());

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  const prayerLabels: Record<string, string> = {
    fajr: 'Fajr',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
  };

  function getWeekDates(offset: number): Date[] {
    const now = new Date(today);
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset + offset * 7);
    monday.setHours(0, 0, 0, 0);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  function formatDayLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function formatDateLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isToday(date: Date): boolean {
    const t = new Date(today);
    return (
      date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate()
    );
  }

  let weekDates = $derived(getWeekDates(weekOffset));
  let weekLabel = $derived.by(() => {
    const first = weekDates[0]!;
    const last = weekDates[6]!;
    return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  });

  async function loadWeek() {
    if (!masjid?.slug) return;
    loading = true;
    error = '';
    const newData = new Map<string, Record<string, { adhaan: string; iqaamah: string }>>();

    try {
      for (const date of weekDates) {
        const dateStr = formatDate(date);
        const times = await fetchPrayerTimes(masjid.slug, dateStr);
        newData.set(dateStr, times.times);
      }
      weekData = newData;
    } catch {
      error = 'Failed to load prayer times. Please try again.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    weekOffset;
    loadWeek();
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <button
      onclick={() => (weekOffset -= 1)}
      class="glass-card px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
      disabled={loading}
    >
      Previous
    </button>
    <h2
      class="text-lg font-semibold text-gray-100 text-center"
      style="font-family: var(--font-heading);"
    >
      {weekLabel}
    </h2>
    <button
      onclick={() => (weekOffset += 1)}
      class="glass-card px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
      disabled={loading}
    >
      Next
    </button>
  </div>

  {#if loading}
    <div class="flex justify-center py-12">
      <div
        class="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style="border-color: var(--color-accent); border-top-color: transparent;"
      ></div>
    </div>
  {:else if error}
    <div class="glass-card p-6 text-center">
      <p class="text-red-400">{error}</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each weekDates as date}
        {@const dateStr = formatDate(date)}
        {@const dayTimes = weekData.get(dateStr)}
        <div
          class="glass-card overflow-hidden"
          class:ring-1={isToday(date)}
          style="border-color: {isToday(date) ? 'var(--color-accent)' : ''};"
        >
          <div
            class="px-4 py-3 flex items-center justify-between"
            style="background: {isToday(date) ? 'rgba(255,255,255,0.03)' : 'transparent'};"
          >
            <div>
              <span
                class="text-sm font-semibold"
                style="color: {isToday(date) ? 'var(--color-accent)' : '#9ca3af'};"
              >
                {formatDayLabel(date)}
              </span>
              <span class="text-sm text-gray-500 ml-2">{formatDateLabel(date)}</span>
              {#if isToday(date)}
                <span
                  class="ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                  style="background: var(--color-accent);"
                >
                  Today
                </span>
              {/if}
            </div>
          </div>

          {#if dayTimes}
            <div class="p-4 grid grid-cols-5 gap-2">
              {#each prayerNames as name}
                {@const time = dayTimes[name]}
                {#if time}
                  <div class="flex flex-col items-center text-center">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {prayerLabels[name]}
                    </span>
                    <span class="text-sm font-bold tabular-nums text-gray-300 mt-0.5">
                      {time.iqaamah}
                    </span>
                    <span class="text-[10px] text-gray-600 tabular-nums">
                      {time.adhaan}
                    </span>
                  </div>
                {/if}
              {/each}
            </div>
          {:else}
            <div class="px-4 py-3">
              <p class="text-sm text-gray-600 italic">No data available</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>