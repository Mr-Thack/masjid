import { z } from 'zod';

export const IntegrationProvider = z.enum(['square', 'brevo']);
export type IntegrationProvider = z.infer<typeof IntegrationProvider>;

export const SquareConfigSchema = z.object({
  access_token: z.string().optional(),
  app_id: z.string().optional(),
  location_id: z.string().optional(),
});

export const BrevoConfigSchema = z.object({
  api_key: z.string().optional(),
  sender_email: z.string().email().optional().or(z.literal('')),
  sender_name: z.string().optional(),
  forward_to_email: z.string().email().optional().or(z.literal('')),
  logging_email: z.string().email().optional().or(z.literal('')),
  bot_name: z.string().optional(),
});

export const UpdateIntegrationsSchema = z.object({
  square: SquareConfigSchema.optional(),
  brevo: BrevoConfigSchema.optional(),
});

export type UpdateIntegrations = z.infer<typeof UpdateIntegrationsSchema>;

export interface IntegrationsResponse {
  square: {
    access_token: string;
    app_id: string;
    location_id: string;
    configured: boolean;
  };
  brevo: {
    api_key: string;
    sender_email: string;
    sender_name: string;
    forward_to_email: string;
    logging_email: string;
    bot_name: string;
    configured: boolean;
  };
}