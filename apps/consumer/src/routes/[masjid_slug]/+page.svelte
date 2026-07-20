<script lang="ts">
  import { page } from '$app/stores';
  import PrayerList from '$lib/components/PrayerList.svelte';
  import DonateButton from '$lib/components/DonateButton.svelte';
  import SkeletonPrayerCard from '$lib/components/SkeletonPrayerCard.svelte';
  import { fetchPrayerTimes, type PrayerTimes } from '$lib/api';
  import { formatTime } from '$lib/time';
  import type { DailyTimes } from '@masjid/schemas';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let prayerTimes = $derived(data.prayer_times);
  let jumuah = $derived(data.jumuah);
  let pinnedAnnouncement = $derived(data.pinned_announcement);
  let theme = $derived(data.theme);

  let now = $state(new Date());

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

  let prayerLabels: Record<string, string> = $derived({
    fajr: theme?.label_fajr ?? 'Fajr',
    dhuhr: theme?.label_dhuhr ?? 'Dhuhr',
    asr: theme?.label_asr ?? 'Asr',
    maghrib: theme?.label_maghrib ?? 'Maghrib',
    isha: theme?.label_isha ?? 'Isha',
  });

  let times = $derived(
    prayerNames.map((name) => ({
      name: prayerLabels[name]!,
      adhaan: prayerTimes?.[name]?.adhaan ?? '--:--',
      iqaamah: prayerTimes?.[name]?.iqaamah ?? '--:--',
      rightAfterAdhaan: prayerTimes?.[name]?.right_after_adhaan ?? false,
      sunrise: name === 'fajr' ? (prayerTimes?.sunrise ?? undefined) : undefined,
    })),
  );

  let currentPrayerIndex = $derived.by(() => {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let current = -1;
    for (let i = 0; i < prayerNames.length; i++) {
      const iqaamah = prayerTimes?.[prayerNames[i]!]?.iqaamah;
      if (!iqaamah) continue;
      const [h, m] = iqaamah.split(':').map(Number);
      if (h == null || m == null) continue;
      const iqaamahMinutes = h * 60 + m;
      if (iqaamahMinutes <= currentMinutes) {
        if (i === 0) {
          const sunrise = prayerTimes?.sunrise;
          if (sunrise) {
            const [sh, sm] = sunrise.split(':').map(Number);
            if (sh != null && sm != null && currentMinutes >= sh * 60 + sm) continue;
          }
        }
        current = i;
      }
    }
    return current;
  });

  let nextPrayerIndex = $derived.by(() => {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < prayerNames.length; i++) {
      const iqaamah = prayerTimes?.[prayerNames[i]!]?.iqaamah;
      if (!iqaamah) continue;
      const [h, m] = iqaamah.split(':').map(Number);
      if (h == null || m == null) continue;
      const iqaamahMinutes = h * 60 + m;
      if (iqaamahMinutes > currentMinutes) return i;
    }
    return 0;
  });

  let nextPrayerName = $derived(times[nextPrayerIndex]?.name ?? '');
  let nextPrayerIqaamah = $derived(times[nextPrayerIndex]?.iqaamah ?? '--:--');

  let remaining = $derived.by(() => {
    const [h, m] = nextPrayerIqaamah.split(':').map(Number);
    if (h == null || m == null) return -1;
    const target = h * 3600 + m * 60;
    const current = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let diff = target - current;
    if (diff < 0) diff += 86400;
    return diff;
  });

  let countdownDisplay = $derived.by(() => {
    if (remaining < 0) return '--:--:--';
    const hrs = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  let hasJumuah = $derived((jumuah?.length ?? 0) > 0);
  let jumuahLabel = $derived(theme?.label_jumuah ?? "Jumu'ah");
  let timeFormat = $derived(theme?.time_format ?? '24h');

  let hijriDate = $derived(
    new Intl.DateTimeFormat('en-TN-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now),
  );

  let gregorianDate = $derived(
    now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  );

  $effect(() => {
    const t = setInterval(() => {
      now = new Date();
    }, 1000);
    return () => clearInterval(t);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Upcoming Iqamah changes (next 6 days vs today)
  // ───────────────────────────────────────────────────────────────────────────
  type ChangeEntry = {
    date: Date;
    prayerKey: string;
    prayerLabel: string;
    from: string;
    to: string;
  };

  let upcomingChanges = $state<ChangeEntry[]>([]);
  let loadingChanges = $state(false);
  let changesError = $state('');

  function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  function formatDateLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  async function loadUpcomingChanges() {
    if (!masjid?.slug || !prayerTimes) return;
    loadingChanges = true;
    changesError = '';

    try {
      const base: Record<string, string> = {};
      for (const name of prayerNames) {
        base[name] = prayerTimes[name]?.iqaamah ?? '--:--';
      }

      const changes: ChangeEntry[] = [];
      const seenPrayers = new Set<string>();

      for (let offset = 1; offset <= 6; offset++) {
        if (seenPrayers.size == prayerNames.length) break;

        const date = addDays(now, offset);
        const result: DailyTimes = await fetchPrayerTimes(masjid.slug, formatDate(date));
        const dayTimes = result.times as unknown as PrayerTimes;

        for (const name of prayerNames) {
          if (seenPrayers.has(name)) continue;

          const current = base[name]!;
          const future = dayTimes[name]?.iqaamah;

          if (future && future !== current) {
            changes.push({
              date,
              prayerKey: name,
              prayerLabel: prayerLabels[name] ?? name,
              from: current,
              to: future,
            });
          }

          seenPrayers.add(name);
        }
      }

      upcomingChanges = changes;
    } catch (e) {
      console.error('Failed to load upcoming changes', e);
      changesError = 'Could not load upcoming changes.';
      upcomingChanges = [];
    } finally {
      loadingChanges = false;
    }
  }

  $effect(() => {
    loadUpcomingChanges();
  });
</script>

<svelte:head>
  <title>{masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div class="lg:col-span-2 space-y-6">
    <section class="text-center py-6">
      <div class="relative">
        <div class="geometric-pattern absolute inset-0 rounded-2xl"></div>
        <div class="relative z-10">
          <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 font-heading">
            {masjid?.name ?? 'Masjid'}
          </h1>

          <div class="mt-6 glass-card flex flex-col items-center gap-3 w-full max-w-sm mx-auto px-6 py-5">
            <span class="text-xs uppercase tracking-[0.2em]" style="color: var(--color-text-dim);">
              {nextPrayerName} in
            </span>
            <span class="text-4xl sm:text-5xl font-mono font-bold tabular-nums text-accent">
              {countdownDisplay}
            </span>
          </div>

          <p class="mt-3 text-sm" style="color: var(--color-text-dim);">{gregorianDate}</p>
          <p class="text-xs" style="color: var(--color-text-dim);">{hijriDate}</p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-3 uppercase tracking-wider font-heading text-accent">
        Prayer Times
      </h2>
      {#if prayerTimes && Object.keys(prayerTimes).length > 0}
        <PrayerList
          {times}
          labels={{ adhaan: theme?.label_adhaan ?? 'Adhaan', iqaamah: theme?.label_iqaamah ?? 'Iqaamah', sunrise: theme?.label_sunrise ?? 'Sunrise' }}
          timeFormat={theme?.time_format ?? '24h'}
          {currentPrayerIndex}
          {nextPrayerIndex}
        />
      {:else}
        <div class="flex flex-wrap justify-center gap-3">
          {#each Array(5) as _}
            <div class="w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.5rem)]">
              <SkeletonPrayerCard />
            </div>
          {/each}
        </div>
      {/if}
    </section>

    {#if upcomingChanges.length > 0}
      <section>
        <h2 class="text-lg font-semibold mb-3 uppercase tracking-wider font-heading text-accent">
          Upcoming Iqamah Changes
        </h2>
        <div class="space-y-2">
          {#each upcomingChanges as change}
            <div class="glass-card p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-text-dim);">
                  {formatDateLabel(change.date)}
                </span>
                <p class="text-sm font-medium mt-0.5" style="color: var(--color-text);">
                  <strong class="text-accent">{change.prayerLabel}</strong>
                  Iqamah changing
                </p>
              </div>
              <div class="text-sm tabular-nums" style="color: var(--color-text-muted);">
                {formatTime(change.from, timeFormat)}
                <span class="mx-1" style="color: var(--color-text-dim);">→</span>
                <span class="font-semibold text-accent">{formatTime(change.to, timeFormat)}</span>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {:else if loadingChanges}
      <div class="h-8 rounded-lg animate-shimmer" style="background: var(--color-surface);"></div>
    {:else if changesError}
      <p class="text-xs" style="color: var(--color-text-dim);">{changesError}</p>
    {/if}
  </div>

  <aside class="space-y-6 lg:pt-6">
    {#if hasJumuah}
      <section>
        <h2 class="text-lg font-semibold mb-1 uppercase tracking-wider text-accent font-heading">
          {jumuahLabel} Timings
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {#each jumuah ?? [] as session}
            <div class="glass-card p-4">
              <p class="text-sm font-semibold" style="color: var(--color-text-muted);">{session.label}</p>
              <p class="text-2xl font-bold tabular-nums mt-1 text-accent">
                {formatTime(session.time, timeFormat)}
              </p>
              {#if session.khateeb}
                <p class="text-sm mt-1" style="color: var(--color-text-muted);">{session.khateeb}</p>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if pinnedAnnouncement}
      <section>
        <h2 class="text-lg font-semibold mb-3 uppercase tracking-wider text-accent font-heading">
          Announcement
        </h2>
        <div class="glass-card p-5 border-l-4" style="border-left-color: var(--color-accent);">
          <h3 class="text-base font-bold mb-2" style="color: var(--color-text);">{pinnedAnnouncement.title}</h3>
          <div class="text-sm leading-relaxed" style="color: var(--color-text-muted);">
            {@html pinnedAnnouncement.compiled_html}
          </div>
        </div>
      </section>
    {/if}

    {#if masjid?.external_donation_url}
      <section class="text-center">
        <DonateButton url={masjid.external_donation_url} />
      </section>
    {/if}
  </aside>
</div>
