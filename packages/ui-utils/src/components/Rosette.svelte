<script lang="ts">
  /**
   * Eight-point star rosette — the Mishkaat identity glyph
   * (docs/design-language.md §7.3): current-prayer marker, header divider,
   * arch apex detail. Two overlapping squares rotated 45°.
   *
   * Shared by the TV display and the consumer app (§7.11).
   *
   * Colors come from `currentColor` so CSS custom properties stay in control.
   */
  let { size = 16, stroke = false }: { size?: number; stroke?: boolean } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  class="rosette"
  class:rosette--stroke={stroke}
  aria-hidden="true"
  focusable="false"
>
  <rect x="5" y="5" width="14" height="14" />
  <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
  <circle cx="12" cy="12" r="2.4" class="rosette-center" />
</svg>

<style>
  .rosette {
    display: inline-block;
    flex-shrink: 0;
    vertical-align: middle;
  }
  .rosette rect {
    fill: currentColor;
  }
  .rosette--stroke rect {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
  }
  .rosette-center {
    fill: currentColor;
  }
  .rosette--stroke .rosette-center {
    fill: currentColor;
    stroke: none;
  }
</style>
