import {
  UpdateIntegrationsSchema,
  ErrorJsonResponse,
  JsonResponse,
} from '@masjid/schemas';
import { getDb, getMasjidIntegrations, upsertIntegrationValue } from '$lib/server/db';
import { testSquareConnection, testBrevoConnection } from '$lib/server/maktab/integrations';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const BULLET = '\u25CF';

function maskValue(value: string): string {
  return BULLET.repeat(value.length);
}

function isMasked(value: string): boolean {
  return value.length > 0 && [...value].every((ch) => ch === BULLET);
}

const SQUARE_KEYS = ['access_token', 'app_id', 'location_id'] as const;
const BREVO_KEYS = ['api_key', 'sender_email', 'sender_name', 'forward_to_email', 'logging_email', 'bot_name'] as const;

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const db = getDb(platform?.env?.DB);
    const integrations = await getMasjidIntegrations(db, params.id);

    const square = integrations.square ?? {};
    const brevo = integrations.brevo ?? {};

    return JsonResponse({
      square: {
        access_token: square.access_token ? maskValue(square.access_token) : '',
        app_id: square.app_id || '',
        location_id: square.location_id || '',
        configured: !!(square.access_token && square.app_id && square.location_id),
      },
      brevo: {
        api_key: brevo.api_key ? maskValue(brevo.api_key) : '',
        sender_email: brevo.sender_email || '',
        sender_name: brevo.sender_name || '',
        forward_to_email: brevo.forward_to_email || '',
        logging_email: brevo.logging_email || '',
        bot_name: brevo.bot_name || '',
        configured: !!(brevo.api_key && brevo.sender_email),
      },
    });
  } catch (e) {
    console.error('GET integrations error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to load integrations');
  }
};

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only update your own masjid');
  }

  try {
    const body = UpdateIntegrationsSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    if (body.square) {
      for (const key of SQUARE_KEYS) {
        const val = body.square[key];
        if (val !== undefined && !isMasked(val)) {
          await upsertIntegrationValue(db, params.id, 'square', key, val);
        }
      }
    }

    if (body.brevo) {
      for (const key of BREVO_KEYS) {
        const val = body.brevo[key];
        if (val !== undefined && !isMasked(val)) {
          await upsertIntegrationValue(db, params.id, 'brevo', key, val);
        }
      }
    }

    const integrations = await getMasjidIntegrations(db, params.id);
    const square = integrations.square ?? {};
    const brevo = integrations.brevo ?? {};

    return JsonResponse({
      square: {
        access_token: square.access_token ? maskValue(square.access_token) : '',
        app_id: square.app_id || '',
        location_id: square.location_id || '',
        configured: !!(square.access_token && square.app_id && square.location_id),
      },
      brevo: {
        api_key: brevo.api_key ? maskValue(brevo.api_key) : '',
        sender_email: brevo.sender_email || '',
        sender_name: brevo.sender_name || '',
        forward_to_email: brevo.forward_to_email || '',
        logging_email: brevo.logging_email || '',
        bot_name: brevo.bot_name || '',
        configured: !!(brevo.api_key && brevo.sender_email),
      },
    });
  } catch (e) {
    console.error('PUT integrations error:', e);
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', e.message);
    }
    return ErrorJsonResponse('INTERNAL_ERROR', 'Failed to update integrations');
  }
};

const TestIntegrationSchema = z.object({
  provider: z.enum(['square', 'brevo']),
  square: z.object({
    access_token: z.string(),
    app_id: z.string(),
    location_id: z.string(),
  }).optional(),
  brevo: z.object({
    api_key: z.string(),
    sender_email: z.string(),
    sender_name: z.string().optional(),
  }).optional(),
});

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.admin) {
    return ErrorJsonResponse('UNAUTHORIZED', 'Authentication required');
  }
  if (locals.admin.masjid_id !== params.id) {
    return ErrorJsonResponse('FORBIDDEN', 'You can only access your own masjid');
  }

  try {
    const body = TestIntegrationSchema.parse(await request.json());
    const db = getDb(platform?.env?.DB);

    if (body.provider === 'square') {
      if (!body.square) {
        return ErrorJsonResponse('VALIDATION_ERROR', 'Square config is required');
      }

      let accessToken = body.square.access_token;
      if (isMasked(accessToken)) {
        const integrations = await getMasjidIntegrations(db, params.id);
        accessToken = integrations.square?.access_token || '';
      }

      const result = await testSquareConnection(
        accessToken,
        body.square.app_id,
        body.square.location_id,
        platform?.env?.ENVIRONMENT,
      );
      return JsonResponse(result);
    }

    if (body.provider === 'brevo') {
      if (!body.brevo) {
        return ErrorJsonResponse('VALIDATION_ERROR', 'Brevo config is required');
      }

      let apiKey = body.brevo.api_key;
      if (isMasked(apiKey)) {
        const integrations = await getMasjidIntegrations(db, params.id);
        apiKey = integrations.brevo?.api_key || '';
      }

      const result = await testBrevoConnection(
        apiKey,
        body.brevo.sender_email,
        body.brevo.sender_name || '',
      );
      return JsonResponse(result);
    }

    return ErrorJsonResponse('VALIDATION_ERROR', 'Unknown provider');
  } catch (e) {
    if (e instanceof Error && e.name === 'ZodError') {
      return ErrorJsonResponse('VALIDATION_ERROR', e.message);
    }
    console.error('POST integrations test error:', e);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Test failed');
  }
};