import { z } from 'zod';

export const CreateJumuahSchema = z.object({
  label: z.string().min(1).max(200),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  khateeb: z.string().max(200).optional().nullable(),
  language: z.string().max(10).default('en'),
  location: z.string().max(200).optional().nullable(),
});

export const UpdateJumuahSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  khateeb: z.string().max(200).optional().nullable(),
  language: z.string().max(10).optional(),
  location: z.string().max(200).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const JumuahSessionSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  label: z.string(),
  time: z.string(),
  khateeb: z.string().nullable(),
  language: z.string(),
  location: z.string().nullable(),
  is_active: z.boolean(),
});
export type JumuahSession = z.infer<typeof JumuahSessionSchema>;