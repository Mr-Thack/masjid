import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/svelte';
import { toast } from 'svelte-sonner';

vi.mock('$lib/auth.svelte', () => ({
  auth: {
    admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'masjid-1' },
    token: 'test-token',
    loading: false,
    get isAuthenticated() { return true; },
    logout: vi.fn(),
  },
}));

let mockGetNavItems: ReturnType<typeof vi.fn>;
let mockCreateNavItem: ReturnType<typeof vi.fn>;
let mockUpdateNavItem: ReturnType<typeof vi.fn>;
let mockDeleteNavItem: ReturnType<typeof vi.fn>;
let mockReorderNavItems: ReturnType<typeof vi.fn>;
let mockGetPages: ReturnType<typeof vi.fn>;
let mockCreateContent: ReturnType<typeof vi.fn>;
let mockUpdateContent: ReturnType<typeof vi.fn>;
let mockDeleteContent: ReturnType<typeof vi.fn>;

function createMocks() {
  mockGetNavItems = vi.fn().mockResolvedValue({ nav_items: [] });
  mockCreateNavItem = vi.fn().mockResolvedValue({ id: 'new-id' });
  mockUpdateNavItem = vi.fn().mockResolvedValue({ id: 'updated' });
  mockDeleteNavItem = vi.fn().mockResolvedValue({});
  mockReorderNavItems = vi.fn().mockResolvedValue({ nav_items: [] });
  mockGetPages = vi.fn().mockResolvedValue({ content: [] });
  mockCreateContent = vi.fn().mockResolvedValue({ id: 'page-id', slug: 'test', title: 'Test' });
  mockUpdateContent = vi.fn().mockResolvedValue({});
  mockDeleteContent = vi.fn().mockResolvedValue({});
}

createMocks();

vi.mock('$lib/api', () => ({
  api: {
    getNavItems: (...args: unknown[]) => mockGetNavItems(...args),
    createNavItem: (...args: unknown[]) => mockCreateNavItem(...args),
    updateNavItem: (...args: unknown[]) => mockUpdateNavItem(...args),
    deleteNavItem: (...args: unknown[]) => mockDeleteNavItem(...args),
    reorderNavItems: (...args: unknown[]) => mockReorderNavItems(...args),
    getPages: (...args: unknown[]) => mockGetPages(...args),
    createContent: (...args: unknown[]) => mockCreateContent(...args),
    updateContent: (...args: unknown[]) => mockUpdateContent(...args),
    deleteContent: (...args: unknown[]) => mockDeleteContent(...args),
  },
}));

import NavPage from '../../routes/admin/[slug]/settings/navigation/+page.svelte';

const slugData = { data: { masjidSlug: 'masjid-1' } };

function makeNavItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nav-1',
    masjid_id: 'masjid-1',
    sort_order: 0,
    kind: 'route',
    route_segment: 'prayer',
    page_slug: null,
    external_url: null,
    label: 'Times',
    icon: 'Clock',
    is_highlighted: true,
    show_on_desktop_header: true,
    show_on_mobile_bottom: true,
    created_at: '2024-01-01',
    ...overrides,
  };
}

