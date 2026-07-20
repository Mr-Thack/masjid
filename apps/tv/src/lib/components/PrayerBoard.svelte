<script lang="ts">
  interface PrayerRow {
    name: string;
    adhaan: string;
    iqaamah: string;
  }

  let {
    times,
    nextPrayerIndex = 0,
    accentColor = '#10b981',
    key,
  }: {
    times: PrayerRow[];
    nextPrayerIndex: number;
    accentColor: string;
    key: number;
  } = $props();

  let visible = $state(0);

  $effect(() => {
    visible = 1;
    const t = setTimeout(() => {
      visible = 2;
    }, 300);
    return () => clearTimeout(t);
  });

  $effect(() => {
    key;
    visible = 0;
    requestAnimationFrame(() => {
      visible = 1;
    });
  });
</script>

<div class="grid grid-cols-1 gap-3 w-full">
  {#each times as row, i}
    {@const isNext = i === nextPrayerIndex}
    <div
      class="flex items-center rounded-xl border px-6 py-5 transition-all duration-700"
      class:bg-gray-900/80={!isNext}
      class:bg-gray-800/90={isNext}
      class:border-gray-800={!isNext}
      class:border-accent={isNext}
      style="border-color: {isNext ? accentColor : ''}; --accent: {accentColor};"
    >
      <style>
        .border-accent {
          border-color: var(--accent);
        }
      </style>
      <div class="w-40 flex-shrink-0">
        <span
          class="text-3xl font-bold tracking-widest uppercase"
          class:text-gray-100={!isNext}
          style="color: {isNext ? accentColor : ''}; font-family: var(--font-heading); opacity: {visible >= 1 ? 1 : 0}; transform: translateY({visible >= 1 ? '0' : '8px'}); transition: all 0.6s ease-out {i * 80}ms;"
        >
          {row.name}
        </span>
      </div>

      <div class="flex-1 flex items-center justify-center">
        <span class="text-4xl font-light text-gray-400 tabular-nums tracking-wider"
          style="opacity: {visible >= 1 ? 1 : 0}; transform: translateY({visible >= 1 ? '0' : '8px'}); transition: all 0.6s ease-out {i * 80 + 100}ms;"
        >
          {row.adhaan}
        </span>
      </div>

      <div class="w-40 flex-shrink-0 text-right">
        <span
          class="text-5xl font-extrabold tabular-nums tracking-wider"
          style="color: {isNext ? accentColor : '#f9fafb'}; opacity: {visible >= 1 ? 1 : 0}; transform: translateY({visible >= 1 ? '0' : '8px'}); transition: all 0.6s ease-out {i * 80 + 200}ms;"
        >
          {row.iqaamah}
        </span>
      </div>
    </div>
  {/each}
</div>