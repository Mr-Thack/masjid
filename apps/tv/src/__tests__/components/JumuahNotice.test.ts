import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import JumuahNotice from '$lib/components/JumuahNotice.svelte';

describe('JumuahNotice', () => {
  it('renders the Jumuah label', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: null },
        ],
        label: "Jumu'ah",
      },
    });
    expect(screen.getByText("Jumu'ah")).toBeDefined();
  });

  it('renders all session times', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: null },
          { id: '2', label: 'Second', time: '14:30', khateeb: 'Sheikh' },
        ],
        label: "Jumu'ah",
      },
    });
    expect(screen.getByText('13:30')).toBeDefined();
    expect(screen.getByText('14:30')).toBeDefined();
  });

  it('renders khateeb names', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: 'Imam Yusuf' },
        ],
        label: "Jumu'ah",
      },
    });
    expect(screen.getByText('Imam Yusuf')).toBeDefined();
  });

  it('renders with empty sessions (still shows label)', () => {
    render(JumuahNotice, { props: { sessions: [], label: "Jumu'ah" } });
    expect(screen.getByText("Jumu'ah")).toBeDefined();
  });
});
