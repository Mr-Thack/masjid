import { drizzle } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';
import { masjidThemes } from './schema';

const PROJECT_ROOT = typeof import.meta.dirname !== 'undefined'
  ? path.resolve(import.meta.dirname, '../../../../../..')
  : '/dummy';
// Env override exists so tooling (e.g. tooling/dump-seed-sql.ts) can point the
// local dev DB at a throwaway file. Never set in production.
const LOCAL_DB_PATH = process.env.MASJID_DB_PATH
  ? path.resolve(process.env.MASJID_DB_PATH)
  : path.resolve(PROJECT_ROOT, '.masjid/local.db');

let localDb: ReturnType<typeof drizzleSqlite> | null = null;
let localSqlite: Database.Database | null = null;

function getLocalDb() {
  if (localDb) return localDb;
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(LOCAL_DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const schemaSql = fs.readFileSync(path.resolve(PROJECT_ROOT, 'schema.sql'), 'utf-8');
  // Only bootstrap a fresh DB — idempotent across process restarts.
  const hasTables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='masjids'").get();
  if (!hasTables) sqlite.exec(schemaSql);
  localSqlite = sqlite;
  localDb = drizzleSqlite(sqlite, { schema });
  return localDb;
}

function getLocalSqlite(): Database.Database {
  getLocalDb(); // ensure initialized
  return localSqlite!;
}

export function getDb(d1?: unknown): ReturnType<typeof drizzleSqlite> {
  // In local Node.js dev: always use our local SQLite, not the adapter's mock D1.
  const isWorker = typeof caches !== 'undefined' && typeof caches.default !== 'undefined';
  if (!isWorker && typeof process !== 'undefined') {
    return getLocalDb();
  }
  // In Cloudflare Workers: use the real D1 binding.
  if (d1) {
    return drizzle(d1 as D1Database, { schema }) as unknown as ReturnType<typeof drizzleSqlite>;
  }
  throw new Error('D1 database binding not available');
}

/**
 * Fetch a single masjid_themes row — always returns correct data.
 *
 * On D1 (production): uses the raw D1 binding to get named-object results,
 * avoiding Drizzle's positional column mapping (which fails when the D1
 * table column order differs from the Drizzle schema order).
 *
 * On local SQLite: falls back to Drizzle ORM (works fine locally).
 */
export async function fetchThemeRow(
  db: ReturnType<typeof drizzleSqlite>,
  masjidId: string,
  d1Binding?: unknown,
): Promise<Record<string, unknown> | null> {
  const isWorker = typeof caches !== 'undefined' && typeof caches.default !== 'undefined';
  if (isWorker && d1Binding != null && typeof (d1Binding as Record<string, unknown>).prepare === 'function') {
    const stmt = (d1Binding as D1Database).prepare(
      'SELECT style_system, style_options, layout_preset, primary_color, ' +
      'accent_color, font_heading, font_body, time_format, ' +
      'label_adhaan, label_iqaamah, label_jumuah, label_speech, ' +
      'label_sunrise, label_fajr, label_dhuhr, label_asr, ' +
      'label_maghrib, label_isha ' +
      'FROM masjid_themes WHERE masjid_id = ?1'
    );
    const result = await stmt.bind(masjidId).all();
    return (result.results[0] as Record<string, unknown>) ?? null;
  }
  // Local dev fallback — Drizzle works fine with better-sqlite3
  const t = await db.select().from(masjidThemes).where(eq(masjidThemes.masjidId, masjidId)).get();
  if (!t) return null;
  const keys = ['style_system', 'style_options', 'layout_preset', 'primary_color', 'accent_color',
    'font_heading', 'font_body', 'time_format', 'label_adhaan', 'label_iqaamah',
    'label_jumuah', 'label_speech', 'label_sunrise', 'label_fajr', 'label_dhuhr',
    'label_asr', 'label_maghrib', 'label_isha'] as const;
  return Object.fromEntries(keys.map(k => {
    // Map snake_case column name to Drizzle camelCase property
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return [k, (t as Record<string, unknown>)[camel]];
  })) as Record<string, unknown>;
}

export type Db = ReturnType<typeof getDb>;

// ── D1 shim for local dev ───────────────────────────────────────────────────
// Agent session functions require D1Database. In local vite dev we don't have
// a real D1 binding, so we wrap the shared better-sqlite3 connection as a
// D1-compatible interface.

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
  raw<T = unknown>(): Promise<T[]>;
}

let _d1Shim: D1Database | null = null;

export function getD1Shim(): D1Database {
  if (_d1Shim) return _d1Shim;

  const sqlite = getLocalSqlite();

  const db = {
    prepare(sql: string): D1Stmt {
      // Lazy: defer SQL compilation to execution time (D1 behaviour).
      // better-sqlite3 compiles eagerly — table-missing errors would fire
      // at prepare() instead of first()/all()/run().
      let params: unknown[] = [];

      function getStmt() {
        return sqlite.prepare(sql);
      }

      return {
        bind(...values: unknown[]) {
          params = values;
          return this;
        },
        async first<T>() {
          try {
            const stmt = getStmt();
            stmt.bind(params);
            return (stmt.get() as T | undefined) ?? null;
          } catch (e) {
            console.error('D1 shim first() error:', e instanceof Error ? e.message : e);
            return null;
          }
        },
        async all<T>() {
          try {
            const stmt = getStmt();
            stmt.bind(params);
            return { results: stmt.all() as T[], success: true, meta: {} };
          } catch (e) {
            console.error('D1 shim all() error:', e instanceof Error ? e.message : e);
            return { results: [], success: false, meta: {} };
          }
        },
        async run() {
          try {
            const stmt = getStmt();
            stmt.bind(params);
            stmt.run();
            return { results: [], success: true, meta: {} };
          } catch (e) {
            console.error('D1 shim run() error:', e instanceof Error ? e.message : e);
            return { results: [], success: false, meta: {} };
          }
        },
        async raw<T>() {
          try {
            const stmt = getStmt();
            stmt.bind(params);
            return stmt.all() as T[];
          } catch (e) {
            console.error('D1 shim raw() error:', e instanceof Error ? e.message : e);
            return [];
          }
        },
      };
    },
    batch() { throw new Error('D1 batch() not supported in local shim'); },
    exec() { throw new Error('D1 exec() not supported in local shim'); },
    dump() { throw new Error('D1 dump() not supported in local shim'); },
  } as unknown as D1Database;

  _d1Shim = db;
  return db;
}

export function getAgentDb(platformDb: D1Database | undefined): D1Database {
  // In local Node.js dev, bypass the adapter's mock D1 (same as getDb() does).
  // The mock D1 points to a different SQLite file than our .masjid/local.db.
  const isWorker = typeof caches !== 'undefined' && typeof caches.default !== 'undefined';
  if (!isWorker && typeof process !== 'undefined') {
    return getD1Shim();
  }
  if (platformDb) return platformDb;
  return getD1Shim();
}