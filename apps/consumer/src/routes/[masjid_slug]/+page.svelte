<script lang="ts">
  import { page } from '$app/stores';
  import PrayerList from '$lib/components/PrayerList.svelte';
  import DonateButton from '$lib/components/DonateButton.svelte';
  import SkeletonPrayerCard from '$lib/components/SkeletonPrayerCard.svelte';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let prayerTimes = $derived(data.prayer_times);
  let jumuah = $derived(data.jumuah);
  let pinnedAnnouncement = $derived(data.pinned_announcement);

  let now = $state(new Date());
  let ready = $state(false);

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  const prayerLabels: Record<string, string> = {
    fajr: 'Fajr',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
  };

  let times = $derived(
    prayerNames.map((name) => ({
      name: prayerLabels[name]!,
      adhaan: prayerTimes?.[name]?.adhaan ?? '--:--',
      iqaamah: prayerTimes?.[name]?.iqaamah ?? '--:--',
    })),
  );

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

  let nextPrayerIqaamah = $derived(times[nextPrayerIndex]?.iqaamah ?? '--:--');
  let nextPrayerName = $derived(times[nextPrayerIndex]?.name ?? '');

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
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  let isFriday = $derived(now.getDay() === 5);
  let hasJumuah = $derived((jumuah?.length ?? 0) > 0);

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
      if (!ready) ready = true;
    }, 1000);
    return () => clearInterval(t);
  });
</script>

<div class="space-y-6">
  <section class="text-center py-6">
    <div class="relative">
      <div class="geometric-pattern absolute inset-0 rounded-2xl"></div>
      <div class="relative z-10">
        <h1 class="text-2xl sm:text-3xl font-bold mb-2 font-heading">
          {masjid?.name ?? 'Masjid'}
        </h1>
        {#if masjid?.city}
          <p class="text-sm" style="color: var(--color-text-muted);">
            {masjid.city}{masjid?.state ? `, ${masjid.state}` : ''}
          </p>
        {/if}

        <div class="mt-6 glass-card inline-flex flex-col items-center gap-2 px-6 py-4">
          <span class="text-xs uppercase tracking-[0.2em]" style="color: var(--color-text-dim);">
            {nextPrayerName} in
          </span>
          <span class="text-3xl sm:text-4xl font-mono font-bold tabular-nums text-accent">
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
    {#if ready}
      <PrayerList {times} {nextPrayerIndex} />
    {:else}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SkeletonPrayerCard />
        <SkeletonPrayerCard />
        <SkeletonPrayerCard />
        <SkeletonPrayerCard />
        <SkeletonPrayerCard />
      </div>
    {/if}
  </section>

  {#if isFriday && hasJumuah}
    <section>
      <h2 class="text-lg font-semibold mb-3 uppercase tracking-wider text-accent font-heading">
        Jumu'ah Today
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {#each jumuah ?? [] as session}
          <div class="glass-card p-4">
            <p class="text-sm font-semibold" style="color: var(--color-text-muted);">{session.label}</p>
            <p class="text-2xl font-bold tabular-nums mt-1 text-accent">
              {session.time}
            </p>
            {#if session.khateeb}
              <p class="text-sm mt-1" style="color: var(--color-text-muted);">{session.khateeb}</p>
            {/if}
            {#if session.location}
              <p class="text-xs mt-0.5" style="color: var(--color-text-dim);">{session.location}</p>
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
    <section class="text-center pt-2">
      <DonateButton url={masjid.external_donation_url} />
    </section>
  {/if}
</div>