<script lang="ts">
  let { nextPrayerIqaamah }: { nextPrayerIqaamah: string } = $props();

  let now = $state(new Date());

  let remaining = $derived.by(() => {
    const [h, m] = nextPrayerIqaamah.split(':').map(Number);
    if (h == null || m == null) return 0;
    const target = h * 3600 + m * 60;
    const current = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let diff = target - current;
    if (diff < 0) diff += 86400;
    return diff;
  });

  let display = $derived.by(() => {
    const hrs = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  let isUrgent = $derived(remaining < 300);

  $effect(() => {
    const t = setInterval(() => {
      now = new Date();
    }, 1000);
    return () => clearInterval(t);
  });
</script>

<div class="flex flex-col items-center" class:animate-pulse={isUrgent}>
  <span class="text-sm uppercase tracking-[0.2em] text-gray-500 mb-1">Next Prayer in</span>
  <span
    class="text-4xl font-mono font-bold tabular-nums tracking-wider"
    class:text-gray-100={!isUrgent}
    style="color: {isUrgent ? 'var(--color-accent, #10b981)' : ''};"
  >
    {display}
  </span>
</div>