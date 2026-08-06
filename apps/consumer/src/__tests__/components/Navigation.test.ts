import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Header from '$lib/components/Header.svelte';
import MobileTopBar from '$lib/components/MobileTopBar.svelte';
import MobileBottomNav from '$lib/components/MobileBottomNav.svelte';
import NavDrawer from '$lib/components/NavDrawer.svelte';
import type { NavItem } from '$lib/api';

function makeNavItem(overrides: Partial<NavItem> = {}): NavItem {
  return {
    id: `nav-${overrides.sort_order ?? 0}`,
    sort_order: 0,
    kind: 'route',
    route_segment: 'prayer',
    page_slug: null,
    external_url: null,
    label: 'Times',
    icon: 'Clock',
    is_highlighted: false,
    show_on_desktop_header: true,
    show_on_mobile_bottom: true,
    ...overrides,
  };
}

const defaultMasjid = { name: 'Masjid Al-Noor', slug: 'masjid-al-noor' };

describe('Header', () => {
  it('renders the masjid name', () => {
    render(Header, {
      props: { masjid: defaultMasjid, navItems: [], theme: null, pathname: '/' },
    });
    expect(screen.getByText('Masjid Al-Noor')).toBeInTheDocument();
  });

  it('renders nav item labels', () => {
    const items = [
      makeNavItem({ id: '1', sort_order: 0, label: 'Times', route_segment: 'prayer' }),
      makeNavItem({ id: '2', sort_order: 1, label: 'Info', route_segment: 'info', icon: 'Info' }),
    ];
    render(Header, {
      props: { masjid: defaultMasjid, navItems: items, theme: null, pathname: '/' },
    });
    expect(screen.getByText('Times')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('renders highlighted item with accent class', () => {
    const items = [
      makeNavItem({
        id: '1',
        sort_order: 0,
        label: 'Donate',
        route_segment: 'donate',
        icon: 'Heart',
        is_highlighted: true,
      }),
    ];
    const { container } = render(Header, {
      props: { masjid: defaultMasjid, navItems: items, theme: null, pathname: '/' },
    });
    const link = screen.getByText('Donate').closest('a')!;
    expect(link.className).toContain('bg-accent/15');
    expect(link.style.color).toBe('var(--color-accent)');
  });

  it('renders overflow hamburger when more than 5 items', () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      makeNavItem({
        id: `nav-${i}`,
        sort_order: i,
        label: `Item ${i}`,
        route_segment: `item-${i}`,
        icon: 'FileText',
      }),
    );
    render(Header, {
      props: { masjid: defaultMasjid, navItems: items, theme: null, pathname: '/' },
    });
    expect(screen.getByLabelText('More navigation items')).toBeInTheDocument();
  });

  it('shows overflow dropdown on hamburger click', async () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      makeNavItem({
        id: `nav-${i}`,
        sort_order: i,
        label: `Item ${i}`,
        route_segment: `item-${i}`,
        icon: 'FileText',
      }),
    );
    render(Header, {
      props: { masjid: defaultMasjid, navItems: items, theme: null, pathname: '/' },
    });
    const btn = screen.getByLabelText('More navigation items');
    await fireEvent.click(btn);
    // Show items are indices 0-3; overflow items 4-5 appear in the dropdown
    const dropdown = document.getElementById('nav-dropdown')!;
    expect(dropdown).toBeTruthy();
    expect(dropdown.textContent).toContain('Item 4');
    expect(dropdown.textContent).toContain('Item 5');
    // Shown item 3 should NOT be in the dropdown
    expect(dropdown.textContent).not.toContain('Item 3');
  });

  it('renders links to correct URLs for route items', () => {
    const items = [
      makeNavItem({ id: '1', sort_order: 0, label: 'Times', route_segment: 'prayer', kind: 'route' }),
    ];
    render(Header, {
      props: { masjid: defaultMasjid, navItems: items, theme: null, pathname: '/' },
    });
    const link = screen.getByText('Times').closest('a')!;
    expect(link.getAttribute('href')).toBe('/masjid-al-noor/prayer');
  });

  it('renders external URLs for link items', () => {
    const items = [
      makeNavItem({
        id: '1',
        sort_order: 0,
        label: 'External',
        kind: 'link',
        route_segment: null,
        external_url: 'https://example.com',
        icon: 'ExternalLink',
      }),
    ];
    render(Header, {
      props: { masjid: defaultMasjid, navItems: items, theme: null, pathname: '/' },
    });
    const link = screen.getByText('External').closest('a')!;
    expect(link.getAttribute('href')).toBe('https://example.com');
  });

  it('renders no nav items when list is empty', () => {
    const { container } = render(Header, {
      props: { masjid: defaultMasjid, navItems: [], theme: null, pathname: '/' },
    });
    const nav = container.querySelector('nav[aria-label="Main navigation"]')!;
    const links = nav.querySelectorAll('a');
    expect(links.length).toBe(0);
  });
});

