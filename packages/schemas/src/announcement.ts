import { z } from 'zod';
import { PrayerName } from './prayer';

export const AnnouncementStatus = z.enum(['draft', 'published', 'archived']);
export type AnnouncementStatus = z.infer<typeof AnnouncementStatus>;

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300),
  content_markdown: z.string().min(1),
  status: AnnouncementStatus.default('published'),
  is_pinned: z.boolean().default(false),
  expires_at: z.string().datetime().optional().nullable(),
});

export const UpdateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content_markdown: z.string().min(1).optional(),
  status: AnnouncementStatus.optional(),
  is_pinned: z.boolean().optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

export const AnnouncementSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  title: z.string(),
  slug: z.string(),
  content_markdown: z.string(),
  compiled_html: z.string().nullable(),
  is_pinned: z.boolean(),
  status: AnnouncementStatus,
  published_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const PinToggleSchema = z.object({
  pinned: z.boolean(),
});
export type PinToggle = z.infer<typeof PinToggleSchema>;