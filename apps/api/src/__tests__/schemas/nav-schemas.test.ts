import { describe, it, expect } from 'vitest';
import {
  NavItemKind, RouteSegment, IconName,
  CreateNavItemSchema, UpdateNavItemSchema, ReorderNavSchema,
  NavItemResponseSchema,
  CreatePageSchema, UpdatePageSchema, PageResponseSchema,
} from '@masjid/schemas';

// ---------------------------------------------------------------------------
// CreateNavItemSchema
// ---------------------------------------------------------------------------
describe('CreateNavItemSchema', () => {
  // -- Route items --

  it('accepts valid route item', () => {
    const input = { kind: 'route' as const, route_segment: 'prayer' as const, label: 'Times' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts route with all optional fields', () => {
    const input = {
      kind: 'route' as const,
      route_segment: 'info' as const,
      label: 'Info',
      icon: 'Info' as const,
      is_highlighted: true,
      show_on_desktop_header: true,
      show_on_mobile_bottom: false,
    };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects route without route_segment', () => {
    const input = { kind: 'route' as const, label: 'Bad' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects route with invalid route_segment', () => {
    const input = { kind: 'route' as const, route_segment: 'home' as const, label: 'Home' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects route without label', () => {
    const input = { kind: 'route' as const, route_segment: 'prayer' as const };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects label longer than 30 chars', () => {
    const input = { kind: 'route' as const, route_segment: 'prayer' as const, label: 'A'.repeat(31) };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // -- Page items --

  it('accepts valid page item', () => {
    const input = { kind: 'page' as const, page_slug: 'about', label: 'About' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects page without page_slug', () => {
    const input = { kind: 'page' as const, label: 'About' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // -- Link items --

  it('accepts valid link item', () => {
    const input = { kind: 'link' as const, external_url: 'https://example.com', label: 'Website' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects link without external_url', () => {
    const input = { kind: 'link' as const, label: 'Website' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects link with invalid URL', () => {
    const input = { kind: 'link' as const, external_url: 'not-a-url', label: 'Bad' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // -- Icon validation --

  it('accepts valid icon names', () => {
    const icons = ['Clock', 'Newspaper', 'Info', 'GraduationCap', 'Heart', 'Users', 'Megaphone', 'ExternalLink', 'FileText'] as const;
    for (const icon of icons) {
      const input = { kind: 'route' as const, route_segment: 'prayer' as const, label: 'Test', icon };
      const result = CreateNavItemSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid icon name', () => {
    const input = { kind: 'route' as const, route_segment: 'prayer' as const, label: 'Test', icon: 'Banana' };
    const result = CreateNavItemSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateNavItemSchema
// ---------------------------------------------------------------------------
describe('UpdateNavItemSchema', () => {
  it('accepts partial update of route_segment only', () => {
    const input = { kind: 'route' as const, route_segment: 'news' as const };
    const result = UpdateNavItemSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts partial update of label only', () => {
    const input = { kind: 'link' as const, label: 'New Label' };
    const result = UpdateNavItemSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts is_highlighted toggle', () => {
    const input = { kind: 'route' as const, is_highlighted: true };
    const result = UpdateNavItemSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ReorderNavSchema
// ---------------------------------------------------------------------------
describe('ReorderNavSchema', () => {
  it('accepts array of item IDs', () => {
    const input = { item_ids: ['id1', 'id2'] };
    const result = ReorderNavSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts empty array', () => {
    const input = { item_ids: [] };
    const result = ReorderNavSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects non-array', () => {
    const input = { item_ids: 'not-array' };
    const result = ReorderNavSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NavItemResponseSchema
// ---------------------------------------------------------------------------
describe('NavItemResponseSchema', () => {
  it('validates full response shape', () => {
    const input = {
      id: 'abc-123',
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
      created_at: '2024-01-01T00:00:00.000Z',
    };
    const result = NavItemResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CreatePageSchema
// ---------------------------------------------------------------------------
describe('CreatePageSchema', () => {
  it('accepts valid page creation', () => {
    const input = { slug: 'about-us', title: 'About Us', raw_markdown: '# Hello' };
    const result = CreatePageSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects slug with spaces', () => {
    const input = { slug: 'bad slug', title: 'Bad', raw_markdown: 'x' };
    const result = CreatePageSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase', () => {
    const input = { slug: 'BadSlug', title: 'Bad', raw_markdown: 'x' };
    const result = CreatePageSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const input = { slug: 'test', title: '', raw_markdown: 'x' };
    const result = CreatePageSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty raw_markdown', () => {
    const input = { slug: 'test', title: 'Test', raw_markdown: '' };
    const result = CreatePageSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdatePageSchema
// ---------------------------------------------------------------------------
describe('UpdatePageSchema', () => {
  it('accepts partial update', () => {
    const input = { title: 'New Title' };
    const result = UpdatePageSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const input = {};
    const result = UpdatePageSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PageResponseSchema
// ---------------------------------------------------------------------------
describe('PageResponseSchema', () => {
  it('validates full response with compiled_html', () => {
    const input = {
      id: 'x',
      masjid_id: 'y',
      slug: 'about',
      title: 'About',
      compiled_html: '<p>hi</p>',
      raw_markdown: 'hi',
      last_updated: '2024-01-01',
    };
    const result = PageResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts null compiled_html', () => {
    const input = {
      id: 'x',
      masjid_id: 'y',
      slug: 'about',
      title: 'About',
      compiled_html: null,
      raw_markdown: 'hi',
      last_updated: '2024-01-01',
    };
    const result = PageResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts null last_updated', () => {
    const input = {
      id: 'x',
      masjid_id: 'y',
      slug: 'about',
      title: 'About',
      compiled_html: '<p>hi</p>',
      raw_markdown: 'hi',
      last_updated: null,
    };
    const result = PageResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});