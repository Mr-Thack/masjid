import { z } from 'zod';

export const ContentType = z.enum(['post', 'page']);
export type ContentType = z.infer<typeof ContentType>;

export const CreateContentSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  title: z.string().min(1).max(300),
  content_markdown: z.string().min(1),
  content_type: ContentType.default('post'),
  show_on_homepage: z.boolean().default(false),
  show_on_info: z.boolean().default(false),
  is_hidden: z.boolean().default(false),
});
export type CreateContent = z.infer<typeof CreateContentSchema>;

export const UpdateContentSchema = CreateContentSchema.partial();
export type UpdateContent = z.infer<typeof UpdateContentSchema>;

export const ContentSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  slug: z.string(),
  title: z.string(),
  content_markdown: z.string(),
  compiled_html: z.string().nullable(),
  content_type: ContentType,
  show_on_homepage: z.boolean(),
  show_on_info: z.boolean(),
  is_hidden: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Content = z.infer<typeof ContentSchema>;