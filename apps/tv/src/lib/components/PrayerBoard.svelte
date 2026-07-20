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

<div class="prayer-board">
  {#each times as row, i}
    {@const isNext = i === nextPrayerIndex}
    <div
      class="prayer-row {isNext ? 'prayer-row--next' : ''}"
      style="border-color: {isNext ? accentColor : '#1f2937'};"
    >
      <div class="prayer-name">
        <span
          class="prayer-name-text {isNext ? 'prayer-name-text--next' : ''}"
          style="opacity: {visible >= 1 ? 1 : 0}; transform: translateY({visible >= 1 ? '0' : '8px'}); transition: opacity 0.6s ease-out {i * 80}ms, transform 0.6s ease-out {i * 80}ms;"
        >
          {row.name}
        </span>
      </div>

      <div class="prayer-adhaan">
        <span
          class="prayer-adhaan-text"
          style="opacity: {visible >= 1 ? 1 : 0}; transform: translateY({visible >= 1 ? '0' : '8px'}); transition: opacity 0.6s ease-out {i * 80 + 100}ms, transform 0.6s ease-out {i * 80 + 100}ms;"
        >
          {row.adhaan}
        </span>
      </div>

      <div class="prayer-iqaamah">
        <span
          class="prayer-iqaamah-text {isNext ? 'prayer-iqaamah-text--next' : ''}"
          style="opacity: {visible >= 1 ? 1 : 0}; transform: translateY({visible >= 1 ? '0' : '8px'}); transition: opacity 0.6s ease-out {i * 80 + 200}ms, transform 0.6s ease-out {i * 80 + 200}ms;"
        >
          {row.iqaamah}
        </span>
      </div>
    </div>
  {/each}
</div>