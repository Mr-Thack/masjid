import { getMasjidIntegrations } from '$lib/server/db';
import type { getDb } from '$lib/server/db';
import type { SquareEnv, MaktabConfig } from './types';
import { getSquareBaseUrl } from './square';

export async function getSquareEnv(
  db: ReturnType<typeof getDb>,
  masjidId: string,
  environment?: string,
): Promise<Partial<SquareEnv>> {
  const integrations = await getMasjidIntegrations(db, masjidId);
  const square = integrations.square ?? {};
  return {
    SQUARE_ACCESS_TOKEN: square.access_token || '',
    SQUARE_APP_ID: square.app_id || '',
    SQUARE_LOCATION_ID: square.location_id || '',
    ENVIRONMENT: environment || process.env.ENVIRONMENT,
  };
}

export async function getMaktabConfig(
  db: ReturnType<typeof getDb>,
  masjidId: string,
  environment?: string,
): Promise<MaktabConfig> {
  const integrations = await getMasjidIntegrations(db, masjidId);
  const square = integrations.square ?? {};
  const brevo = integrations.brevo ?? {};
  return {
    SQUARE_ACCESS_TOKEN: square.access_token || '',
    SQUARE_APP_ID: square.app_id || '',
    SQUARE_LOCATION_ID: square.location_id || '',
    BREVO_API_KEY: brevo.api_key || '',
    SENDER_EMAIL: brevo.sender_email || '',
    SENDER_NAME: brevo.sender_name || '',
    FORWARD_TO_EMAIL: brevo.forward_to_email || '',
    LOGGING_EMAIL: brevo.logging_email || '',
    BOT_NAME: brevo.bot_name || '',
    ENVIRONMENT: environment || process.env.ENVIRONMENT,
  };
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  environment?: 'production' | 'sandbox';
  hints: string[];
}

const SQUARE_VERSION = '2026-07-15';

function tokenFormat(token: string): 'sandbox' | 'production' | 'unknown' {
  if (token.startsWith('EAAAE')) return 'sandbox';
  if (token.startsWith('EAAAl_')) return 'production';
  return 'unknown';
}

function appIdFormat(appId: string): 'sandbox' | 'production' | 'unknown' {
  if (appId.startsWith('sandbox-sq0idb-')) return 'sandbox';
  if (appId.startsWith('sq0idp-')) return 'production';
  return 'unknown';
}

