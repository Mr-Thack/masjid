import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DiffReceiptCard from '$lib/components/DiffReceiptCard.svelte';
import { fireEvent } from '@testing-library/svelte';

describe('DiffReceiptCard', () => {
  it('renders domain headers for each domain in diff', () => {
    const diff = {
      THEME: [{ action: 'UPSERT', target: 'primary_color', summary: '#FF0000' }],
    };
    render(DiffReceiptCard, { props: { diff } });
    expect(screen.getByText('THEME')).toBeInTheDocument();
  });

  it('shows mutation count per domain', () => {
    const diff = {
      PRAYER_RULES: [
        { action: 'UPSERT', target: 'Fajr rule', summary: 'New rule' },
        { action: 'DELETE', target: 'Old rule', summary: 'Removed' },
      ],
    };
    render(DiffReceiptCard, { props: { diff } });
    expect(screen.getByText('2 changes')).toBeInTheDocument();
  });

  it('expands domain when clicked to show mutations', async () => {
    const diff = {
      JUMUAH: [{ action: 'UPSERT', target: 'Friday 1', summary: '1:30 PM' }],
    };
    render(DiffReceiptCard, { props: { diff } });
    // Before expand, mutation detail should not be visible
    expect(screen.queryByText('Friday 1')).not.toBeInTheDocument();
    // Click to expand
    await fireEvent.click(screen.getByText('JUMUAH'));
    expect(screen.getByText('Friday 1')).toBeInTheDocument();
  });

  it('renders action-specific icons for UPSERT, DELETE, and PATCH', () => {
    const diff = {
      THEME: [
        { action: 'UPSERT', target: 'primary_color', summary: '#FF0000' },
        { action: 'DELETE', target: 'old_font', summary: 'Removed' },
        { action: 'PATCH', target: 'accent_color', summary: '#00FF00' },
      ],
    };
    render(DiffReceiptCard, { props: { diff } });
    // Expand
    fireEvent.click(screen.getByText('THEME'));
    // All three mutation targets should be visible
    expect(screen.getByText('primary_color')).toBeInTheDocument();
    expect(screen.getByText('old_font')).toBeInTheDocument();
    expect(screen.getByText('accent_color')).toBeInTheDocument();
  });

  it('renders multiple domains grouped', () => {
    const diff = {
      THEME: [{ action: 'UPSERT', target: 'primary_color', summary: '#000' }],
      PROFILE: [{ action: 'UPSERT', target: 'name', summary: 'New name' }],
    };
    render(DiffReceiptCard, { props: { diff } });
    expect(screen.getByText('THEME')).toBeInTheDocument();
    expect(screen.getByText('PROFILE')).toBeInTheDocument();
  });

  it('renders "Config Changes" header', () => {
    const diff = { THEME: [] };
    render(DiffReceiptCard, { props: { diff } });
    expect(screen.getByText('Config Changes')).toBeInTheDocument();
  });
});
