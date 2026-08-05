import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;

export const GET: RequestHandler = async ({ platform }) => {
  const status: Record<string, unknown> = {
    worker: 'alive',
    build_id: __BUILD_ID__,
    build_time: __BUILD_TIME__,
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