describe('MobileTopBar', () => {
  it('renders the masjid name', () => {
    render(MobileTopBar, {
      props: {
        masjid: defaultMasjid,
        navItems: [],
        theme: null,
        pathname: '/',
        onToggleDrawer: vi.fn(),
      },
    });
    expect(screen.getByText('Masjid Al-Noor')).toBeInTheDocument();
  });

  it('renders highlighted item as a pill', () => {
    const items = [
      makeNavItem({
        id: '1',
        sort_order: 0,
        label: 'Donate',
        route_segment: 'donate',
        icon: 'Heart',
        is_highlighted: true,
      }),
    ];
    render(MobileTopBar, {
      props: {
        masjid: defaultMasjid,
        navItems: items,
        theme: null,
        pathname: '/',
        onToggleDrawer: vi.fn(),
      },
    });
    const pill = screen.getByText('Donate');
    expect(pill).toBeInTheDocument();
    const pillLink = pill.closest('a')!;
    expect(pillLink.className).toContain('bg-accent/15');
  });

  it('renders hamburger button', () => {
    render(MobileTopBar, {
      props: {
        masjid: defaultMasjid,
        navItems: [],
        theme: null,
        pathname: '/',
        onToggleDrawer: vi.fn(),
      },
    });
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  it('calls onToggleDrawer when hamburger is clicked', async () => {
    const onToggleDrawer = vi.fn();
    render(MobileTopBar, {
      props: {
        masjid: defaultMasjid,
        navItems: [],
        theme: null,
        pathname: '/',
        onToggleDrawer,
      },
    });
    await fireEvent.click(screen.getByLabelText('Open navigation menu'));
    expect(onToggleDrawer).toHaveBeenCalled();
  });

  it('does not render highlighted pill when no item is highlighted', () => {
    const items = [
      makeNavItem({
        id: '1',
        sort_order: 0,
        label: 'Times',
        route_segment: 'prayer',
        is_highlighted: false,
      }),
    ];
    const { container } = render(MobileTopBar, {
      props: {
        masjid: defaultMasjid,
        navItems: items,
        theme: null,
        pathname: '/',
        onToggleDrawer: vi.fn(),
      },
    });
    expect(screen.queryByText('Times')).toBeNull();
    // The pill area should not exist - check there's no bg-accent/15 link
    const pillLinks = container.querySelectorAll('a.bg-accent\\/15');
    expect(pillLinks.length).toBe(0);
  });
});

describe('MobileBottomNav', () => {
  it('renders only items with show_on_mobile_bottom=true', () => {
    const items = [
      makeNavItem({ id: '1', sort_order: 0, label: 'Times', icon: 'Clock', show_on_mobile_bottom: true }),
      makeNavItem({ id: '2', sort_order: 1, label: 'Info', icon: 'Info', show_on_mobile_bottom: true }),
      makeNavItem({ id: '3', sort_order: 2, label: 'Hidden', icon: 'FileText', show_on_mobile_bottom: false }),
    ];
    render(MobileBottomNav, {
      props: { navItems: items, masjidSlug: 'masjid-al-noor', pathname: '/' },
    });
    expect(screen.getByText('Times')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('limits to max 5 items', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      makeNavItem({
        id: `nav-${i}`,
        sort_order: i,
        label: `Item ${i}`,
        icon: 'FileText',
        show_on_mobile_bottom: true,
      }),
    );
    render(MobileBottomNav, {
      props: { navItems: items, masjidSlug: 'masjid-al-noor', pathname: '/' },
    });
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 4')).toBeInTheDocument();
    expect(screen.queryByText('Item 5')).toBeNull();
  });

  it('renders item labels', () => {
    const items = [
      makeNavItem({ id: '1', sort_order: 0, label: 'Prayer', icon: 'Clock' }),
      makeNavItem({ id: '2', sort_order: 1, label: 'News', icon: 'Newspaper', route_segment: 'news' }),
    ];
    render(MobileBottomNav, {
      props: { navItems: items, masjidSlug: 'masjid-al-noor', pathname: '/' },
    });
    expect(screen.getByText('Prayer')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
  });

  it('renders correct links', () => {
    const items = [
      makeNavItem({ id: '1', sort_order: 0, label: 'Prayer', route_segment: 'prayer', icon: 'Clock' }),
    ];
    render(MobileBottomNav, {
      props: { navItems: items, masjidSlug: 'masjid-al-noor', pathname: '/' },
    });
    const link = screen.getByText('Prayer').closest('a')!;
    expect(link.getAttribute('href')).toBe('/masjid-al-noor/prayer');
  });
});

describe('NavDrawer', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(NavDrawer, {
      props: {
        navItems: [
          makeNavItem({ id: '1', sort_order: 0, label: 'Times', icon: 'Clock' }),
        ],
        masjidSlug: 'masjid-al-noor',
        pathname: '/',
        isOpen: false,
        onClose: vi.fn(),
      },
    });
    expect(container.textContent).toBe('');
  });

  it('renders when isOpen is true', () => {
    const items = [
      makeNavItem({ id: '1', sort_order: 0, label: 'Times', icon: 'Clock' }),
      makeNavItem({ id: '2', sort_order: 1, label: 'News', icon: 'Newspaper', route_segment: 'news' }),
    ];
    render(NavDrawer, {
      props: {
        navItems: items,
        masjidSlug: 'masjid-al-noor',
        pathname: '/',
        isOpen: true,
        onClose: vi.fn(),
      },
    });
    expect(screen.getByText('Times')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
  });

  it('renders all nav items including bottom-pinned ones', () => {
    const items = [
      makeNavItem({ id: '1', sort_order: 0, label: 'A', show_on_mobile_bottom: true }),
      makeNavItem({ id: '2', sort_order: 1, label: 'B', show_on_mobile_bottom: false }),
      makeNavItem({ id: '3', sort_order: 2, label: 'C', show_on_mobile_bottom: true }),
      makeNavItem({ id: '4', sort_order: 3, label: 'D', show_on_mobile_bottom: false }),
    ];
    render(NavDrawer, {
      props: {
        navItems: items,
        masjidSlug: 'masjid-al-noor',
        pathname: '/',
        isOpen: true,
        onClose: vi.fn(),
      },
    });
    // NavDrawer renders all items regardless of show_on_mobile_bottom
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(NavDrawer, {
      props: {
        navItems: [],
        masjidSlug: 'masjid-al-noor',
        pathname: '/',
        isOpen: true,
        onClose,
      },
    });
    await fireEvent.click(screen.getByLabelText('Close navigation menu'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(NavDrawer, {
      props: {
        navItems: [],
        masjidSlug: 'masjid-al-noor',
        pathname: '/',
        isOpen: true,
        onClose,
      },
    });
    // The backdrop is the first child: div.fixed.inset-0
    const backdrop = document.querySelector('.fixed.inset-0.z-40')!;
    await fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders active item with accent class', () => {
    const items = [
      makeNavItem({
        id: '1',
        sort_order: 0,
        label: 'Times',
        route_segment: 'prayer',
        icon: 'Clock',
      }),
      makeNavItem({
        id: '2',
        sort_order: 1,
        label: 'News',
        route_segment: 'news',
        icon: 'Newspaper',
      }),
    ];
    render(NavDrawer, {
      props: {
        navItems: items,
        masjidSlug: 'masjid-al-noor',
        pathname: '/masjid-al-noor/prayer',
        isOpen: true,
        onClose: vi.fn(),
      },
    });
    const activeLink = screen.getByText('Times').closest('a')!;
    expect(activeLink.className).toContain('bg-accent/15');
    expect(activeLink.style.color).toBe('var(--color-accent)');
  });
});