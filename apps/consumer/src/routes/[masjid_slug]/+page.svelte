<script lang="ts">
  import { page } from '$app/stores';
  import PrayerTable from '$lib/components/PrayerTable.svelte';
  import HeroNiche from '$lib/components/HeroNiche.svelte';
  import StarBand from '@masjid/ui-utils/components/StarBand.svelte';
  import { formatTime, type TimeFormat } from '$lib/time';
  import {
    computeCeremony,
    getHijriPartsCached,
    parseStyleOptions,
    resolveStyleOptions,
    resolveStyleSystem,
    type PrayerKey,
    type PrayerWindow,
  } from '@masjid/ui-utils';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let prayerTimes = $derived(data.prayer_times);

  function parseDonationLinks(raw: string | null | undefined): { label: string; url: string }[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((l: { url?: string }) => l && l.url) : [];
    } catch {
      return [];
    }
  }
  let jumuah = $derived(data.jumuah);
  let pinnedAnnouncement = $derived(data.pinned_announcement);
  let homepagePost = $derived(data.homepage_post);
  let theme = $derived(data.theme);

  let now = $state(new Date());

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

  let prayerLabels: Record<string, string> = $derived({
    fajr: (theme?.label_fajr as string) ?? 'Fajr',
    dhuhr: (theme?.label_dhuhr as string) ?? 'Dhuhr',
    asr: (theme?.label_asr as string) ?? 'Asr',
    maghrib: (theme?.label_maghrib as string) ?? 'Maghrib',
    isha: (theme?.label_isha as string) ?? 'Isha',
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
      ...(name === 'asr' && (prayerTimes as any)?.asr_secondary
        ? { asrSecondary: (prayerTimes as any).asr_secondary, asrSecondaryLabel }
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
  let timeFormat = $derived(((theme?.time_format as string) ?? '24h') as TimeFormat);

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

  // ── Resolved style options (shared between ceremony + hero photo) ────────
  let opts = $derived(resolveStyleOptions(parseStyleOptions(theme?.style_options as string | Record<string, unknown> | null ?? null)));

  // ── Mishkaat (docs/design-language.md §7.11) ─────────────────────────────
  let mishkaat = $derived(resolveStyleSystem(theme) === 'mishkaat');

  let nowSeconds = $derived(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());

  function toMinutes(t: string | null | undefined): number | null {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h != null && m != null && Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  }

  // Ceremony state machine (§7.6) — on the phone it drives only the hero
  // moment; full-screen overlays stay on the TV.
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
    return computeCeremony({
      nowSeconds,
      dayOfWeek: now.getDay(),
      prayers: windows,
      sunriseMinutes,
      hijri: getHijriPartsCached(now),
      quietHours: opts.quietHours,
      ambientEnabled: false,
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

  // Jumu'ah pinning — mirrors the soul-column rule: pinned Thursday–Friday.
  let jumuahPinned = $derived(mishkaat && hasJumuah && (now.getDay() === 4 || now.getDay() === 5));

  $effect(() => {
    const t = setInterval(() => {
      now = new Date();
    }, 1000);
    return () => clearInterval(t);
  });
</script>

<svelte:head>
  <title>{masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<!-- ── Photo hero — full width, above the two-column grid ──────────────── -->
{#if opts.photoUrl}
  <section class="c-hero-photo mb-6" style="background-image: url({opts.photoUrl})">
    <div class="c-hero-photo-overlay">
      <h1 class="c-hero-photo-title">{masjid?.name ?? 'Masjid'}</h1>
      <div class="c-hero-photo-count">
        <span>{heroLabel}</span>
        <span>{heroCountdown}</span>
      </div>
      <div class="c-hero-photo-dates">
        <p>{gregorianDate}</p>
        <p>{hijriDate}</p>
      </div>
    </div>
  </section>
{/if}

<!--
  Two-column grid (desktop): LEFT 2/3 = content (announcements → post →
  donate), RIGHT 1/3 = timings (hero → prayer table → jumu'ah). Every child
  has an explicit lg col/row placement so there is no orphan empty cell.
  Mobile (single column): hero → announcements → post → donate → prayer →
  jumu'ah, driven by the order-* classes.
-->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <!-- ── Fallback hero — top of the timings column ─────────────────────── -->
  {#if !opts.photoUrl}
    <section class="order-1 lg:col-start-3 lg:row-start-1 text-center py-6 lg:py-0">
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
            <h1 class="text-2xl sm:text-3xl font-bold mb-2 font-heading">
              {masjid?.name ?? 'Masjid'}
            </h1>
            <div class="mt-6 glass-card flex flex-col items-center gap-3 w-full max-w-sm mx-auto px-6 py-5">
              <span class="text-xs uppercase tracking-[0.2em]" style="color: var(--color-text-dim);">
                {nextPrayerName} in
              </span>
              <span class="text-4xl font-mono font-bold tabular-nums text-accent">
                {countdownDisplay}
              </span>
            </div>
            <p class="mt-3 text-sm" style="color: var(--color-text-dim);">{gregorianDate}</p>
            <p class="text-xs" style="color: var(--color-text-dim);">{hijriDate}</p>
          </div>
        </div>
      {/if}
    </section>
  {/if}

  <!-- ── Content column (left 2/3) — announcements → post → donate ────── -->
  <div
    class="{opts.photoUrl ? 'order-1' : 'order-2'} lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-3 space-y-6"
  >
    {#if pinnedAnnouncement}
      <section class="c-announce-prominent glass-card p-5 border-l-4" style="border-left-color: var(--color-accent);">
        <h2 class="text-lg font-semibold mb-3 uppercase tracking-wider text-accent font-heading">
          Announcement
        </h2>
        <h3 class="text-base font-bold mb-2" style="color: var(--color-text);">{pinnedAnnouncement.title}</h3>
        <div class="text-sm leading-relaxed" style="color: var(--color-text-muted);">
          {@html pinnedAnnouncement.compiled_html}
        </div>
      </section>
    {/if}

    {#if pinnedAnnouncement && homepagePost}
      <div class="c-section-divider" aria-hidden="true">
        <StarBand band={14} />
      </div>
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

    {#if parseDonationLinks(masjid?.donation_links).length > 0}
      <section class="text-center lg:text-left">
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
  </div>

  <!-- ── Timings column (right 1/3) — prayer table + jumu'ah ──────────── -->
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
                  <span class="text-base font-normal ml-2" style="color: var(--color-text-muted);">&mdash; {session.khateeb}</span>
                {/if}
              </p>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/snippet}

  <div
    class="{opts.photoUrl ? 'order-2' : 'order-3'} lg:col-start-3 {opts.photoUrl ? 'lg:row-start-1' : 'lg:row-start-2'} lg:row-span-2 space-y-6"
  >
    {#if jumuahPinned}
      {@render jumuahSection()}
    {/if}

    <section class="c-prayer-compact">
      <h2 class="text-lg font-semibold mb-3 uppercase tracking-wider font-heading text-accent">
        Today&rsquo;s Prayer Times
      </h2>
      {#if prayerTimes && Object.keys(prayerTimes).length > 0}
        <PrayerTable
          {times}
          labels={{ adhaan: (theme?.label_adhaan as string) ?? 'Adhaan', iqaamah: (theme?.label_iqaamah as string) ?? 'Iqaamah', sunrise: (theme?.label_sunrise as string) ?? 'Sunrise' }}
          timeFormat={timeFormat}
          {currentPrayerIndex}
          {nextPrayerIndex}
          rosetteMarker={mishkaat}
        />
      {:else}
        <div class="h-60 rounded-lg animate-shimmer" style="background: var(--color-surface);"></div>
      {/if}
    </section>

    {#if !jumuahPinned}
      {@render jumuahSection()}
    {/if}
  </div>
</div>