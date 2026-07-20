import { z } from 'zod';

export const BranchStatusSchema = z.enum(['OPEN', 'MERGED', 'ABANDONED']);
export type BranchStatus = z.infer<typeof BranchStatusSchema>;

export const MutationDomainSchema = z.enum([
  'THEME',
  'PROFILE',
  'PRAYER_RULES',
  'ANNOUNCEMENTS',
  'JUMUAH',
]);
export type MutationDomain = z.infer<typeof MutationDomainSchema>;

export const MutationActionTypeSchema = z.enum(['UPSERT', 'DELETE', 'PATCH']);
export type MutationActionType = z.infer<typeof MutationActionTypeSchema>;

export const CreateBranchSchema = z.object({
  masjid_id: z.string().uuid(),
  admin_id: z.string().uuid(),
  branch_name: z.string().min(1).max(100).default('main'),
});
export type CreateBranch = z.infer<typeof CreateBranchSchema>;

export const BranchSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  admin_id: z.string(),
  branch_name: z.string(),
  status: BranchStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Branch = z.infer<typeof BranchSchema>;

export const CreateMutationSchema = z.object({
  branch_id: z.string().uuid(),
  domain: MutationDomainSchema,
  action_type: MutationActionTypeSchema,
  target_key: z.string().min(1),
  payload_json: z.string().min(1),
  sequence_order: z.number().int().min(0),
});
export type CreateMutation = z.infer<typeof CreateMutationSchema>;

export const MutationSchema = z.object({
  id: z.string(),
  branch_id: z.string(),
  domain: MutationDomainSchema,
  action_type: MutationActionTypeSchema,
  target_key: z.string(),
  payload_json: z.string(),
  sequence_order: z.number().int(),
  created_at: z.string(),
});
export type Mutation = z.infer<typeof MutationSchema>;

export const SnapshotSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  summary: z.string(),
  full_state_json: z.string(),
  created_at: z.string(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const CreateSnapshotSchema = z.object({
  masjid_id: z.string().uuid(),
  summary: z.string().min(1),
  full_state_json: z.string().min(1),
});

export const AssetDomainSchema = z.enum([
  'ANNOUNCEMENTS',
  'TIMETABLE_PARSER',
  'THEME',
]);
export type AssetDomain = z.infer<typeof AssetDomainSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  associated_domain: AssetDomainSchema,
  associated_id: z.string().nullable(),
  r2_key: z.string(),
  public_url: z.string(),
  content_type: z.string(),
  file_size: z.number().int(),
  created_at: z.string(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const CreateAssetSchema = z.object({
  masjid_id: z.string().uuid(),
  associated_domain: AssetDomainSchema,
  associated_id: z.string().uuid().optional(),
  r2_key: z.string().min(1),
  public_url: z.string().url(),
  content_type: z.string().min(1),
  file_size: z.number().int().nonnegative(),
});

export const AnnouncementAttachmentSchema = z.object({
  id: z.string(),
  announcement_id: z.string(),
  asset_id: z.string(),
  created_at: z.string(),
});

export const CreateAnnouncementAttachmentSchema = z.object({
  announcement_id: z.string().uuid(),
  asset_id: z.string().uuid(),
});

export const WhatsAppMessageTypeSchema = z.enum([
  'text',
  'image',
  'audio',
  'video',
  'document',
  'location',
  'button',
  'interactive',
]);

export const WhatsAppTextMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string(),
  timestamp: z.string(),
  type: z.literal('text'),
  text: z.object({
    body: z.string(),
  }),
});

export const WhatsAppMediaMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string(),
  timestamp: z.string(),
  type: z.enum(['image', 'audio', 'video', 'document']),
  image: z.object({ id: z.string(), mime_type: z.string() }).optional(),
  audio: z.object({ id: z.string(), mime_type: z.string() }).optional(),
  video: z.object({ id: z.string(), mime_type: z.string() }).optional(),
  document: z.object({ id: z.string(), mime_type: z.string(), filename: z.string().optional() }).optional(),
});

export const WhatsAppInboundMessageSchema = z.discriminatedUnion('type', [
  WhatsAppTextMessageSchema,
  WhatsAppMediaMessageSchema,
]);

export const WhatsAppWebhookEntrySchema = z.object({
  id: z.string(),
  changes: z.array(z.object({
    value: z.object({
      messaging_product: z.literal('whatsapp'),
      metadata: z.object({
        display_phone_number: z.string(),
        phone_number_id: z.string(),
      }),
      messages: z.array(WhatsAppInboundMessageSchema).optional(),
      statuses: z.array(z.object({
        id: z.string(),
        status: z.string(),
        timestamp: z.string(),
        recipient_id: z.string(),
      })).optional(),
    }),
  })),
});

export const WhatsAppWebhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(WhatsAppWebhookEntrySchema),
});

export const WhatsAppWebhookVerifySchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

export const WhatsAppTextReplySchema = z.object({
  messaging_product: z.literal('whatsapp'),
  to: z.string().min(1),
  text: z.object({
    body: z.string().min(1),
  }),
});
export type WhatsAppTextReply = z.infer<typeof WhatsAppTextReplySchema>;
