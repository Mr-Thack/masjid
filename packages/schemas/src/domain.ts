import { z } from 'zod';

export const CreateDomainSchema = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/),
});

export const DomainSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  domain: z.string(),
  cf_hostname_id: z.string().nullable(),
  ssl_status: z.enum(['pending', 'active', 'error']),
  verified_at: z.string().nullable(),
  created_at: z.string(),
});
export type CustomDomain = z.infer<typeof DomainSchema>;