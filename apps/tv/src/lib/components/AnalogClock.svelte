<script lang="ts">
  /**
   * Analog clock. Default variant is the original Sakeenah wireframe.
   * `classic` is the Mishkaat face (docs/design-language.md §7.7): deep face,
   * gold hands, clean minute ticks.
   */
  let { now, classic = false }: { now: Date; classic?: boolean } = $props();

  let seconds = $derived(now.getSeconds());
  let minutes = $derived(now.getMinutes());
  let hours = $derived(now.getHours());

  let secondAngle = $derived(seconds * 6);
  let minuteAngle = $derived(minutes * 6 + seconds * 0.1);
  let hourAngle = $derived((hours % 12) * 30 + minutes * 0.5);

  const hourTicks = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  // Minute ticks at every 6° except where hour ticks already sit.
  const minuteTicks = Array.from({ length: 60 }, (_, i) => i * 6).filter((a) => a % 30 !== 0);
</script>

<svg
  viewBox="0 0 200 200"
  class="analog-clock"
  class:analog-clock--classic={classic}
  xmlns="http://www.w3.org/2000/svg"
  shape-rendering="geometricPrecision"
  aria-label="Analog clock showing {hours}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}"
>
  <circle cx="100" cy="100" r="95" class="clock-face" />
  {#if classic}
    <circle cx="100" cy="100" r="88" class="clock-inner-ring" />
  {/if}

  {#each hourTicks as angle}
    {@const isCardinal = angle % 90 === 0}
    <line
      x1="100"
      y1={isCardinal ? 10 : 8}
      x2="100"
      y2={isCardinal ? 18 : 14}
      class="clock-tick {isCardinal ? 'clock-tick--hour' : ''}"
      transform="rotate({angle} 100 100)"
    />
  {/each}

  {#if classic}
    {#each minuteTicks as angle}
      <line
        x1="100"
        y1="10"
        x2="100"
        y2="13.5"
        class="clock-tick clock-tick--minute"
        transform="rotate({angle} 100 100)"
      />
    {/each}
  {/if}

  <line
    x1="100"
    y1="100"
    x2="100"
    y2="44"
    class="clock-hand clock-hand--hour"
    transform="rotate({hourAngle} 100 100)"
  />

  <line
    x1="100"
    y1="100"
    x2="100"
    y2="30"
    class="clock-hand clock-hand--minute"
    transform="rotate({minuteAngle} 100 100)"
  />

  <line
    x1="100"
    y1="100"
    x2="100"
    y2="24"
    class="clock-hand clock-hand--second"
    transform="rotate({secondAngle} 100 100)"
  />

  <circle cx="100" cy="100" r="4" class="clock-center" />
</svg>

<style>
  .analog-clock {
    width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
    max-width: 210px;
    overflow: visible;
  }

  .clock-face {
    fill: var(--color-surface, rgba(17, 24, 39, 0.6));
    stroke: var(--color-border, rgba(55, 65, 81, 0.8));
    stroke-width: 2;
  }

  .clock-tick {
    stroke: var(--color-text-dim, #4b5563);
    stroke-width: 1.5;
  }

  .clock-tick--hour {
    stroke: var(--color-text-muted, #9ca3af);
    stroke-width: 2.5;
  }

  .clock-hand {
    stroke-linecap: round;
  }

  .clock-hand--hour {
    stroke: var(--color-text, #e5e7eb);
    stroke-width: 4;
  }

  .clock-hand--minute {
    stroke: var(--color-text-muted, #d1d5db);
    stroke-width: 2.5;
  }

  .clock-hand--second {
    stroke: var(--color-accent, #10b981);
    stroke-width: 1.5;
  }

  .clock-center {
    fill: var(--color-accent, #10b981);
  }

  /* === Classic face (Mishkaat, §7.7): deep face, gold hands, clean ticks === */
  .analog-clock--classic .clock-face {
    fill: var(--color-bg, #17100a);
    stroke: var(--color-accent, #d4af37);
    stroke-width: 2.5;
  }

  .analog-clock--classic .clock-inner-ring {
    fill: none;
    stroke: var(--color-border, rgba(212, 175, 55, 0.14));
    stroke-width: 1;
  }

  .analog-clock--classic .clock-tick {
    stroke: var(--color-text-dim, #9c8b6e);
  }

  .analog-clock--classic .clock-tick--hour {
    stroke: var(--color-accent, #d4af37);
  }

  .analog-clock--classic .clock-tick--minute {
    stroke-width: 0.75;
    opacity: 0.7;
  }

  .analog-clock--classic .clock-hand--hour {
    stroke: var(--color-text, #f3e9d2);
    stroke-width: 4.5;
  }

  .analog-clock--classic .clock-hand--minute {
    stroke: var(--color-accent-light, #e9cf7a);
    stroke-width: 3;
  }

  .analog-clock--classic .clock-hand--second {
    stroke: var(--color-accent, #d4af37);
  }
</style>
