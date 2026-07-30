<script lang="ts">
  import type { BoardPayload } from '$lib/api';
  import { formatTime } from '$lib/time';
  import {
    applyTheme,
    buildThemeVars,
    resolveStyleSystem,
    parseStyleOptions,
    resolveStyleOptions,
    findNearestIqaamahChanges,
    getHadithOfTheDay,
  } from '@masjid/ui-utils';
  import { syncServerTime, serverNow } from '$lib/server-clock';
  import { buildFrames, hadithTagsForContext, MAX_ANNOUNCEMENT_FRAMES, FRAME_TRANSITION_MS } from '$lib/frames';
  import { computeCeremony, getHijriPartsCached, type PrayerKey } from '$lib/ceremony';
  import { getBoardPhase, boardCycleHoldoff } from '$lib/board-cycle';
  import { fade } from 'svelte/transition';
  import PrayerBoard from '$lib/components/PrayerBoard.svelte';
  import AnnouncementBanner from '$lib/components/AnnouncementBanner.svelte';
  import Countdown from '$lib/components/Countdown.svelte';
  import JumuahNotice from '$lib/components/JumuahNotice.svelte';
  import AnalogClock from '$lib/components/AnalogClock.svelte';
  import Rosette from '$lib/components/Rosette.svelte';
  import HoneycombFrame from '$lib/components/HoneycombFrame.svelte';
  import StarBandFrame from '$lib/components/StarBandFrame.svelte';
  import ArchCrest from '$lib/components/ArchCrest.svelte';
  import SoulColumn from '$lib/components/SoulColumn.svelte';
  import CeremonyOverlay from '$lib/components/CeremonyOverlay.svelte';

  const API_BASE = import.meta.env.VITE_API_URL || '';

  let { data }: { data: BoardPayload } = $props();

  let payload = $state(data);
  let now = $state(new Date());
  let compact = $state(false);
  let reducedMotion = $state(false);

  $effect(() => {
    function check() {
      compact = window.innerHeight < screen.height * 0.88;
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });

  // Motion budget (§4): prefers-reduced-motion disables frame rotation.
  $effect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => (reducedMotion = query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  let theme = $derived(payload.theme);
  let styleSystem = $derived(resolveStyleSystem(theme));
  let styleOptions = $derived(resolveStyleOptions(parseStyleOptions(theme.style_options)));
  let timeFormat = $derived(theme.time_format);

  let prayerLabels = $derived({
    fajr: theme.label_fajr,
    dhuhr: theme.label_dhuhr,
    asr: theme.label_asr,
    maghrib: theme.label_maghrib,
    isha: theme.label_isha,
  });

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

  interface PrayerEntry {
    key: PrayerKey;
    label: string;
    adhaan: string;
    iqaamah: string;
    adhaanHM: [number, number];
    iqaamahHM: [number, number];
    asrSecondary?: string;
    asrSecondaryLabel?: string;
  }

  function buildThemeStyle(theme: BoardPayload['theme']): string {
    return Object.entries(buildThemeVars(theme))
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  }

  let themeStyle = $derived(buildThemeStyle(theme));

  let times = $derived.by(() => {
    const fmt = timeFormat;
    const asrSecondaryRaw = payload.today.times.asr_secondary;
    const primaryMadhab = payload.masjid.asr_madhab ?? 'shafi';
    const asrSecondaryLabel = primaryMadhab === 'shafi' ? 'Asr (Hanafi)' : 'Asr (Shafi)';
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
        ...(name === 'asr' && asrSecondaryRaw
          ? { asrSecondary: formatTime(asrSecondaryRaw, fmt), asrSecondaryLabel }
          : {}),
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

  // --- Board roll cycle (Mishkaat, §7.5) ----------------------------------
  // 45s on today's times, 15s rolled into the upcoming changes; never
  // rolls around a prayer moment (adhaan → iqaamah + 5min holdoff).
  let boardChangesByKey = $derived.by(() => {
    const map: Record<string, { date: string; to: string }> = {};
    for (const change of rawUpcomingChanges) {
      const d = new Date(change.date + 'T12:00:00');
      map[change.prayer] = {
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        to: formatTime(change.to, timeFormat),
      };
    }
    return map;
  });

  let boardPhase = $derived(
    getBoardPhase(now.getTime(), {
      hasChanges: upcomingChanges.length > 0,
      holdoff: boardCycleHoldoff(nowSeconds / 60, Object.values(prayerWindows)),
      reducedMotion,
    }),
  );

  let formattedJumuahSessions = $derived.by(() => {
    return payload.jumuah.map((session) => ({
      id: session.id,
      label: session.label,
      time: formatTime(session.time, timeFormat),
      khateeb: session.khateeb,
      speech_time: session.speech_time ? formatTime(session.speech_time, timeFormat) : null,
    }));
  });

  // --- Soul column frames (§7.5) -----------------------------------------
  let framesList = $derived(
    buildFrames({
      jumuahSessionCount: formattedJumuahSessions.length,
      announcementCount: payload.recent_announcements?.length ?? 0,
      donationUrl: payload.masjid.external_donation_url,
      dayOfWeek: now.getDay(),
      enabledFrames: styleOptions.frames,
    }),
  );

  let hadithEntry = $derived(
    getHadithOfTheDay(
      now,
      hadithTagsForContext({
        dayOfWeek: now.getDay(),
        currentPrayer: currentPrayerIndex != null ? prayerNames[currentPrayerIndex] : null,
      }),
    ),
  );

  let announcementsForFrames = $derived(
    (payload.recent_announcements ?? [])
      .slice(0, MAX_ANNOUNCEMENT_FRAMES)
      .map((a) => ({ title: a.title, html: a.compiled_html })),
  );

  // --- Ceremony states (§7.6) --------------------------------------------
  let nowSeconds = $derived(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());

  let prayerWindows = $derived.by(() => {
    const windows = {} as Record<PrayerKey, { adhaan: number; iqaamah: number }>;
    for (const t of times) {
      windows[t.key] = {
        adhaan: t.adhaanHM[0] * 60 + t.adhaanHM[1],
        iqaamah: t.iqaamahHM[0] * 60 + t.iqaamahHM[1],
      };
    }
    return windows;
  });

  let sunriseMinutes = $derived.by(() => {
    const [sh, sm] = sunriseRaw.split(':').map(Number);
    return (sh ?? 0) * 60 + (sm ?? 0);
  });

  let ceremony = $derived(
    computeCeremony({
      nowSeconds,
      dayOfWeek: now.getDay(),
      prayers: prayerWindows,
      sunriseMinutes,
      hijri: getHijriPartsCached(now),
      quietHours: styleOptions.quietHours,
      ambientEnabled: styleOptions.ambient,
    }),
  );

  let nextPrayerKey = $derived.by((): PrayerKey => {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < prayerNames.length; i++) {
      const t = times[i]!;
      const im = t.iqaamahHM[0] * 60 + t.iqaamahHM[1];
      if (im > nowMins) return t.key;
    }
    return times[0]!.key;
  });

  async function refresh() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/masjids/${payload.masjid.slug}/board`);
      if (res.ok) {
        payload = await res.json();
        now = serverNow();
      }
    } catch {
      // silently continue with stale data
    }
  }

  // Server-time integrity (§7.7): correct the local clock against every
  // board payload so ceremony states and the clock face stay honest.
  $effect(() => {
    syncServerTime(payload.server_time);
    now = serverNow();
  });

  $effect(() => {
    const tick = setInterval(() => (now = serverNow()), 1000);
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

{#if styleSystem === 'mishkaat'}
  <!-- ============================================================
       Mishkaat layout (docs/design-language.md §7.1):
       RTL reading grammar — prayer board right (~70%), soul column
       left (~30%), mirrored header (name right, dates left).
       ============================================================ -->
  <div
    class="tv-page tv-page--mishkaat"
    class:tv-page--compact={compact}
    style={themeStyle}
    data-ambient-phase={ceremony.ambientPhase ?? undefined}
  >
    <header class="tv-header tv-header--mishkaat">
      <div class="tv-header-name-block">
        <h1 class="tv-header-name">{payload.masjid.name}</h1>
        {#if payload.masjid.city}
          <p class="tv-header-city">
            {payload.masjid.city}{#if payload.masjid.state}, {payload.masjid.state}{/if}
          </p>
        {/if}
      </div>
      <div class="tv-header-rosette"><Rosette size={22} stroke /></div>
      <div class="tv-header-date-block tv-header-date-block--mishkaat">
        <p class="tv-header-hijri tv-header-hijri--prominent">{hijriDate}</p>
        <p class="tv-header-date">{formattedDate}</p>
      </div>
    </header>

    <main class="tv-main">
      <div class="tv-columns tv-columns--mishkaat">
        <aside class="tv-soul-column">
          {#if ceremony.modifiers.eid}
            <div class="tv-eid-greeting">
              <p class="tv-eid-arabic" dir="rtl" lang="ar">عيد مبارك</p>
              <p class="tv-eid-english">
                {ceremony.modifiers.eidName === 'adha' ? 'Eid al-Adha Mubarak' : 'Eid al-Fitr Mubarak'}
              </p>
            </div>
          {/if}
          <!-- §7.3: one mihrab arch per screen — an integrated niche holding
               the clock, digital time, and next-prayer indicators, the way a
               mihrab frames the imam. Kept in compact (windowed) mode at a
               smaller size; bare mode (arch off) flows the same content
               without the outline. -->
          <div class="tv-clock-niche" class:tv-clock-niche--bare={!styleOptions.arch}>
            {#if styleOptions.arch}
              <ArchCrest width={320} />
            {/if}
            <div class="tv-niche-body">
              <AnalogClock {now} classic />
              <p class="tv-sunrise">{theme.label_sunrise} @ {sunrise}</p>
              <p class="tv-countdown-label">
                {#if ceremony.modifiers.ramadan && nextPrayerKey === 'maghrib'}
                  Iftar in <Countdown nextPrayerIqaamah={nextIqaamahRaw} />
                {:else}
                  {nextIqaamahLabel} in <Countdown nextPrayerIqaamah={nextIqaamahRaw} />
                {/if}
              </p>
            </div>
          </div>
          {#if ceremony.modifiers.ramadan && nowSeconds < prayerWindows.fajr.iqaamah * 60}
            <p class="tv-suhoor-line">Suhoor ends {times[0]?.adhaan}</p>
          {/if}
          {#if ceremony.modifiers.friday}
            <p class="tv-kahf-reminder">Don't forget Surah al-Kahf</p>
          {/if}

          <SoulColumn
            frames={framesList}
            {reducedMotion}
            hadith={hadithEntry}
            jumuahSessions={formattedJumuahSessions}
            jumuahLabel={theme.label_jumuah}
            speechLabel={theme.label_speech}
            announcements={announcementsForFrames}
            donationUrl={payload.masjid.external_donation_url}
            appeal={styleOptions.donateAppeal}
          />
        </aside>

        <section class="tv-grid-section">
          <div class="prayer-board-panel">
            {#if styleOptions.motif === 'eight-point-star'}
              <StarBandFrame />
            {:else if styleOptions.motif === 'honeycomb'}
              <HoneycombFrame />
            {/if}
            <PrayerBoard
              {times}
              currentPrayerIndex={currentPrayerIndex}
              {flashAdhaan}
              {flashIqaamah}
              adhaanLabel={theme.label_adhaan}
              iqaamahLabel={theme.label_iqaamah}
              rosetteMarker
              changes={boardChangesByKey}
              phase={boardPhase}
            />
          </div>
        </section>
      </div>
    </main>

    {#if ceremony.state === 'night-calm'}
      <!-- §7.6.5 night calm: 20% veil — noticeably calmer, times stay readable. -->
      <div class="tv-night-veil" transition:fade={{ duration: FRAME_TRANSITION_MS * 2 }} data-ceremony="night-calm"></div>
    {/if}

    {#if ceremony.state !== 'normal' && ceremony.state !== 'night-calm'}
      <CeremonyOverlay
        state={ceremony.state}
        prayer={ceremony.prayer}
        prayerLabel={ceremony.prayer ? prayerLabels[ceremony.prayer] : ''}
        countdownEndsAtSeconds={ceremony.countdownEndsAtSeconds}
        {now}
        adhaanLabel={theme.label_adhaan}
        iqaamahLabel={theme.label_iqaamah}
      />
    {/if}
  </div>
{:else}
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
{/if}
