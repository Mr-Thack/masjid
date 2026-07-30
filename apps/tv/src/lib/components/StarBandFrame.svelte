<script lang="ts">
  /**
   * Eight-point-star band (docs/design-language.md §7.3, default motif).
   *
   * Khatam tiling just inside the edges of the (position: relative) parent:
   * eight-point stars interlocking with octagons — the same star as the
   * header rosette, so the whole screen shares one geometry. Tone-on-tone,
   * edges only, never behind a numeral.
   *
   * As with the honeycomb band, the band MUST be at least one row tall
   * (~26px) with air around the stars, or the tiling clips into mush.
   *
   * Tiling math (tile 34 × 26):
   *  - star circumradius 10 at (17, 13): two squares, one rotated 45°
   *  - octagon circumradius 5.5 at (0, 13) — halves merge across tile
   *    seams; star tips and octagon points nearly touch (1.5px gap),
   *    the classic star-and-octagon interlock
   */
  let { band = 26 }: { band?: number } = $props();

  // Square with circumradius 10 → half-side 10/√2 ≈ 7.07.
  const SQUARE = 'M -7.07 -7.07 L 7.07 -7.07 L 7.07 7.07 L -7.07 7.07 Z';
  // Regular octagon with circumradius 5.5 (vertices at 22.5° + k·45°).
  const OCTAGON =
    'M 5.08 2.1 L 2.1 5.08 L -2.1 5.08 L -5.08 2.1 L -5.08 -2.1 L -2.1 -5.08 L 2.1 -5.08 L 5.08 -2.1 Z';
</script>

<svg class="starband-frame" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="starband-tile" patternUnits="userSpaceOnUse" width="34" height="26">
      <g transform="translate(17 13)">
          <path d={SQUARE} />
          <path d={SQUARE} transform="rotate(45)" />
      </g>
      <path d={OCTAGON} transform="translate(0 13)" />
      <path d={OCTAGON} transform="translate(34 13)" />
    </pattern>
  </defs>
  <rect
    x="0"
    y="0"
    width="100%"
    height="100%"
    fill="none"
    stroke="url(#starband-tile)"
    stroke-width={band * 2}
  />
</svg>

<style>
  .starband-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
    color: var(--color-accent, #d4af37);
    opacity: 0.15;
  }
  .starband-frame pattern path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
  }
</style>
