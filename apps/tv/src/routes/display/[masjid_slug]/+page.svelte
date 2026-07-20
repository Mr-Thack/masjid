<script lang="ts">
  import type { BoardPayload } from '../../lib/api';
  import { formatTime } from '$lib/time';
  import PrayerBoard from '$lib/components/PrayerBoard.svelte';
  import AnnouncementBanner from '$lib/components/AnnouncementBanner.svelte';
  import Countdown from '$lib/components/Countdown.svelte';
  import JumuahNotice from '$lib/components/JumuahNotice.svelte';
  import AnalogClock from '$lib/components/AnalogClock.svelte';

  let { data }: { data: BoardPayload } = $props();

  let payload = $state(data);
  let refreshKey = $state(0);
  let now = $state(new Date());

  let theme = $derived(payload.theme);
  let timeFormat = $derived(theme.time_format);

  let prayerLabels = $derived({
    fajr: theme.label_fajr,
    dhuhr: theme.label_dhuhr,
    asr: theme.label_asr,
    maghrib: theme.label_maghrib,
    isha: theme.label_isha,
  });

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  type PrayerKey = (typeof prayerNames)[number];

  interface PrayerEntry {
    key: PrayerKey;
    label: string;
    adhaan: string;
    iqaamah: string;
    adhaanHM: [number, number];
    iqaamahHM: [number, number];
  }

  let times = $derived.by(() => {
    const fmt = timeFormat;
    return prayerNames.map((name) => {
      const t = payload.today.times[name];
      const adhaan = t?.adhaan ?? '--:--';
      const iqaamah = t?.iqaamah ?? '--:--';
      const [ah, am] = adhaan.split(':').map(Number);
      const [ih, im] = iqaamah.split(':').map(Number);
      return {
        key: name,
        label: prayerLabels[name],
        adhaan: formatTime(adhaan, fmt),
        iqaamah: formatTime(iqaamah, fmt),
        adhaanHM: [ah ?? 0, am ?? 0] as [number, number],
        iqaamahHM: [ih ?? 0, im ?? 0] as [number, number],
      };
    });
  });

  let sunriseRaw = $derived(payload.today.times.sunrise ?? '--:--');
  let sunrise = $derived(formatTime(sunriseRaw, timeFormat));

  let currentPrayerIndex = $derived.by(() => {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const iqaamahs = times.map((t) => t.iqaamahHM[0] * 60 + t.iqaamahHM[1]);
    const [sh, sm] = sunriseRaw.split(':').map(Number);
    const sunriseMins = (sh ?? 0) * 60 + (sm ?? 0);

    if (nowMins >= iqaamahs[4]! || nowMins < iqaamahs[0]!) return 4;
    if (nowMins >= iqaamahs[0]! && nowMins < sunriseMins) return 0;
    if (nowMins >= sunriseMins && nowMins < iqaamahs[1]!) return null;
    if (nowMins >= iqaamahs[1]! && nowMins < iqaamahs[2]!) return 1;
    if (nowMins >= iqaamahs[2]! && nowMins < iqaamahs[3]!) return 2;
    if (nowMins >= iqaamahs[3]! && nowMins < iqaamahs[4]!) return 3;
    return null;
  });

  let nextIqaamah = $derived.by(() => {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < prayerNames.length; i++) {
      const t = times[i]!;
      const im = t.iqaamahHM[0] * 60 + t.iqaamahHM[1];
      if (im > nowMins) return t.iqaamah;
    }
    return times[0]!.iqaamah;
  });

  let nextIqaamahLabel = $derived.by(() => {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < prayerNames.length; i++) {
      const t = times[i]!;
      const im = t.iqaamahHM[0] * 60 + t.iqaamahHM[1];
      if (im > nowMins) return t.label;
    }
    return times[0]!.label;
  });

  let flashAdhaan = $derived.by(() => {
    const h = now.getHours();
    const m = now.getMinutes();
    for (const t of times) {
      if (t.adhaanHM[0] === h && t.adhaanHM[1] === m) return t.key;
    }
    return null;
  });

  let flashIqaamah = $derived.by(() => {
    const h = now.getHours();
    const m = now.getMinutes();
    for (const t of times) {
      if (t.iqaamahHM[0] === h && t.iqaamahHM[1] === m) return t.key;
    }
    return null;
  });

  let formattedDate = $derived(
    now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
  );

  let hijriDate = $derived(
    new Intl.DateTimeFormat('en-TN-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now),
  );

  let digitalTime = $derived(
    now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  );

  let upcomingChanges = $derived.by(() => {
    const changes: Array<{ date: string; label: string; prayerKey: string; from: string; to: string }> = [];
    const todayTimes = payload.today.times;
    for (const day of payload.upcoming_days) {
      for (const name of prayerNames) {
        const todayIq = todayTimes[name]?.iqaamah;
        const futureIq = day.times[name]?.iqaamah;
        if (todayIq && futureIq && futureIq !== todayIq) {
          const d = new Date(day.date + 'T12:00:00');
          changes.push({
            date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            label: prayerLabels[name],
            prayerKey: name,
            from: formatTime(todayIq, timeFormat),
            to: formatTime(futureIq, timeFormat),
          });
        }
      }
    }
    return changes;
  });

  async function refresh() {
    try {
      const res = await fetch(`/api/v1/masjids/${payload.masjid.slug}/board`);
      if (res.ok) {
        payload = await res.json();
        refreshKey++;
        now = new Date();
      }
    } catch {
      // silently continue with stale data
    }
  }

  $effect(() => {
    const tick = setInterval(() => (now = new Date()), 1000);
    const poll = setInterval(() => refresh(), 60000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  });
</script>

<div
  class="tv-page"
  style="--color-primary: {theme.primary_color}; --color-accent: {theme.accent_color}; --font-heading: '{theme.font_heading}', sans-serif; --font-body: '{theme.font_body}', sans-serif;"
>
  <header class="tv-header">
    <div class="flex flex-col">
      <h1 class="tv-header-name">{payload.masjid.name}</h1>
      {#if payload.masjid.city}
        <p class="tv-header-city">{payload.masjid.city}, IL</p>
      {/if}
    </div>
    <div class="text-right">
      <p class="tv-header-date">{formattedDate}</p>
      <p class="tv-header-hijri">{hijriDate}</p>
    </div>
  </header>

  <main class="tv-main">
    <div class="tv-columns">
      <aside class="tv-info-panel">
        <AnalogClock {now} />
        <p class="tv-digital-time">{digitalTime}</p>
        <p class="tv-countdown-label">
          {nextIqaamahLabel} in <Countdown nextPrayerIqaamah={nextIqaamah} />
        </p>

        {#if upcomingChanges.length > 0}
          <div class="tv-divider"></div>
          <div class="tv-changes">
            <p class="tv-changes-heading">Coming up</p>
            {#each upcomingChanges as change}
              <p class="tv-change-line">
                <span class="tv-change-date">{change.date}</span>
                <span class="tv-change-prayer">{change.label}</span>
                <span class="tv-change-from">{change.from}</span>
                <span class="tv-change-arrow">→</span>
                <span class="tv-change-to">{change.to}</span>
              </p>
            {/each}
          </div>
        {/if}
      </aside>

      <section class="tv-grid-section">
        <PrayerBoard
          {times}
          currentPrayerIndex={currentPrayerIndex}
          {flashAdhaan}
          {flashIqaamah}
          {sunrise}
          sunriseLabel={theme.label_sunrise}
          adhaanLabel={theme.label_adhaan}
          iqaamahLabel={theme.label_iqaamah}
          key={refreshKey}
        />

        <JumuahNotice sessions={payload.jumuah} label={theme.label_jumuah} />
      </section>
    </div>
  </main>

  {#if payload.pinned_announcement}
    <AnnouncementBanner
      announcement={payload.pinned_announcement}
      accentColor={theme.accent_color}
    />
  {/if}
</div>