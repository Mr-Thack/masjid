import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import JumuahNotice from '$lib/components/JumuahNotice.svelte';

describe('JumuahNotice', () => {
  it('renders the Jumuah label', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: null, language: 'en', location: null, is_active: true },
        ],
      },
    });
    expect(screen.getByText("Jumu'ah")).toBeDefined();
  });

  it('renders all session times', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: null, language: 'en', location: null, is_active: true },
          { id: '2', label: 'Second', time: '14:30', khateeb: 'Sheikh', language: 'ar', location: null, is_active: true },
        ],
      },
    });
    expect(screen.getByText('13:30')).toBeDefined();
    expect(screen.getByText('14:30')).toBeDefined();
  });

  it('renders empty with no sessions', () => {
    render(JumuahNotice, { props: { sessions: [] } });
    expect(screen.getByText("Jumu'ah")).toBeDefined();
  });
});