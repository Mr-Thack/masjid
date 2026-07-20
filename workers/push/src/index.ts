export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    try {
      const masjids = await env.DB.prepare(
        'SELECT id, slug, name, timezone, calculation_method, latitude, longitude FROM masjids WHERE tenant_status = ?'
      )
        .bind('ACTIVE')
        .all<{
          id: string;
          slug: string;
          name: string;
          timezone: string;
          calculation_method: number;
          latitude: number;
          longitude: number;
        }>();

      if (!masjids.results || masjids.results.length === 0) {
        console.log('No active masjids found');
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      for (const masjid of masjids.results) {
        ctx.waitUntil(processMasjid(env, masjid, today));
      }

      console.log(`Scheduled push for ${masjids.results.length} masjids`);
    } catch (err) {
      console.error('Scheduled push failed:', err);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response('Push notification worker is running', { status: 200 });
  },
};

async function processMasjid(
  env: Env,
  masjid: {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    calculation_method: number;
    latitude: number;
    longitude: number;
  },
  date: string,
): Promise<void> {
  try {
    const subscriptions = await env.DB.prepare(
      'SELECT subscription_json FROM push_subscriptions WHERE masjid_id = ?'
    )
      .bind(masjid.id)
      .all<{ subscription_json: string }>();

    if (!subscriptions.results || subscriptions.results.length === 0) {
      return;
    }

    const cached = await env.CACHE?.get(`prayer:${masjid.id}:${date}`);
    if (!cached) return;

    const times = JSON.parse(cached) as {
      times: Record<string, { adhaan: string; iqaamah: string }>;
    };

    const payload = JSON.stringify({
      title: `${masjid.name} Prayer Times`,
      body: `Fajr: ${times.times.fajr?.adhaan} | Dhuhr: ${times.times.dhuhr?.adhaan} | Asr: ${times.times.asr?.adhaan}`,
      icon: '/icon-192.png',
      data: { masjid_slug: masjid.slug, date },
    });

    for (const sub of subscriptions.results) {
      try {
        const subscription = JSON.parse(sub.subscription_json);
        await sendNotification(subscription, payload, env);
      } catch (err) {
        console.error(`Failed to send push to subscriber of masjid ${masjid.id}:`, err);
      }
    }
  } catch (err) {
    console.error(`Failed to process masjid ${masjid.id}:`, err);
  }
}

async function sendNotification(
  subscription: PushSubscriptionJSON,
  payload: string,
  env: Env,
): Promise<void> {
  try {
    const response = await fetch('https://notifications.example.com/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, payload }),
    });

    if (!response.ok) {
      console.warn(`Push notification failed with status ${response.status}`);
    }
  } catch (err) {
    console.error('Push notification send failed:', err);
  }
}

interface PushSubscriptionJSON {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
}

interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}