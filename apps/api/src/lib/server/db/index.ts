import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(d1?: D1Database) {
  if (!d1) {
    throw new Error('D1 database binding not available');
  }
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;