import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SkeletonForm from '$lib/components/SkeletonForm.svelte';

describe('SkeletonForm', () => {
  it('renders default number of placeholder rows (4)', () => {
    render(SkeletonForm);
    const rows = document.querySelectorAll('.animate-shimmer');
    expect(rows.length).toBe(8); // 4 labels + 4 inputs = 8 shimmer elements
  });

  it('renders custom number of fields', () => {
    render(SkeletonForm, { props: { fields: 2 } });
    const rows = document.querySelectorAll('.animate-shimmer');
    expect(rows.length).toBe(4); // 2 labels + 2 inputs = 4 shimmer elements
  });
});
