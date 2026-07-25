import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
  const status: Record<string, unknown> = {
    worker: 'alive',
    timestamp: new Date().toISOString(),
    env: {
      has_jwt_secret: !!(platform?.env?.JWT_SECRET),
      has_db_binding: !!(platform?.env?.DB),
      environment: platform?.env?.ENVIRONMENT ?? 'unknown',
    },
  };

  try {
    if (platform?.env?.DB) {
      const result = await platform.env.DB.prepare('SELECT 1 as ok').first();
      status.db = { connected: true, test: result };
    } else {
      status.db = { connected: false, reason: 'no D1 binding' };
    }
  } catch (e) {
    status.db = { connected: false, error: String(e) };
  }

  return json(status);
};