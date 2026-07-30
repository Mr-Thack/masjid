<script lang="ts">
  /**
   * Mihrab arch (docs/design-language.md §7.3): exactly one arch per
   * screen, with the eight-point star rosette at its apex. Rendered as a
   * tone-on-tone outline — ornament, never behind numerals.
   *
   * The arch is the niche for the clock + digital time + next-prayer
   * indicators (soul column, `.tv-clock-niche`). The viewBox is a wide,
   * tall mihrab (140×150, legs down to y=146): the broad curved belly
   * inscribes the clock, and the straight hall between the legs holds the
   * text stack.
   */
  let { width = 140 }: { width?: number } = $props();
</script>

<svg
  viewBox="0 0 140 150"
  width={width}
  class="arch-crest"
  aria-hidden="true"
  focusable="false"
>
  <!-- outer arch -->
  <path
    d="M 10 146 L 10 64 C 10 30 46 22 70 8 C 94 22 130 30 130 64 L 130 146"
    class="arch-line arch-line--outer"
  />
  <!-- inner echo -->
  <path
    d="M 21 146 L 21 66 C 21 38 52 29 70 19 C 88 29 119 38 119 66 L 119 146"
    class="arch-line arch-line--inner"
  />
  <!-- rosette at the apex -->
  <g transform="translate(70 8)" class="arch-rosette">
    <rect x="-4.6" y="-4.6" width="9.2" height="9.2" />
    <rect x="-4.6" y="-4.6" width="9.2" height="9.2" transform="rotate(45)" />
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
