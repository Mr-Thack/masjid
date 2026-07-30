import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Rosette from '@masjid/ui-utils/components/Rosette.svelte';
import HoneycombFrame from '$lib/components/HoneycombFrame.svelte';
import StarBand from '@masjid/ui-utils/components/StarBand.svelte';
import ArchCrest from '$lib/components/ArchCrest.svelte';

// ---------------------------------------------------------------------------
// Mishkaat ornament components (docs/design-language.md §7.3)
// ---------------------------------------------------------------------------

describe('Rosette', () => {
  it('renders an eight-point star (two squares + center)', () => {
    const { container } = render(Rosette);
    const svg = container.querySelector('svg.rosette');
    expect(svg).toBeTruthy();
    expect(container.querySelectorAll('rect').length).toBe(2);
    expect(container.querySelector('circle.rosette-center')).toBeTruthy();
  });

  it('rotates the second square 45° (eight points)', () => {
    const { container } = render(Rosette);
    const rects = container.querySelectorAll('rect');
    expect(rects[0].getAttribute('transform')).toBeNull();
    expect(rects[1].getAttribute('transform')).toContain('rotate(45');
  });

  it('honors the size prop', () => {
    const { container } = render(Rosette, { props: { size: 32 } });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });

  it('supports the stroke variant', () => {
    const { container } = render(Rosette, { props: { stroke: true } });
    expect(container.querySelector('svg.rosette--stroke')).toBeTruthy();
  });

  it('is decorative (aria-hidden)', () => {
    const { container } = render(Rosette);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('HoneycombFrame', () => {
  it('renders a full-size absolutely-positioned SVG frame', () => {
    const { container } = render(HoneycombFrame);
    const svg = container.querySelector('svg.honeycomb-frame');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws the band with a honeycomb pattern stroke', () => {
    const { container } = render(HoneycombFrame);
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('stroke')).toBe('url(#honeycomb-tile)');
    expect(rect?.getAttribute('fill')).toBe('none');
  });

  it('defines a seamless hexagon tile (5 hexagons incl. wrap copies)', () => {
    const { container } = render(HoneycombFrame);
    const pattern = container.querySelector('pattern#honeycomb-tile');
    expect(pattern).toBeTruthy();
    expect(pattern?.querySelectorAll('path').length).toBe(5);
    expect(pattern?.getAttribute('patternUnits')).toBe('userSpaceOnUse');
  });

  it('sizes the stroke band from the band prop', () => {
    const { container } = render(HoneycombFrame, { props: { band: 10 } });
    expect(container.querySelector('rect')?.getAttribute('stroke-width')).toBe('20');
  });
});

describe('StarBand', () => {
  it('renders a full-size absolutely-positioned SVG frame', () => {
    const { container } = render(StarBand);
    const svg = container.querySelector('svg.starband-frame');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws the band with a starband pattern stroke', () => {
    const { container } = render(StarBand);
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('stroke')).toBe('url(#starband-tile)');
    expect(rect?.getAttribute('fill')).toBe('none');
  });

  it('defines the khatam tile: eight-point star + interlocking octagons', () => {
    const { container } = render(StarBand);
    const pattern = container.querySelector('pattern#starband-tile');
    expect(pattern).toBeTruthy();
    expect(pattern?.getAttribute('patternUnits')).toBe('userSpaceOnUse');
    // One star group (two squares, second rotated 45°) + two seam octagons.
    const star = pattern?.querySelector('g');
    expect(star?.querySelectorAll('path').length).toBe(2);
    expect(star?.querySelectorAll('path')[1]?.getAttribute('transform')).toContain('rotate(45');
    expect(pattern?.querySelectorAll(':scope > path').length).toBe(2);
  });

  it('sizes the stroke band from the band prop (default ≥ one row, no notches)', () => {
    const { container } = render(StarBand);
    expect(Number(container.querySelector('rect')?.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(52);
    const custom = render(StarBand, { props: { band: 30 } });
    expect(custom.container.querySelector('rect')?.getAttribute('stroke-width')).toBe('60');
  });
});

describe('ArchCrest', () => {
  it('renders exactly one arch (outer + inner echo paths)', () => {
    const { container } = render(ArchCrest);
    const paths = container.querySelectorAll('path.arch-line');
    expect(paths.length).toBe(2);
    // Both paths describe one continuous mihrab arch outline.
    for (const path of paths) {
      expect(path.getAttribute('d')).toMatch(/^M /);
    }
  });

  it('places a rosette at the apex', () => {
    const { container } = render(ArchCrest);
    const rosette = container.querySelector('g.arch-rosette');
    expect(rosette).toBeTruthy();
    expect(rosette?.querySelectorAll('rect').length).toBe(2);
  });

  it('honors the width prop', () => {
    const { container } = render(ArchCrest, { props: { width: 200 } });
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('200');
  });

  it('is decorative (aria-hidden)', () => {
    const { container } = render(ArchCrest);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
