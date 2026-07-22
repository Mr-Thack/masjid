<script lang="ts">
  import type { BoardPayload } from '$lib/api';
  import { formatTime } from '$lib/time';
  import { applyTheme, presetTokens, findNearestIqaamahChanges } from '@masjid/ui-utils';
  import PrayerBoard from '$lib/components/PrayerBoard.svelte';
  import AnnouncementBanner from '$lib/components/AnnouncementBanner.svelte';
  import Countdown from '$lib/components/Countdown.svelte';
  import JumuahNotice from '$lib/components/JumuahNotice.svelte';
  import AnalogClock from '$lib/components/AnalogClock.svelte';

  let { data }: { data: BoardPayload } = $props();

  let payload = $state(data);
  let now = $state(new Date());
  let compact = $state(false);

  $effect(() => {
    function check() {
      compact = window.innerHeight < screen.height * 0.88;
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });

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

  function buildThemeStyle(theme: BoardPayload['theme']): string {
    const preset = presetTokens[theme.layout_preset ?? ''] ?? presetTokens['glass-dark'];
    const vars: Record<string, string> = {
      '--color-primary': theme.primary_color,
      '--color-accent': theme.accent_color,
      '--font-heading': `'${theme.font_heading}', sans-serif`,
      '--font-body': `'${theme.font_body}', sans-serif`,
      ...preset,
    };
    if (theme.layout_preset === 'minimal-light') {
      vars['--color-primary-light'] = '#3b5cb8';
      vars['--color-primary-dark'] = '#13265e';
      vars['--color-accent-light'] = '#34d399';
    }
    return Object.entries(vars)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  }

  let themeStyle = $derived(buildThemeStyle(theme));

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

  let nextIqaamahRaw = $derived.by(() => {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < prayerNames.length; i++) {
      const t = times[i]!;
      const im = t.iqaamahHM[0] * 60 + t.iqaamahHM[1];
      if (im > nowMins) {
        return `${String(t.iqaamahHM[0]).padStart(2, '0')}:${String(t.iqaamahHM[1]).padStart(2, '0')}`;
      }
    }
    const t0 = times[0]!;
    return `${String(t0.iqaamahHM[0]).padStart(2, '0')}:${String(t0.iqaamahHM[1]).padStart(2, '0')}`;
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
      hour12: timeFormat === '12h',
    }),
  );

  let baseIqaamahs = $derived.by(() => {
    const base: Record<string, { iqaamah: string }> = {};
    for (const name of prayerNames) {
      base[name] = { iqaamah: payload.today.times[name]?.iqaamah ?? '--:--' };
    }
    return base;
  });

  let upcomingIqaamahs = $derived.by(() => {
    return payload.upcoming_days.map((day) => {
      const times: Record<string, { iqaamah: string }> = {};
      for (const name of prayerNames) {
        times[name] = { iqaamah: day.times[name]?.iqaamah ?? '--:--' };
      }
      return { date: day.date, times };
    });
  });

  let rawUpcomingChanges = $derived(
    findNearestIqaamahChanges(baseIqaamahs, upcomingIqaamahs, prayerNames),
  );

  let upcomingChanges = $derived.by(() => {
    return rawUpcomingChanges.map((change) => {
      const d = new Date(change.date + 'T12:00:00');
      return {
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        label: prayerLabels[change.prayer as PrayerKey],
        from: formatTime(change.from, timeFormat),
        to: formatTime(change.to, timeFormat),
      };
    });
  });

  let formattedJumuahSessions = $derived.by(() => {
    return payload.jumuah.map((session) => ({
      id: session.id,
      label: session.label,
      time: formatTime(session.time, timeFormat),
      khateeb: session.khateeb,
      speech_time: session.speech_time ? formatTime(session.speech_time, timeFormat) : null,
    }));
  });

  async function refresh() {
    try {
      const res = await fetch(`/api/v1/masjids/${payload.masjid.slug}/board`);
      if (res.ok) {
        payload = await res.json();
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

  $effect(() => {
    applyTheme(theme);
  });
</script>

<div class="tv-page" class:tv-page--compact={compact} style={themeStyle}>
  <header class="tv-header">
    <div class="flex flex-col">
      <h1 class="tv-header-name">{payload.masjid.name}</h1>
      {#if payload.masjid.city}
        <p class="tv-header-city">
          {payload.masjid.city}{#if payload.masjid.state}, {payload.masjid.state}{/if}
        </p>
      {/if}
    </div>
    <div class="tv-header-date-block">
      <p class="tv-header-date">{formattedDate}</p>
      <p class="tv-header-hijri">{hijriDate}</p>
    </div>
  </header>

  <main class="tv-main">
    <div class="tv-columns">
      <aside class="tv-info-panel">
        <AnalogClock {now} />
        <p class="tv-digital-time">{digitalTime}</p>
        <p class="tv-sunrise">{theme.label_sunrise} @ {sunrise}</p>
        <p class="tv-countdown-label">
          {nextIqaamahLabel} in <Countdown nextPrayerIqaamah={nextIqaamahRaw} />
        </p>

        <div class="tv-jumuah-wrapper">
          <JumuahNotice sessions={formattedJumuahSessions} label={theme.label_jumuah} speechLabel={theme.label_speech} />
        </div>
      </aside>

      <section class="tv-grid-section">
        <PrayerBoard
          {times}
          currentPrayerIndex={currentPrayerIndex}
          {flashAdhaan}
          {flashIqaamah}
          adhaanLabel={theme.label_adhaan}
          iqaamahLabel={theme.label_iqaamah}
        />

        {#if upcomingChanges.length > 0}
          <div class="tv-coming-up-strip">
  <p class="tv-coming-up-heading">Upcoming <br> Changes</p>
            <div class="tv-coming-up-grid">
              {#each upcomingChanges as change}
                <div class="tv-coming-up-card">
                  <span class="tv-coming-up-date">{change.date}</span>
                  <div class="tv-coming-up-line">
                    <span class="tv-coming-up-prayer">{change.label}</span>
                    <span class="tv-coming-up-times">
                      <span class="tv-coming-up-from">{change.from}</span>
                      <span class="tv-coming-up-arrow">→</span>
                      <span class="tv-coming-up-to">{change.to}</span>
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    </div>
  </main>

  {#if payload.pinned_announcement}
    <AnnouncementBanner announcement={payload.pinned_announcement} />
  {/if}
</div>