describe('Navigation settings page', () => {
  beforeEach(() => {
    cleanup();
    createMocks();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  // ── rendering / loading ──────────────────────────────────────────────────

  describe('rendering', () => {
    it('shows loading skeleton while fetching', () => {
      mockGetNavItems.mockReturnValue(new Promise(() => {}));
      render(NavPage, { props: slugData });
      const shimmerDivs = document.querySelectorAll('.animate-shimmer');
      expect(shimmerDivs.length).toBeGreaterThan(0);
    });

    it('renders the Navigation heading after load', async () => {
      render(NavPage, { props: slugData });
      const heading = await screen.findByText('Navigation');
      expect(heading).toBeInTheDocument();
    });

    it('renders nav items after loading', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [
          makeNavItem({ id: 'nav-1', label: 'Times', sort_order: 0 }),
          makeNavItem({ id: 'nav-2', label: 'News', sort_order: 1, kind: 'route', route_segment: 'news', icon: 'Newspaper', is_highlighted: false }),
          makeNavItem({ id: 'nav-3', label: 'Donate', sort_order: 2, kind: 'link', route_segment: null, external_url: 'https://donate.org', icon: 'ExternalLink', is_highlighted: false }),
        ],
      });
      render(NavPage, { props: slugData });

      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });
      expect(screen.getByText('News')).toBeInTheDocument();
      expect(screen.getByText('Donate')).toBeInTheDocument();
    });

    it('shows empty state when no items', async () => {
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('No navigation items configured.')).toBeInTheDocument(); });
    });
  });

  // ── badges / toggles ──────────────────────────────────────────────────────

  describe('badges and toggles', () => {
    it('shows kind badge for each item', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [
          makeNavItem({ id: 'nav-1', label: 'Times', kind: 'route' }),
          makeNavItem({ id: 'nav-2', label: 'Donate', kind: 'link', route_segment: null, external_url: 'https://donate.org', icon: 'ExternalLink', is_highlighted: false, sort_order: 1 }),
        ],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });

      expect(screen.getByText('Route')).toBeInTheDocument();
      expect(screen.getByText('Link')).toBeInTheDocument();
    });

    it('shows highlighted checkbox checked for highlighted item', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [makeNavItem({ id: 'nav-1', label: 'Times', is_highlighted: true })],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const highlightCheckbox = checkboxes[2] as HTMLInputElement;
      expect(highlightCheckbox.checked).toBe(true);
    });

    it('shows desktop checkbox checked per data', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [makeNavItem({ id: 'nav-1', label: 'Times', show_on_desktop_header: true })],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const desktopCheckbox = checkboxes[0] as HTMLInputElement;
      expect(desktopCheckbox.checked).toBe(true);
    });
  });

  // ── add route ────────────────────────────────────────────────────────────

  describe('add route', () => {
    it('shows route selector when Add Built-in Route clicked', async () => {
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('No navigation items configured.')).toBeInTheDocument(); });

      const addBtn = screen.getByText('Add Built-in Route');
      await fireEvent.click(addBtn);

      expect(screen.getByText('Add Built-in Route')).toBeInTheDocument(); // form heading h3
    });

    it('calls createNavItem when route selected and submitted', async () => {
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('No navigation items configured.')).toBeInTheDocument(); });

      const addBtn = screen.getByText('Add Built-in Route');
      await fireEvent.click(addBtn);

      // Click the "Times" route button
      await fireEvent.click(screen.getByText('Times'));

      const submitBtn = screen.getByText('Add');
      await fireEvent.click(submitBtn);

      expect(mockCreateNavItem).toHaveBeenCalledWith('masjid-1', expect.objectContaining({
        kind: 'route',
        route_segment: 'prayer',
        label: 'Times',
        icon: 'Clock',
      }));
    });
  });

  // ── add link ─────────────────────────────────────────────────────────────

  describe('add link', () => {
    it('calls createNavItem when link form submitted', async () => {
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('No navigation items configured.')).toBeInTheDocument(); });

      const addLinkBtn = screen.getByText('Add External Link');
      await fireEvent.click(addLinkBtn);

      expect(screen.getByText('Add External Link')).toBeInTheDocument(); // form heading h3

      const urlInput = document.querySelector('input[type="url"]') as HTMLInputElement;
      await fireEvent.input(urlInput, { target: { value: 'https://donate.org' } });

      const textInputs = document.querySelectorAll('input[type="text"]');
      // The link form's text input is the label field
      const labelInput = textInputs[textInputs.length - 1] as HTMLInputElement;
      await fireEvent.input(labelInput, { target: { value: 'Donate' } });

      const submitBtn = screen.getAllByText('Add')[0];
      await fireEvent.click(submitBtn);

      expect(mockCreateNavItem).toHaveBeenCalledWith('masjid-1', expect.objectContaining({
        kind: 'link',
        external_url: 'https://donate.org',
        label: 'Donate',
      }));
    });
  });

  // ── update label ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('calls updateNavItem when label is changed', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [makeNavItem({ id: 'nav-1', label: 'Times' })],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });

      const editBtn = screen.getByText('Edit');
      await fireEvent.click(editBtn);

      const labelInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      // The label edit input also has class ".border.rounded"
      await fireEvent.input(labelInput, { target: { value: 'Updated' } });

      const saveBtn = document.querySelector('button[title="Save"]') as HTMLButtonElement;
      await fireEvent.click(saveBtn);

      expect(mockUpdateNavItem).toHaveBeenCalledWith('masjid-1', 'nav-1', expect.objectContaining({
        label: 'Updated',
      }));
    });

    it('calls updateNavItem when highlight is toggled', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [makeNavItem({ id: 'nav-1', label: 'Times', is_highlighted: false })],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const highlightCheckbox = checkboxes[2] as HTMLInputElement;
      await fireEvent.click(highlightCheckbox);

      expect(mockUpdateNavItem).toHaveBeenCalledWith('masjid-1', 'nav-1', expect.objectContaining({
        is_highlighted: true,
      }));
    });

    it('calls updateNavItem when desktop toggle is changed', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [makeNavItem({ id: 'nav-1', label: 'Times', show_on_desktop_header: true })],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const desktopCheckbox = checkboxes[0] as HTMLInputElement;
      await fireEvent.click(desktopCheckbox);

      expect(mockUpdateNavItem).toHaveBeenCalledWith('masjid-1', 'nav-1', expect.objectContaining({
        show_on_desktop_header: false,
      }));
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('shows confirmation dialog on delete click', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [makeNavItem({ id: 'nav-1', label: 'Times' })],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      expect(screen.getByText('Delete Nav Item')).toBeInTheDocument();
    });

    it('calls deleteNavItem on confirm', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [makeNavItem({ id: 'nav-1', label: 'Times' })],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Times')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const confirmBtn = screen.getByText('Confirm');
      await fireEvent.click(confirmBtn);

      await waitFor(() => { expect(mockDeleteNavItem).toHaveBeenCalledWith('masjid-1', 'nav-1'); });
    });
  });

  // ── reorder ──────────────────────────────────────────────────────────────

  describe('reorder', () => {
    it('calls reorderNavItems when move up clicked', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [
          makeNavItem({ id: 'nav-1', label: 'Times', sort_order: 0 }),
          makeNavItem({ id: 'nav-2', label: 'News', sort_order: 1, kind: 'route', route_segment: 'news', icon: 'Newspaper', is_highlighted: false }),
        ],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('News')).toBeInTheDocument(); });

      const upButtons = screen.getAllByTitle('Move up');
      // Second item's move up button
      await fireEvent.click(upButtons[1]);

      expect(mockReorderNavItems).toHaveBeenCalledWith('masjid-1', ['nav-2', 'nav-1']);
    });

    it('calls reorderNavItems when move down clicked', async () => {
      mockGetNavItems.mockResolvedValue({
        nav_items: [
          makeNavItem({ id: 'nav-1', label: 'Times', sort_order: 0 }),
          makeNavItem({ id: 'nav-2', label: 'News', sort_order: 1, kind: 'route', route_segment: 'news', icon: 'Newspaper', is_highlighted: false }),
        ],
      });
      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('News')).toBeInTheDocument(); });

      const downButtons = screen.getAllByTitle('Move down');
      // First item's move down button
      await fireEvent.click(downButtons[0]);

      expect(mockReorderNavItems).toHaveBeenCalledWith('masjid-1', ['nav-2', 'nav-1']);
    });
  });

  // ── error states ─────────────────────────────────────────────────────────

  describe('error states', () => {
    it('shows error toast on load failure', async () => {
      mockGetNavItems.mockRejectedValue(new Error('Network error'));

      render(NavPage, { props: slugData });

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Network error'); });
    });

    it('shows error toast on create failure', async () => {
      mockCreateNavItem.mockRejectedValue(new Error('Server error'));

      render(NavPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('No navigation items configured.')).toBeInTheDocument(); });

      const addBtn = screen.getByText('Add Built-in Route');
      await fireEvent.click(addBtn);

      await fireEvent.click(screen.getByText('Times'));

      const submitBtn = screen.getByText('Add');
      await fireEvent.click(submitBtn);

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Server error'); });
    });
  });
});