<script module lang="ts">
  export interface WeekDay {
    date: Date;
    times: Record<string, { adhaan: string; iqaamah: string }> | null;
    asrSecondary?: string | null;
  }
</script>

<script lang="ts">
  import { formatTime, type TimeFormat } from '$lib/time';

  let {
    days,
    prayerLabels,
    timeFormat = '24h',
    adhaanLabel = 'Adhaan',
    iqaamahLabel = 'Iqaamah',
    asrSecondaryLabel = 'Asr',
    today = new Date(),
  }: {
    days: WeekDay[];
    prayerLabels: Record<string, string>;
    timeFormat?: TimeFormat;
    adhaanLabel?: string;
    iqaamahLabel?: string;
    asrSecondaryLabel?: string;
    today?: Date;
  } = $props();

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

  const fmt = (t: string) => formatTime(t, timeFormat);

  function isToday(date: Date): boolean {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  function formatDayLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function formatDateLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Change detection vs the previous day (Monday always shows at full
  // strength; later days dim unchanged times so drift across the week pops).
  function changeFlags(days: WeekDay[], dayIndex: number, name: string) {
    if (dayIndex === 0) return { changed: false, dim: false };
    const cur = days[dayIndex]?.times?.[name];
    const prv = days[dayIndex - 1]?.times?.[name];
    if (!cur || !prv) return { changed: false, dim: false };
    const changed = cur.iqaamah !== prv.iqaamah || cur.adhaan !== prv.adhaan;
    return { changed, dim: !changed };
  }
</script>

<div class="c-week-table glass-card overflow-x-auto">
  <table class="w-full">
    <thead>
      <tr>
        <th scope="col" class="c-wt-head c-wt-head-day"><span class="sr-only">Day</span></th>
        {#each prayerNames as name}
          <th scope="col" class="c-wt-head">{prayerLabels[name] ?? name}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each days as day, dayIndex}
        {@const todayRow = isToday(day.date)}
        <tr class="c-wt-row" class:c-wt-today={todayRow}>
          <th scope="row" class="c-wt-day">
            <span class="c-wt-day-name" style="color: {todayRow ? 'var(--color-accent)' : 'var(--color-text-muted)'};">
              {formatDayLabel(day.date)}
            </span>
            <span class="c-wt-day-date">{formatDateLabel(day.date)}</span>
            {#if todayRow}
              <span class="c-pt-chip bg-accent">Today</span>
            {/if}
          </th>
          {#each prayerNames as name}
            {@const time = day.times?.[name]}
            {@const flags = changeFlags(days, dayIndex, name)}
            <td class="c-wt-cell">
              {#if time}
                <span
                  class="c-wt-iqaamah tabular-nums"
                  style="color: {flags.changed ? 'var(--color-accent)' : 'var(--color-text)'}; opacity: {flags.dim ? '0.3' : '1'};"
                >{fmt(time.iqaamah)}</span>
                <span
                  class="c-wt-adhaan tabular-nums"
                  style="color: {flags.changed ? 'var(--color-accent)' : 'var(--color-text-dim)'}; opacity: {flags.dim ? '0.3' : '1'};"
                >{fmt(time.adhaan)}</span>
                {#if name === 'asr' && day.asrSecondary}
                  <span class="c-wt-asr2 tabular-nums">{asrSecondaryLabel}: {fmt(day.asrSecondary)}</span>
                {/if}
              {:else}
                <span class="c-wt-empty" aria-hidden="true">–</span>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="c-wt-legend">
    <span class="c-wt-legend-iqaamah">{iqaamahLabel}</span>
    <span aria-hidden="true">·</span>
    <span class="c-wt-legend-adhaan">{adhaanLabel}</span>
  </p>
</div>
