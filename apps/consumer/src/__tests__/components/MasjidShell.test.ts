import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MasjidShell from '$lib/components/MasjidShell.svelte';

describe('MasjidShell', () => {
  it('renders the wrapper div', () => {
    const { container } = render(MasjidShell);
    const div = container.querySelector('.flex.flex-col.min-h-dvh');
    expect(div).toBeTruthy();
  });
});