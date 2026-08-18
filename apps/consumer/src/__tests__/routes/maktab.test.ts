import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { page } from '$app/stores';
import MaktabPage from '../../routes/[masjid_slug]/maktab/+page.svelte';
import MaktabEnrollPage from '../../routes/[masjid_slug]/maktab/enroll/+page.svelte';
import type { MaktabInfo } from '$lib/api';

vi.mock('$app/stores', () => {
  const listeners = new Set<(v: Record<string, unknown>) => void>();
  let value: Record<string, unknown> = {
    url: new URL('http://localhost:5175/test-masjid/maktab/enroll'),
    params: { masjid_slug: 'test-masjid' },
    data: {},
  };

  const pageStore = {
    subscribe(fn: (v: unknown) => void) {
      fn(value);
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(newValue: unknown) {
      value = newValue as Record<string, unknown>;
      listeners.forEach((fn) => fn(newValue as Record<string, unknown>));
    },
  };

  return { page: pageStore };
});

function setPageData(data: Record<string, unknown>) {
  (page as unknown as { set(v: unknown): void }).set({
    url: new URL('http://localhost:5175/test-masjid/maktab/enroll'),
    params: { masjid_slug: 'test-masjid' },
    data,
  });
}

function maktabData(overrides: Partial<MaktabInfo> = {}): MaktabInfo {
  return {
    open: true,
    term: {
      id: 't1',
      name: 'Fall 2026',
      length_months: 4,
      billing_months: 4,
      prices: { '1': 10000, '2': 16000, '3plus': 20000 },
    },
    status_message: null,
    program_info: {},
    square_config: {
      app_id: 'sq0id-test',
      location_id: 'LTEST',
      environment: 'sandbox',
    },
    ...overrides,
  };
}

function masjidData() {
  return { slug: 'test-masjid', name: 'Test Masjid' };
}

describe('Maktab landing page', () => {
  beforeEach(() => {
    cleanup();
    setPageData({ masjid: masjidData() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Enroll Now link when enrollment is open with Square configured', () => {
    setPageData({ masjid: masjidData(), maktab: maktabData() });
    render(MaktabPage);
    expect(screen.getByRole('link', { name: 'Enroll Now' })).toBeInTheDocument();
  });

  it('shows Enrollment Unavailable and no link when Square not configured', () => {
    setPageData({ masjid: masjidData(), maktab: maktabData({ square_config: null }) });
    render(MaktabPage);
    expect(screen.getByText('Enrollment Unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Enroll Now' })).not.toBeInTheDocument();
  });

  it('shows Enrollment Closed when enrollment is not open', () => {
    setPageData({ masjid: masjidData(), maktab: maktabData({ open: false }) });
    render(MaktabPage);
    expect(screen.getByText('Enrollment Closed')).toBeInTheDocument();
  });

  it('shows Enrollment Closed when no active term', () => {
    setPageData({ masjid: masjidData(), maktab: maktabData({ term: null }) });
    render(MaktabPage);
    expect(screen.getByText('Enrollment Closed')).toBeInTheDocument();
  });
});

describe('Maktab enroll page', () => {
  beforeEach(() => {
    cleanup();
    setPageData({ masjid: masjidData() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the enrollment form when Square is configured', () => {
    setPageData({ masjid: masjidData(), maktab: maktabData() });
    render(MaktabEnrollPage);
    expect(screen.getByText(/Parent \/ Guardian Information/)).toBeInTheDocument();
    expect(screen.queryByText(/Online enrollment is currently unavailable/)).not.toBeInTheDocument();
  });

  it('blocks the form when Square is not configured', () => {
    setPageData({ masjid: masjidData(), maktab: maktabData({ square_config: null }) });
    render(MaktabEnrollPage);
    expect(screen.getByText('Online enrollment is currently unavailable.')).toBeInTheDocument();
    expect(screen.queryByText(/Parent \/ Guardian Information/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Enrollment/ })).not.toBeInTheDocument();
  });
});