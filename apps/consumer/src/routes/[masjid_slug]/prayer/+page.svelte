<script lang="ts">
  import { page } from '$app/stores';
  import { fetchPrayerTimes } from '$lib/api';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';

  import { formatTime } from '$lib/time';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let theme = $derived(data.theme);

  let weekOffset = $state(0);
  let weekData = $state<Map<string, Record<string, { adhaan: string; iqaamah: string; right_after_adhaan?: boolean }>>>(new Map());
  let loading = $state(false);
  let error = $state('');
  let today = $state(new Date());

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  let prayerLabels: Record<string, string> = $derived({
    fajr: theme?.label_fajr ?? 'Fajr',
    dhuhr: theme?.label_dhuhr ?? 'Dhuhr',
    asr: theme?.label_asr ?? 'Asr',
    maghrib: theme?.label_maghrib ?? 'Maghrib',
    isha: theme?.label_isha ?? 'Isha',
  });

  let timeFormat = $derived(theme?.time_format ?? '24h');
  let adhaanLabel = $derived(theme?.label_adhaan ?? 'Adhaan');
  let iqaamahLabel = $derived(theme?.label_iqaamah ?? 'Iqaamah');

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
        const result = await fetchPrayerTimes(masjid.slug, dateStr);
        newData.set(
          dateStr,
          result.times as unknown as Record<string, { adhaan: string; iqaamah: string }>,
        );
      }
      weekData = newData;
    } catch (e) {
      console.error('Failed to load prayer times', e);
      error = 'Failed to load prayer times. Please try again.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    weekOffset;
    if (!masjid?.slug) return;
    loadWeek();
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <button
      onclick={() => (weekOffset -= 1)}
      class="glass-card px-4 py-2 text-sm font-medium cursor-pointer"
      disabled={loading}
      style="color: var(--color-text-muted);"
    >
      Previous
    </button>
    <h2 class="text-lg font-semibold text-center font-heading" style="color: var(--color-text);">{weekLabel}</h2>
    <button
      onclick={() => (weekOffset += 1)}
      class="glass-card px-4 py-2 text-sm font-medium cursor-pointer"
      disabled={loading}
      style="color: var(--color-text-muted);"
    >
      Next
    </button>
  </div>

  {#if loading}
    <LoadingSpinner />
  {:else if error}
    <ErrorState message={error} />
  {:else}
    <div class="space-y-4">
      {#each weekDates as date, dayIndex}
        {@const dateStr = formatDate(date)}
        {@const dayTimes = weekData.get(dateStr)}
        {@const prevDateStr = dayIndex > 0 ? formatDate(weekDates[dayIndex - 1]!) : null}
        {@const prevTimes = prevDateStr ? weekData.get(prevDateStr) : null}
        {@const prayerChanges = dayIndex > 0 && prevTimes && dayTimes
          ? Object.fromEntries(
              prayerNames.map((name) => {
                const cur = dayTimes[name];
                const prv = prevTimes[name];
                if (!cur || !prv) return [name, { iqaamah: false, adhaan: false }];
                return [name, {
                  iqaamah: cur.iqaamah !== prv.iqaamah,
                  adhaan: cur.adhaan !== prv.adhaan,
                }];
              }),
            )
          : null}
        <div
          class="glass-card overflow-hidden"
          class:ring-1={isToday(date)}
          style="border-color: {isToday(date) ? 'var(--color-accent)' : ''};"
        >
          <div class="px-4 py-3 flex items-center" style="background: {isToday(date) ? 'rgba(255,255,255,0.03)' : 'transparent'};">
            <span class="text-sm font-semibold" style="color: {isToday(date) ? 'var(--color-accent)' : 'var(--color-text-muted)'};">
              {formatDayLabel(date)}
            </span>
            <span class="text-sm ml-2" style="color: var(--color-text-dim);">{formatDateLabel(date)}</span>
            {#if isToday(date)}
              <span class="ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white bg-accent">Today</span>
            {/if}
          </div>

          {#if dayTimes}
            <div class="p-4 grid grid-cols-5 gap-2">
              {#each prayerNames as name}
                {@const time = dayTimes[name]}
                {#if time}
                  {@const chg = prayerChanges?.[name]}
                  {@const changed = chg && (chg.iqaamah || chg.adhaan)}
                  <div class="flex flex-col items-center text-center">
                    <span class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--color-text-dim);">
                      {prayerLabels[name]}
                    </span>
                    <span
                      class="text-sm font-bold tabular-nums mt-0.5"
                      style="color: {changed && chg.iqaamah ? 'var(--color-accent)' : 'var(--color-text-muted)'}; opacity: {changed || dayIndex === 0 ? '1' : '0.3'};"
                    >
                      {formatTime(time.iqaamah, timeFormat)}
                    </span>
                    <span
                      class="text-[10px] tabular-nums"
                      style="color: {changed && chg.adhaan ? 'var(--color-accent)' : 'var(--color-text-dim)'}; opacity: {changed || dayIndex === 0 ? '1' : '0.3'};"
                    >
                      {adhaanLabel}: {formatTime(time.adhaan, timeFormat)}
                    </span>
                  </div>
                {/if}
              {/each}
            </div>
          {:else}
            <div class="px-4 py-3">
              <p class="text-sm italic" style="color: var(--color-text-dim);">No data available</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
