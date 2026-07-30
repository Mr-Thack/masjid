<script lang="ts">
  /**
   * Mishkaat hero niche (docs/design-language.md §7.11): the consumer home
   * hero framed by the canonical mihrab arch — one arch per screen, apex
   * rosette, tone-on-tone outline, never behind numerals.
   *
   * Geometry comes from `@masjid/ui-utils` (`arch.ts`) so the phone draws
   * the same arch as the TV clock niche. Content is slotted and sits inside
   * the arch belly via `.c-hero-niche-body` (see app.css).
   */
  import {
    MIHRAB_APEX_ROSETTE,
    MIHRAB_ARCH_VIEWBOX,
    MIHRAB_INNER_PATH,
    MIHRAB_OUTER_PATH,
  } from '@masjid/ui-utils';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="c-hero-niche">
  <svg
    viewBox="0 0 {MIHRAB_ARCH_VIEWBOX.width} {MIHRAB_ARCH_VIEWBOX.height}"
    class="c-hero-arch"
    aria-hidden="true"
    focusable="false"
  >
    <path d={MIHRAB_OUTER_PATH} class="c-hero-arch-line c-hero-arch-line--outer" />
    <path d={MIHRAB_INNER_PATH} class="c-hero-arch-line c-hero-arch-line--inner" />
    <g
      transform="translate({MIHRAB_APEX_ROSETTE.x} {MIHRAB_APEX_ROSETTE.y})"
      class="c-hero-arch-rosette"
    >
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
  <div class="c-hero-niche-body">
    {@render children()}
  </div>
</div>
