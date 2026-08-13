import { getMasjidIntegrations } from '$lib/server/db';
import type { getDb } from '$lib/server/db';
import type { SquareEnv, MaktabConfig } from './types';

export async function getSquareEnv(
  db: ReturnType<typeof getDb>,
  masjidId: string,
): Promise<Partial<SquareEnv>> {
  const integrations = await getMasjidIntegrations(db, masjidId);
  const square = integrations.square ?? {};
  return {
    SQUARE_ACCESS_TOKEN: square.access_token || '',
    SQUARE_APP_ID: square.app_id || '',
    SQUARE_LOCATION_ID: square.location_id || '',
    ENVIRONMENT: process.env.ENVIRONMENT,
  };
}

export async function getMaktabConfig(
  db: ReturnType<typeof getDb>,
  masjidId: string,
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
    ENVIRONMENT: process.env.ENVIRONMENT,
  };
}

export async function testSquareConnection(
  accessToken: string,
  locationId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!accessToken || !locationId) {
    return { ok: false, message: 'Access token and location ID are required' };
  }
  const isSandbox = accessToken.startsWith('EAAAE');
  const base = isSandbox
    ? 'https://connect.squareupsandbox.com/v2'
    : 'https://connect.squareup.com/v2';

  try {
    const res = await fetch(`${base}/locations/${encodeURIComponent(locationId)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2026-07-15',
      },
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errors = data.errors as Array<{ detail?: string }> | undefined;
      return { ok: false, message: errors?.[0]?.detail || `HTTP ${res.status}` };
    }
    const loc = data.location as Record<string, unknown> | undefined;
    const name = loc?.name || locationId;
    return { ok: true, message: `Connected — ${name} (${isSandbox ? 'sandbox' : 'production'})` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
  }
}

export async function testBrevoConnection(
  apiKey: string,
  senderEmail: string,
  senderName: string,
): Promise<{ ok: boolean; message: string }> {
  if (!apiKey) {
    return { ok: false, message: 'API key is required' };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      const data = await res.json() as Record<string, unknown>;
      return { ok: false, message: (data.message as string) || `HTTP ${res.status}` };
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
          return { ok: true, message: `API key OK (${email}), but test email failed: ${(errData.message as string) || `HTTP ${sendRes.status}`}. Check sender email is verified in Brevo.` };
        }
        return { ok: true, message: `Connected — ${email}. Test email sent to ${senderEmail}` };
      } catch {
        return { ok: true, message: `API key OK (${email}), but could not send test email` };
      }
    }

    return { ok: true, message: `Connected — ${email}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
  }
}