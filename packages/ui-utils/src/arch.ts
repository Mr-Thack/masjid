/**
 * Canonical mihrab arch geometry (docs/design-language.md §7.3): exactly
 * one arch per screen, with the eight-point star rosette at its apex.
 *
 * Shared by the TV clock niche (`ArchCrest.svelte`) and the consumer hero
 * niche (§7.11) so every Mishkaat surface draws the same arch.
 *
 * The viewBox is a wide, tall mihrab (140×150, legs down to y=146): the
 * broad curved belly inscribes the TV clock, and the straight hall between
 * the legs holds the text stack (consumer countdown / TV text stack).
 */

export const MIHRAB_ARCH_VIEWBOX = { width: 140, height: 150 } as const;

export const MIHRAB_OUTER_PATH =
  'M 10 146 L 10 64 C 10 30 46 22 70 8 C 94 22 130 30 130 64 L 130 146';

export const MIHRAB_INNER_PATH =
  'M 21 146 L 21 66 C 21 38 52 29 70 19 C 88 29 119 38 119 66 L 119 146';

/** Apex rosette: two overlapping squares (size × size) centered at (x, y). */
export const MIHRAB_APEX_ROSETTE = { x: 70, y: 8, size: 9.2 } as const;
