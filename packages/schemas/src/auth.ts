import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  admin: z.object({
    id: z.string(),
    email: z.string().email(),
    display_name: z.string().nullable(),
    masjid_id: z.string(),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const AdminInfoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  display_name: z.string().nullable(),
  masjid_id: z.string(),
  created_at: z.string(),
});
export type AdminInfo = z.infer<typeof AdminInfoSchema>;

export const UpdatePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});
export type UpdatePassword = z.infer<typeof UpdatePasswordSchema>;