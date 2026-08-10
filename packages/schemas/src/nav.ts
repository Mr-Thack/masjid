import { z } from 'zod';

export const NavItemKind = z.enum(['route', 'page', 'link']);
export type NavItemKind = z.infer<typeof NavItemKind>;

export const RouteSegment = z.enum([
  'prayer', 'news', 'info', 'maktab', 'donate', 'jumuah', 'announcements',
]);
export type RouteSegment = z.infer<typeof RouteSegment>;

export const IconName = z.enum([
  'Clock', 'Newspaper', 'Info', 'GraduationCap', 'Heart',
  'Users', 'Megaphone', 'ExternalLink', 'FileText',
]);
export type IconName = z.infer<typeof IconName>;

export const CreateNavItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('route'),
    route_segment: RouteSegment,
    label: z.string().min(1).max(30),
    icon: IconName.optional(),
    is_highlighted: z.boolean().default(false),
    show_on_desktop_header: z.boolean().default(true),
    show_on_mobile_bottom: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('page'),
    page_slug: z.string().min(1).max(50),
    label: z.string().min(1).max(30),
    icon: IconName.optional(),
    is_highlighted: z.boolean().default(false),
    show_on_desktop_header: z.boolean().default(true),
    show_on_mobile_bottom: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('link'),
    external_url: z.string().url(),
    label: z.string().min(1).max(30),
    icon: IconName.optional(),
    is_highlighted: z.boolean().default(false),
    show_on_desktop_header: z.boolean().default(true),
    show_on_mobile_bottom: z.boolean().default(true),
  }),
]);

export type CreateNavItem = z.infer<typeof CreateNavItemSchema>;

export const UpdateNavItemSchema = z.object({
  kind: NavItemKind.optional(),
  route_segment: RouteSegment.optional(),
  page_slug: z.string().min(1).max(50).optional(),
  external_url: z.string().url().optional(),
  label: z.string().min(1).max(30).optional(),
  icon: IconName.optional().nullable(),
  is_highlighted: z.boolean().optional(),
  show_on_desktop_header: z.boolean().optional(),
  show_on_mobile_bottom: z.boolean().optional(),
});

export type UpdateNavItem = z.infer<typeof UpdateNavItemSchema>;

export const ReorderNavSchema = z.object({
  item_ids: z.array(z.string()),
});

export const NavItemResponseSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  sort_order: z.number().int(),
  kind: NavItemKind,
  route_segment: z.string().optional().nullable(),
  page_slug: z.string().optional().nullable(),
  external_url: z.string().optional().nullable(),
  label: z.string(),
  icon: z.string().optional().nullable(),
  is_highlighted: z.boolean(),
  show_on_desktop_header: z.boolean(),
  show_on_mobile_bottom: z.boolean(),
  created_at: z.string(),
});

export const CreatePageSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(200),
  raw_markdown: z.string().min(1),
});

export const UpdatePageSchema = CreatePageSchema.partial();

export const PageResponseSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  slug: z.string(),
  title: z.string(),
  compiled_html: z.string().nullable(),
  raw_markdown: z.string(),
  last_updated: z.string().nullable(),
});