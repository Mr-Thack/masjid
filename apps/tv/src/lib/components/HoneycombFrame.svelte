<script lang="ts">
  /**
   * Honeycomb hairline frame (docs/design-language.md §7.3).
   *
   * Renders a tone-on-tone honeycomb band just inside the edges of its
   * (position: relative) parent. Ornament budget: pattern lives at edges
   * only, low contrast, never behind a numeral.
   *
   * The band MUST be at least one hexagon row tall (~17.3px). Anything
   * narrower only shows clipped slivers of the tiling and reads as random
   * "notches" instead of honeycomb (the 7px version had exactly this bug).
   *
   * Tiling math (flat-top hexagons, side s = 10):
   *  - hexagon spans x ∈ [-10, 10], y ∈ [-8.66, 8.66]
   *  - columns spaced 1.5s = 15 apart; odd columns offset by √3/2·s = 8.66
   *  - seamless tile: 30 × 17.32 with wrap copies on the edges
   */
  let { band = 18 }: { band?: number } = $props();

  const HEX = 'M 10 0 L 5 8.66 L -5 8.66 L -10 0 L -5 -8.66 L 5 -8.66 Z';
  const hexagons: Array<[number, number]> = [
    [0, 0],
    [30, 0],
    [0, 17.32],
    [30, 17.32],
    [15, 8.66],
  ];
</script>

<svg class="honeycomb-frame" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="honeycomb-tile" patternUnits="userSpaceOnUse" width="30" height="17.32">
      {#each hexagons as [cx, cy]}
        <path d={HEX} transform="translate({cx} {cy})" />
      {/each}
    </pattern>
  </defs>
  <rect
    x="0"
    y="0"
    width="100%"
    height="100%"
    fill="none"
    stroke="url(#honeycomb-tile)"
    stroke-width={band * 2}
  />
</svg>

<style>
  .honeycomb-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
    color: var(--color-accent, #d4af37);
    opacity: 0.15;
  }
  .honeycomb-frame pattern path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
  }
</style>