export async function testSquareConnection(
  accessToken: string,
  appId: string,
  locationId: string,
  environment?: string,
): Promise<ConnectionTestResult> {
  if (!accessToken || !locationId) {
    return { ok: false, message: 'Access token and location ID are required', hints: [] };
  }
  const envLabel = environment === 'production' ? 'production' : 'sandbox';
  const base = getSquareBaseUrl(environment);
  const hints: string[] = [];

  const tokenFormatGuess = tokenFormat(accessToken);
  const appFormatGuess = appIdFormat(appId);
  if (tokenFormatGuess !== 'unknown' && tokenFormatGuess !== envLabel) {
    hints.push(
      `The access token looks like a ${tokenFormatGuess} token, but this worker tests against the ${envLabel} Square API. Tokens only work on the environment they were created for.`,
    );
  }
  if (appFormatGuess !== 'unknown' && appFormatGuess !== envLabel) {
    hints.push(
      `The application ID looks like a ${appFormatGuess} app ID, but this worker tests against the ${envLabel} Square API. App IDs only work on the environment they were created for.`,
    );
  }

  try {
    const res = await fetch(`${base}/locations/${encodeURIComponent(locationId)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': SQUARE_VERSION,
      },
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return squareFailureResult(res.status, data as SquareErrorResponse, envLabel, hints);
    }
    const loc = data.location as Record<string, unknown> | undefined;
    const name = loc?.name || locationId;

    const catalog = await fetch(`${base}/catalog/list`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': SQUARE_VERSION,
      },
    });
    if (!catalog.ok) {
      const catalogData = await catalog.json() as SquareErrorResponse;
      return {
        ok: false,
        message: `Token is valid (${name}), but the catalog API is not accessible — enrollment cannot create subscription plans.`,
        environment: envLabel,
        hints: [
          ...hints,
          ...errorHints(catalog.status, catalogData, 'the catalog API'),
        ],
      };
    }

    return {
      ok: true,
      message: `Connected — ${name} (${envLabel})`,
      environment: envLabel,
      hints,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Connection failed',
      environment: envLabel,
      hints,
    };
  }
}

interface SquareErrorResponse {
  errors?: Array<{ category?: string; code?: string; detail?: string }>;
}

function squareFailureResult(
  status: number,
  data: SquareErrorResponse,
  envLabel: 'production' | 'sandbox',
  existingHints: string[],
): ConnectionTestResult {
  const err = data.errors?.[0];
  const category = err?.category || '';
  const code = err?.code || '';
  const detail = err?.detail || '';
  const hints = [...existingHints, ...errorHints(status, data, 'the locations lookup')];

  const label = category || code || `HTTP ${status}`;
  const codeSuffix = category && code && code !== category ? ` (${code})` : '';
  return {
    ok: false,
    message: detail
      ? `${label}${codeSuffix} — ${detail}`
      : `HTTP ${status} — ${category} ${code}`.trim(),
    environment: envLabel,
    hints,
  };
}

function errorHints(status: number, data: SquareErrorResponse, where: string): string[] {
  const err = data.errors?.[0];
  const category = err?.category || '';
  const code = err?.code || '';
  const detail = err?.detail || '';
  const hints: string[] = [];

  if (category === 'AUTHENTICATION_ERROR' || code === 'UNAUTHORIZED') {
    hints.push(
      `Square rejected the token on ${where}. Check that the token was not revoked, rotated, or expired (Square Developer Dashboard → your app → OAuth).`,
    );
    hints.push(
      'The token must have been generated for the same Square environment you are testing against (sandbox vs production).',
    );
    hints.push(
      'Enrollment needs these OAuth scopes on the token: customers (write), payments (write), subscriptions, catalog/items (write), and merchant profile (read).',
    );
    hints.push('Re-copy the token — a truncated or extra-whitespace token fails authorization.');
  } else if (category === 'NOT_FOUND' || code === 'NOT_FOUND' || /location/i.test(detail)) {
    hints.push(
      'Square could not find the location ID on this account. The location ID must belong to the same account and environment as the access token.',
    );
    hints.push('Find the correct location ID in Square Dashboard → Locations → your location → Settings.');
  } else if (category === 'FORBIDDEN' || code === 'FORBIDDEN') {
    hints.push(
      'The token is valid but does not have permission for this API call. Grant the missing scopes in the Square Developer Dashboard, or regenerate the token.',
    );
  } else if (status === 429) {
    hints.push('Square rate-limited the request. Wait a minute and try again.');
  } else if (status >= 500) {
    hints.push('Square is having an outage or degraded service. Retry shortly — this is not a token problem.');
  } else {
    hints.push(`Square returned an unexpected error on ${where}. See the message above.`);
  }
  return hints;
}

export async function testBrevoConnection(
  apiKey: string,
  senderEmail: string,
  senderName: string,
): Promise<ConnectionTestResult> {
  if (!apiKey) {
    return { ok: false, message: 'API key is required', hints: [] };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      const data = await res.json() as Record<string, unknown>;
      return {
        ok: false,
        message: (data.message as string) || `HTTP ${res.status}`,
        hints: [
          'The API key was rejected. Check it was copied in full and not revoked (Brevo → Settings → API Keys).',
        ],
      };
    }
    const data = await res.json() as Record<string, unknown>;
    const email = (data.email as string) || 'account';

    if (senderEmail) {
      try {
        const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            sender: { email: senderEmail, name: senderName || 'Masjid Test' },
            to: [{ email: senderEmail }],
            subject: 'Masjid Platform — Integration Test',
            htmlContent: '<p>This is a test email from the Masjid platform. Your Brevo integration is working correctly.</p>',
          }),
        });
        if (!sendRes.ok) {
          const errData = await sendRes.json() as Record<string, unknown>;
          return {
            ok: true,
            message: `API key OK (${email}), but test email failed: ${(errData.message as string) || `HTTP ${sendRes.status}`}. Check sender email is verified in Brevo.`,
            hints: ['The sender email must be verified as a sender in Brevo → Senders.'],
          };
        }
        return { ok: true, message: `Connected — ${email}. Test email sent to ${senderEmail}`, hints: [] };
      } catch {
        return { ok: true, message: `API key OK (${email}), but could not send test email`, hints: [] };
      }
    }

    return { ok: true, message: `Connected — ${email}`, hints: [] };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Connection failed',
      hints: [],
    };
  }
}