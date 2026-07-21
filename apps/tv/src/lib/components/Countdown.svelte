<script lang="ts">
  let { nextPrayerIqaamah }: { nextPrayerIqaamah: string } = $props();

  let now = $state(new Date());

  function parseTime(value: string): { h: number; m: number } | null {
    const cleaned = value.trim();
    const periodMatch = cleaned.match(/\s*([AP])M$/i);
    const period = periodMatch?.[1]?.toUpperCase();
    const core = cleaned.replace(/\s*[AP]M$/i, '').trim();
    const [hStr, mStr] = core.split(':');
    let h = Number(hStr);
    let m = Number(mStr);
    if (hStr == null || mStr == null || Number.isNaN(h) || Number.isNaN(m)) return null;
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return { h, m };
  }

  let remaining = $derived.by(() => {
    const parsed = parseTime(nextPrayerIqaamah);
    if (parsed == null) return 0;
    const target = parsed.h * 3600 + parsed.m * 60;
    const current = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let diff = target - current;
    if (diff < 0) diff += 86400;
    return diff;
  });

  let display = $derived.by(() => {
    if (parseTime(nextPrayerIqaamah) == null) return '--:--';
    const hrs = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;
    if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}m`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  let isUrgent = $derived(remaining > 0 && remaining < 300);

  $effect(() => {
    const t = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(t);
  });
</script>

<span class="countdown-time {isUrgent ? 'countdown-time--urgent animate-pulse' : ''}">
  {display}
</span>