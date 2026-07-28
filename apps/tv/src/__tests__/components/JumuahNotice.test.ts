import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import JumuahNotice from '$lib/components/JumuahNotice.svelte';

describe('JumuahNotice', () => {
  it('renders the Jumuah label', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: null, speech_time: null },
        ],
        label: "Jumu'ah",
        speechLabel: 'Speech',
      },
    });
    expect(screen.getByText("Jumu'ah Sessions")).toBeDefined();
  });

  it('renders all session times', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: null, speech_time: null },
          { id: '2', label: 'Second', time: '14:30', khateeb: 'Sheikh', speech_time: null },
        ],
        label: "Jumu'ah",
        speechLabel: 'Speech',
      },
    });
    expect(screen.getByText('13:30')).toBeDefined();
    expect(screen.getByText('14:30')).toBeDefined();
  });

  it('renders khateeb names inline', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: 'Imam Yusuf', speech_time: null },
        ],
        label: "Jumu'ah",
        speechLabel: 'Speech',
      },
    });
    expect(screen.getByText('— Imam Yusuf')).toBeDefined();
  });

  it('renders speech_time with custom label', () => {
    render(JumuahNotice, {
      props: {
        sessions: [
          { id: '1', label: 'First', time: '13:30', khateeb: null, speech_time: '13:00' },
        ],
        label: "Jumu'ah",
        speechLabel: 'Bayaan',
      },
    });
    expect(screen.getByText('Bayaan @ 13:00')).toBeDefined();
  });

  it('renders with empty sessions (still shows label)', () => {
    render(JumuahNotice, { props: { sessions: [], label: "Jumu'ah", speechLabel: 'Speech' } });
    expect(screen.getByText("Jumu'ah Sessions")).toBeDefined();
  });
});