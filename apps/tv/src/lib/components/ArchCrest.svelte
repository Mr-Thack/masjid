<script lang="ts">
  /**
   * Mihrab arch (docs/design-language.md §7.3): exactly one arch per
   * screen, with the eight-point star rosette at its apex. Rendered as a
   * tone-on-tone outline — ornament, never behind numerals.
   *
   * The arch is the niche for the clock + next-prayer indicators (soul
   * column, `.tv-clock-niche`). Geometry is the canonical shared mihrab
   * from `@masjid/ui-utils` (`arch.ts`) — the same arch the consumer hero
   * niche draws (§7.11).
   */
  import {
    MIHRAB_APEX_ROSETTE,
    MIHRAB_ARCH_VIEWBOX,
    MIHRAB_INNER_PATH,
    MIHRAB_OUTER_PATH,
  } from '@masjid/ui-utils';

  let { width = 140 }: { width?: number } = $props();
</script>

<svg
  viewBox="0 0 {MIHRAB_ARCH_VIEWBOX.width} {MIHRAB_ARCH_VIEWBOX.height}"
  width={width}
  class="arch-crest"
  aria-hidden="true"
  focusable="false"
>
  <!-- outer arch -->
  <path d={MIHRAB_OUTER_PATH} class="arch-line arch-line--outer" />
  <!-- inner echo -->
  <path d={MIHRAB_INNER_PATH} class="arch-line arch-line--inner" />
  <!-- rosette at the apex -->
  <g transform="translate({MIHRAB_APEX_ROSETTE.x} {MIHRAB_APEX_ROSETTE.y})" class="arch-rosette">
    <rect
      x={-MIHRAB_APEX_ROSETTE.size / 2}
      y={-MIHRAB_APEX_ROSETTE.size / 2}
      width={MIHRAB_APEX_ROSETTE.size}
      height={MIHRAB_APEX_ROSETTE.size}
    />
    <rect
      x={-MIHRAB_APEX_ROSETTE.size / 2}
      y={-MIHRAB_APEX_ROSETTE.size / 2}
      width={MIHRAB_APEX_ROSETTE.size}
      height={MIHRAB_APEX_ROSETTE.size}
      transform="rotate(45)"
    />
  </g>
</svg>

<style>
  .arch-crest {
    display: block;
    height: auto;
    color: var(--color-accent, #d4af37);
  }
  .arch-line {
    fill: none;
    stroke: currentColor;
  }
  .arch-line--outer {
    stroke-width: 1.6;
    opacity: 0.55;
  }
  .arch-line--inner {
    stroke-width: 1;
    opacity: 0.3;
  }
  .arch-rosette rect {
    fill: currentColor;
    opacity: 0.75;
  }
</style>
