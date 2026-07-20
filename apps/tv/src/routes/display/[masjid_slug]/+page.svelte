<script lang="ts">
  import type { PagePayload } from '../../lib/api';
  import { onMount } from 'svelte';
  import PrayerBoard from '$lib/components/PrayerBoard.svelte';
  import AnnouncementBanner from '$lib/components/AnnouncementBanner.svelte';
  import Countdown from '$lib/components/Countdown.svelte';
  import JumuahNotice from '$lib/components/JumuahNotice.svelte';

  let { data }: { data: PagePayload } = $props();

  let payload = $state(data);
  let refreshKey = $state(0);

  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  const prayerLabels: Record<string, string> = {
    fajr: 'Fajr',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
  };

  interface PrayerTimeEntry {
    name: string;
    adhaan: string;
    iqaamah: string;
  }

  let times = $derived(
    prayerNames.map((name) => ({
      name: prayerLabels[name]!,
      adhaan: payload.prayer_times[name]?.adhaan ?? '--:--',
      iqaamah: payload.prayer_times[name]?.iqaamah ?? '--:--',
    })),
  );

  let now = $state(new Date());

  let nextPrayerIndex = $derived.by(() => {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < prayerNames.length; i++) {
      const iqaamah = payload.prayer_times[prayerNames[i]!]?.iqaamah;
      if (!iqaamah) continue;
      const [h, m] = iqaamah.split(':').map(Number);
      const iqaamahMinutes = h! * 60 + m!;
      if (iqaamahMinutes > currentMinutes) return i;
    }
    return 0;
  });

  let nextPrayerIqaamah = $derived(
    times[nextPrayerIndex]?.iqaamah ?? '--:--',
  );

  let isFriday = $derived(now.getDay() === 5);
  let hasJumuah = $derived(payload.jumuah.length > 0);

  let formattedDate = $derived(
    now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  );

  let formattedTime = $derived(
    now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  );

  async function refresh() {
    try {
      const res = await fetch(`/api/v1/masjids/${payload.masjid.slug}`);
      if (res.ok) {
        const fresh = await res.json();
        payload = fresh;
        refreshKey++;
        now = new Date();
      }
    } catch {
      // silently continue with stale data
    }
  }

  $effect(() => {
    const tick = setInterval(() => {
      now = new Date();
    }, 1000);

    const poll = setInterval(() => {
      refresh();
    }, 60000);

    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  });
</script>

<div
  class="min-h-screen w-screen bg-gray-950 text-gray-100 flex flex-col select-none overflow-hidden"
  style="--color-primary: {payload.theme.primary_color}; --color-accent: {payload.theme.accent_color}; --font-heading: '{payload.theme.font_heading}', sans-serif; --font-body: '{payload.theme.font_body}', sans-serif; font-family: var(--font-body);"
>
  <header
    class="flex items-center justify-between px-10 py-6 border-b border-gray-800/50"
  >
    <div class="flex flex-col">
      <h1
        class="text-4xl font-bold tracking-tight"
        style="font-family: var(--font-heading); color: var(--color-primary);"
      >
        {payload.masjid.name}
      </h1>
      {#if payload.masjid.city}
        <p class="text-gray-400 text-lg mt-1">{payload.masjid.city}</p>
      {/if}
    </div>
    <div class="text-right">
      <p class="text-xl text-gray-300">{formattedDate}</p>
      <p class="text-2xl font-semibold text-gray-100 mt-1">{formattedTime}</p>
    </div>
  </header>

  <main class="flex-1 flex flex-col items-center justify-center px-10">
    <div class="w-full max-w-5xl">
      <PrayerBoard
        {times}
        nextPrayerIndex={nextPrayerIndex}
        accentColor={payload.theme.accent_color}
        key={refreshKey}
      />
    </div>

    <div class="mt-10 flex items-center gap-6">
      <Countdown nextPrayerIqaamah={nextPrayerIqaamah} />
      {#if isFriday && hasJumuah}
        <JumuahNotice sessions={payload.jumuah} />
      {/if}
    </div>
  </main>

  {#if payload.pinned_announcement}
    <AnnouncementBanner
      announcement={payload.pinned_announcement}
      accentColor={payload.theme.accent_color}
    />
  {/if}
</div>