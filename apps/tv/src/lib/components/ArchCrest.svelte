<script lang="ts">
  /**
   * Mihrab arch (docs/design-language.md §7.3): exactly one arch per
   * screen, with the eight-point star rosette at its apex. Rendered as a
   * tone-on-tone outline — ornament, never behind numerals.
   *
   * The arch is the niche for the clock + digital time + next-prayer
   * indicators (soul column, `.tv-clock-niche`). The viewBox is elongated
   * (100×150, legs down to y=146) so the straight hall below the curved
   * belly can hold the text stack — a real mihrab is taller than wide.
   */
  let { width = 120 }: { width?: number } = $props();
</script>

<svg
  viewBox="0 0 100 150"
  width={width}
  class="arch-crest"
  aria-hidden="true"
  focusable="false"
>
  <!-- outer arch -->
  <path
    d="M 8 146 L 8 62 C 8 32 34 26 50 10 C 66 26 92 32 92 62 L 92 146"
    class="arch-line arch-line--outer"
  />
  <!-- inner echo -->
  <path
    d="M 18 146 L 18 64 C 18 40 38 34 50 22 C 62 34 82 40 82 64 L 82 146"
    class="arch-line arch-line--inner"
  />
  <!-- rosette at the apex -->
  <g transform="translate(50 10)" class="arch-rosette">
    <rect x="-4.2" y="-4.2" width="8.4" height="8.4" />
    <rect x="-4.2" y="-4.2" width="8.4" height="8.4" transform="rotate(45)" />
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
