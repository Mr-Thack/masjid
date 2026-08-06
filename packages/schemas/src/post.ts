import { z } from 'zod';

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(300),
  content_markdown: z.string().min(1),
  show_on_homepage: z.boolean().default(false),
  show_on_info: z.boolean().default(false),
  is_hidden: z.boolean().default(false),
});
export type CreatePost = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content_markdown: z.string().min(1).optional(),
  show_on_homepage: z.boolean().optional(),
  show_on_info: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
});
export type UpdatePost = z.infer<typeof UpdatePostSchema>;

export const PostSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  slug: z.string(),
  title: z.string(),
  content_markdown: z.string(),
  compiled_html: z.string().nullable(),
  show_on_homepage: z.boolean(),
  show_on_info: z.boolean(),
  is_hidden: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Post = z.infer<typeof PostSchema>;