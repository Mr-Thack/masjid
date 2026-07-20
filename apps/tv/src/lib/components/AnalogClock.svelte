<script lang="ts">
  let { now }: { now: Date } = $props();

  let seconds = $derived(now.getSeconds());
  let minutes = $derived(now.getMinutes());
  let hours = $derived(now.getHours());

  let secondAngle = $derived(seconds * 6);
  let minuteAngle = $derived(minutes * 6 + seconds * 0.1);
  let hourAngle = $derived((hours % 12) * 30 + minutes * 0.5);
</script>

<svg
  viewBox="0 0 200 200"
  class="analog-clock"
  xmlns="http://www.w3.org/2000/svg"
  aria-label="Analog clock showing {hours}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}"
>
  <circle cx="100" cy="100" r="95" class="clock-face" />

  {#each [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as angle}
    {@const isHour = angle % 90 === 0}
    <line
      x1="100"
      y1={isHour ? 10 : 8}
      x2="100"
      y2={isHour ? 18 : 14}
      class="clock-tick {isHour ? 'clock-tick--hour' : ''}"
      transform="rotate({angle} 100 100)"
    />
  {/each}

  <line
    x1="100"
    y1="100"
    x2="100"
    y2="42"
    class="clock-hand clock-hand--hour"
    transform="rotate({hourAngle} 100 100)"
  />

  <line
    x1="100"
    y1="100"
    x2="100"
    y2="28"
    class="clock-hand clock-hand--minute"
    transform="rotate({minuteAngle} 100 100)"
  />

  <line
    x1="100"
    y1="100"
    x2="100"
    y2="20"
    class="clock-hand clock-hand--second"
    transform="rotate({secondAngle} 100 100)"
  />

  <circle cx="100" cy="100" r="4" class="clock-center" />
</svg>

<style>
  .analog-clock {
    width: 100%;
    height: auto;
    max-width: 220px;
    display: block;
    margin: 0 auto;
  }

  .clock-face {
    fill: rgba(17, 24, 39, 0.6);
    stroke: rgba(55, 65, 81, 0.8);
    stroke-width: 2;
  }

  .clock-tick {
    stroke: #4b5563;
    stroke-width: 1.5;
  }

  .clock-tick--hour {
    stroke: #9ca3af;
    stroke-width: 2.5;
  }

  .clock-hand {
    stroke-linecap: round;
    transform-origin: 100px 100px;
  }

  .clock-hand--hour {
    stroke: #e5e7eb;
    stroke-width: 4;
  }

  .clock-hand--minute {
    stroke: #d1d5db;
    stroke-width: 2.5;
  }

  .clock-hand--second {
    stroke: var(--color-accent, #10b981);
    stroke-width: 1.5;
  }

  .clock-center {
    fill: var(--color-accent, #10b981);
  }
</style>