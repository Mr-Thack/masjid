<script lang="ts">
  import { page } from '$app/stores';
  import { fetchPrayerTimes } from '$lib/api';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import WeeklyPrayerTable, { type WeekDay } from '$lib/components/WeeklyPrayerTable.svelte';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let theme = $derived(data.theme);

  let weekOffset = $state(0);
  let weekData = $state<Map<string, { times: Record<string, { adhaan: string; iqaamah: string }>; asr_secondary?: string }>>(new Map());
  let loading = $state(false);
  let error = $state('');
  let today = $state(new Date());

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

  let asrSecondaryLabel = $derived.by(() => {
    const primary = masjid?.asr_madhab ?? 'shafi';
    return primary === 'shafi' ? 'Asr (Hanafi)' : 'Asr (Shafi)';
  });

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

  let weekDates = $derived(getWeekDates(weekOffset));
  let weekLabel = $derived.by(() => {
    const first = weekDates[0]!;
    const last = weekDates[6]!;
    return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  });

  let days: WeekDay[] = $derived(
    weekDates.map((date) => {
      const dayData = weekData.get(formatDate(date));
      return {
        date,
        times: dayData?.times ?? null,
        asrSecondary: dayData?.asr_secondary ?? null,
      };
    }),
  );

  async function loadWeek() {
    if (!masjid?.slug) return;
    loading = true;
    error = '';
    const newData = new Map<string, { times: Record<string, { adhaan: string; iqaamah: string }>; asr_secondary?: string }>();

    try {
      for (const date of weekDates) {
        const dateStr = formatDate(date);
        const result = await fetchPrayerTimes(masjid.slug, dateStr);
        const times = result.times as Record<string, { adhaan: string; iqaamah: string }> & { asr_secondary?: string | null };
        const { asr_secondary, ...prayerTimes } = times;
        newData.set(dateStr, {
          times: prayerTimes as unknown as Record<string, { adhaan: string; iqaamah: string }>,
          asr_secondary: asr_secondary ?? undefined,
        });
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

<div class="space-y-6" data-table-ready={!loading ? '' : undefined}>
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
    <WeeklyPrayerTable {days} {prayerLabels} {timeFormat} {adhaanLabel} {iqaamahLabel} {asrSecondaryLabel} {today} />
  {/if}
</div>
