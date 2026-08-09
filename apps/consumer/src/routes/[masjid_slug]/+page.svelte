<script lang="ts">
  import { page } from '$app/stores';
  import PrayerTable from '$lib/components/PrayerTable.svelte';
  import HeroNiche from '$lib/components/HeroNiche.svelte';
  import HadithCard from '$lib/components/HadithCard.svelte';
  import { fetchPrayerTimes, type PrayerTimes } from '$lib/api';
  import { formatTime } from '$lib/time';
  import {
    computeCeremony,
    findNearestIqaamahChanges,
    getHadithOfTheDay,
    getHijriPartsCached,
    parseStyleOptions,
    resolveStyleOptions,
    resolveStyleSystem,
    type PrayerKey,
    type PrayerWindow,
  } from '@masjid/ui-utils';
  import type { DailyTimes } from '@masjid/schemas';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let hasDonationLinks = $derived(
    (() => {
      const raw = masjid?.donation_links;
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.some((l: { url?: string }) => l && l.url);
      } catch {
        return false;
      }
    })(),
  );
  let prayerTimes = $derived(data.prayer_times);
  let jumuah = $derived(data.jumuah);
  let pinnedAnnouncement = $derived(data.pinned_announcement);
  let homepagePost = $derived(data.homepage_post);
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

  let asrSecondaryLabel = $derived.by(() => {
    const primary = masjid?.asr_madhab ?? 'shafi';
    return primary === 'shafi' ? 'Asr (Hanafi)' : 'Asr (Shafi)';
  });

  let times = $derived(
    prayerNames.map((name) => ({
      name: prayerLabels[name]!,
      adhaan: prayerTimes?.[name]?.adhaan ?? '--:--',
      iqaamah: prayerTimes?.[name]?.iqaamah ?? '--:--',
      rightAfterAdhaan: prayerTimes?.[name]?.right_after_adhaan ?? false,
      sunrise: name === 'fajr' ? (prayerTimes?.sunrise ?? undefined) : undefined,
      ...(name === 'asr' && prayerTimes?.asr_secondary
        ? { asrSecondary: prayerTimes.asr_secondary, asrSecondaryLabel }
        : {}),
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
  let speechLabel = $derived(theme?.label_speech ?? 'Speech');
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

  // ── Mishkaat (docs/design-language.md §7.11) ─────────────────────────────
  let mishkaat = $derived(resolveStyleSystem(theme) === 'mishkaat');

  let nowSeconds = $derived(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());

  function toMinutes(t: string | null | undefined): number | null {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h != null && m != null && Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  }

  // Ceremony state machine (§7.6) — on the phone it drives only the hero
  // moment + hadith occasion tags; full-screen overlays stay on the TV.
  let ceremony = $derived.by(() => {
    if (!mishkaat || !prayerTimes) return null;
    const windows = {} as Record<PrayerKey, PrayerWindow>;
    for (const name of prayerNames) {
      const adhaan = toMinutes(prayerTimes[name]?.adhaan);
      const iqaamah = toMinutes(prayerTimes[name]?.iqaamah);
      if (adhaan == null || iqaamah == null) return null;
      windows[name] = { adhaan, iqaamah };
    }
    const sunriseMinutes = toMinutes(prayerTimes.sunrise);
    if (sunriseMinutes == null) return null;
    const options = resolveStyleOptions(parseStyleOptions(theme?.style_options ?? null));
    return computeCeremony({
      nowSeconds,
      dayOfWeek: now.getDay(),
      prayers: windows,
      sunriseMinutes,
      hijri: getHijriPartsCached(now),
      quietHours: options.quietHours,
      ambientEnabled: false, // the ambient background is the layout's job
    });
  });

  // Hero moment: at adhaan the hero names the prayer; between adhaan and
  // iqaamah it counts down to iqaamah; otherwise the usual countdown.
  let heroMoment = $derived.by(() => {
    const c = ceremony;
    if (!c) return null;
    if (c.state === 'adhaan' && c.prayer) return { kind: 'adhaan' as const, prayer: c.prayer };
    if (c.state === 'iqaamah-countdown' && c.prayer && c.countdownEndsAtSeconds != null) {
      return { kind: 'iqaamah' as const, prayer: c.prayer, endsAt: c.countdownEndsAtSeconds };
    }
    return null;
  });

  let heroLabel = $derived.by(() => {
    if (heroMoment?.kind === 'adhaan') return theme?.label_adhaan ?? 'Adhaan';
    if (heroMoment?.kind === 'iqaamah') {
      return `${prayerLabels[heroMoment.prayer]} ${theme?.label_iqaamah ?? 'Iqaamah'} in`;
    }
    return `${nextPrayerName} in`;
  });

  let heroCountdown = $derived.by(() => {
    if (heroMoment?.kind === 'iqaamah') {
      const left = Math.max(0, heroMoment.endsAt - nowSeconds);
      const hrs = Math.floor(left / 3600);
      const mins = Math.floor((left % 3600) / 60);
      const secs = left % 60;
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return countdownDisplay;
  });

  // Hadith of the Day — same curated collection + date-seeded pick as the
  // TV hadith frame, context-seeded by Friday / Ramadan / current prayer.
  let hadith = $derived.by(() => {
    if (!mishkaat) return null;
    return getHadithOfTheDay(now);
  });

  // Jumu'ah pinning — mirrors the soul-column rule: pinned Thursday–Friday.
  let jumuahPinned = $derived(mishkaat && hasJumuah && (now.getDay() === 4 || now.getDay() === 5));

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

  async function loadUpcomingChanges(reference: Date = new Date()) {
    if (!masjid?.slug || !prayerTimes) return;
    loadingChanges = true;
    changesError = '';

    try {
      const baseIqaamahs: Record<string, { iqaamah: string }> = {};
      for (const name of prayerNames) {
        baseIqaamahs[name] = { iqaamah: prayerTimes[name]?.iqaamah ?? '--:--' };
      }

      const futureDays: Array<{ date: string; times: Record<string, { iqaamah: string }> }> = [];

      for (let offset = 1; offset <= 6; offset++) {
        const date = addDays(reference, offset);
        const iso = formatDate(date);
        const result: DailyTimes = await fetchPrayerTimes(masjid.slug, iso);
        const dayTimes = result.times as unknown as PrayerTimes;

        const timesByName: Record<string, { iqaamah: string }> = {};
        for (const name of prayerNames) {
          timesByName[name] = { iqaamah: dayTimes[name]?.iqaamah ?? '--:--' };
        }
        futureDays.push({ date: iso, times: timesByName });
      }

      const rawChanges = findNearestIqaamahChanges(baseIqaamahs, futureDays, [...prayerNames]);

      upcomingChanges = rawChanges.map((change) => ({
        date: new Date(change.date + 'T12:00:00'),
        prayerKey: change.prayer,
        prayerLabel: prayerLabels[change.prayer] ?? change.prayer,
        from: change.from,
        to: change.to,
      }));
    } catch (e) {
      console.error('Failed to load upcoming changes', e);
      changesError = 'Could not load upcoming changes.';
      upcomingChanges = [];
    } finally {
      loadingChanges = false;
    }
  }

  $effect(() => {
    if (!masjid?.slug || !prayerTimes) return;
    loadUpcomingChanges();
  });
</script>

<svelte:head>
  <title>{masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div class="lg:col-span-2 space-y-6">
    <section class="text-center py-6">
      {#if mishkaat}
        <h1 class="text-2xl sm:text-3xl font-bold mb-5 font-heading">
          {masjid?.name ?? 'Masjid'}
        </h1>
        <HeroNiche>
          <span class="c-hero-label">{heroLabel}</span>
          {#if heroMoment?.kind === 'adhaan'}
            <span class="c-hero-moment">{prayerLabels[heroMoment.prayer]}</span>
          {:else}
            <span class="c-hero-countdown">{heroCountdown}</span>
          {/if}
          <div class="c-hero-dates">
            <p class="c-hero-gregorian">{gregorianDate}</p>
            <p class="c-hero-hijri">{hijriDate}</p>
          </div>
        </HeroNiche>
      {:else}
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
      {/if}
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-3 uppercase tracking-wider font-heading text-accent">
        Prayer Times
      </h2>
      {#if prayerTimes && Object.keys(prayerTimes).length > 0}
        <PrayerTable
          {times}
          labels={{ adhaan: theme?.label_adhaan ?? 'Adhaan', iqaamah: theme?.label_iqaamah ?? 'Iqaamah', sunrise: theme?.label_sunrise ?? 'Sunrise' }}
          timeFormat={theme?.time_format ?? '24h'}
          {currentPrayerIndex}
          {nextPrayerIndex}
          rosetteMarker={mishkaat}
        />
      {:else}
        <div class="h-60 rounded-lg animate-shimmer" style="background: var(--color-surface);"></div>
      {/if}
    </section>

    {#if hadith}
      <HadithCard entry={hadith} />
    {/if}

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

  {#snippet jumuahSection()}
    {#if hasJumuah}
      <section>
        <h2 class="text-lg font-semibold mb-1 uppercase tracking-wider text-accent font-heading">
          {jumuahLabel} Timings
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {#each jumuah ?? [] as session}
            <div class="glass-card p-4">
              {#if session.speech_time}
                <p class="text-xs" style="color: var(--color-text-dim);">{speechLabel} @ {formatTime(session.speech_time, timeFormat)}</p>
              {/if}
              <p class="text-xl font-bold tabular-nums mt-1 text-accent">
                {formatTime(session.time, timeFormat)}
                {#if session.khateeb}
                  <span class="text-base font-normal ml-2" style="color: var(--color-text-muted);">— {session.khateeb}</span>
                {/if}
              </p>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/snippet}

  <aside class="space-y-6 lg:pt-6">
    {#if jumuahPinned}
      {@render jumuahSection()}
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

    {#if homepagePost}
      <section>
        <h2 class="text-lg font-semibold mb-3 uppercase tracking-wider text-accent font-heading">
          {homepagePost.title}
        </h2>
        <div class="glass-card p-5 border-l-4" style="border-left-color: var(--color-accent);">
          <div class="text-sm leading-relaxed" style="color: var(--color-text-muted);">
            {@html homepagePost.compiled_html}
          </div>
        </div>
      </section>
    {/if}

    {#if !jumuahPinned}
      {@render jumuahSection()}
    {/if}

    {#if hasDonationLinks}
      <section class="text-center">
        <a
          href="/{masjid?.slug}/donate"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white no-underline transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 bg-accent shadow-lg"
          style="text-shadow: 0 1px 2px rgba(0,0,0,0.2);"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          Support This Masjid
        </a>
      </section>
    {/if}
  </aside>
</div>
