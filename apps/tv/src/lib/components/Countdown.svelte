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

<div class="countdown-wrapper">
  <span class="countdown-label {isUrgent ? 'animate-pulse' : ''}"
    >Next Prayer in</span
  >
  <span
    class="countdown-time {isUrgent ? 'countdown-time--urgent animate-pulse' : ''}"
  >
    {display}
  </span>
</div>
