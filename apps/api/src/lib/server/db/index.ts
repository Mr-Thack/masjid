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
  ensureTables(sqlite);
  localSqlite = sqlite;
  localDb = drizzleSqlite(sqlite, { schema });
  return localDb;
}

function getLocalSqlite(): Database.Database {
  getLocalDb(); // ensure initialized
  return localSqlite!;
}

export function ensureTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS masjids (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Chicago',
      calculation_method INTEGER NOT NULL DEFAULT 2,
      fajr_angle REAL,
      isha_angle REAL,
      asr_madhab TEXT NOT NULL DEFAULT 'shafi',
      high_latitude_rule TEXT NOT NULL DEFAULT 'seventh_of_night',
      show_dual_asr INTEGER NOT NULL DEFAULT 0,
      adjust_fajr INTEGER NOT NULL DEFAULT 0,
      adjust_sunrise INTEGER NOT NULL DEFAULT 0,
      adjust_dhuhr INTEGER NOT NULL DEFAULT 0,
      adjust_asr INTEGER NOT NULL DEFAULT 0,
      adjust_maghrib INTEGER NOT NULL DEFAULT 0,
      adjust_isha INTEGER NOT NULL DEFAULT 0,
      tenant_status TEXT NOT NULL DEFAULT 'SHADOW',
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      facebook_url TEXT,
      youtube_url TEXT,
      instagram_url TEXT,
      website_url TEXT,
      about_markdown TEXT,
      donation_links TEXT,
      show_donate_qr INTEGER NOT NULL DEFAULT 1,
      admin_email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_masjids_slug ON masjids(slug);

    CREATE TABLE IF NOT EXISTS masjid_themes (
      masjid_id TEXT PRIMARY KEY REFERENCES masjids(id) ON DELETE CASCADE,
      layout_preset TEXT NOT NULL DEFAULT 'modern_minimal',
      primary_color TEXT NOT NULL DEFAULT '#1e3a8a',
      accent_color TEXT NOT NULL DEFAULT '#10b981',
      font_heading TEXT NOT NULL DEFAULT 'Inter',
      font_body TEXT NOT NULL DEFAULT 'Roboto',
      style_system TEXT NOT NULL DEFAULT 'sakeenah',
      style_options TEXT NOT NULL DEFAULT '{}',
      time_format TEXT NOT NULL DEFAULT '24h',
      label_adhaan TEXT NOT NULL DEFAULT 'Adhaan',
      label_iqaamah TEXT NOT NULL DEFAULT 'Iqaamah',
      label_jumuah TEXT NOT NULL DEFAULT "Jumu'ah",
      label_speech TEXT NOT NULL DEFAULT 'Speech',
      label_sunrise TEXT NOT NULL DEFAULT 'Sunrise',
      label_fajr TEXT NOT NULL DEFAULT 'Fajr',
      label_dhuhr TEXT NOT NULL DEFAULT 'Dhuhr',
      label_asr TEXT NOT NULL DEFAULT 'Asr',
      label_maghrib TEXT NOT NULL DEFAULT 'Maghrib',
      label_isha TEXT NOT NULL DEFAULT 'Isha'
    );

    CREATE TABLE IF NOT EXISTS prayer_rules (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      prayer_name TEXT NOT NULL,
      execution_order INTEGER NOT NULL,
      rule_name TEXT NOT NULL,
      conditions_json TEXT NOT NULL,
      action_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_rules_lookup ON prayer_rules(masjid_id, prayer_name);
    CREATE INDEX IF NOT EXISTS idx_rules_order ON prayer_rules(masjid_id, execution_order);

    CREATE TABLE IF NOT EXISTS jumuah_sessions (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      time TEXT NOT NULL,
      khateeb TEXT,
      location TEXT,
      speech_time TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_jumuah_masjid ON jumuah_sessions(masjid_id);

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      compiled_html TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      published_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(masjid_id, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_announcements_masjid ON announcements(masjid_id, status, published_at);
    CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(masjid_id, is_pinned);

    CREATE TABLE IF NOT EXISTS masjid_pages (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      compiled_html TEXT,
      raw_markdown TEXT NOT NULL,
      last_updated TEXT DEFAULT (datetime('now')),
      UNIQUE(masjid_id, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_pages_lookup ON masjid_pages(masjid_id, slug);

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      compiled_html TEXT,
      show_on_homepage INTEGER NOT NULL DEFAULT 0,
      show_on_info INTEGER NOT NULL DEFAULT 0,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(masjid_id, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_posts_masjid ON posts(masjid_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_posts_homepage ON posts(masjid_id, show_on_homepage);
    CREATE INDEX IF NOT EXISTS idx_posts_info ON posts(masjid_id, show_on_info);

    CREATE TABLE IF NOT EXISTS nav_items (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      kind TEXT NOT NULL,
      route_segment TEXT,
      page_slug TEXT,
      external_url TEXT,
      label TEXT NOT NULL,
      icon TEXT,
      is_highlighted INTEGER NOT NULL DEFAULT 0,
      show_on_desktop_header INTEGER NOT NULL DEFAULT 1,
      show_on_mobile_bottom INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_nav_items_masjid ON nav_items(masjid_id, sort_order);

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      whatsapp_phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_admins_masjid ON admins(masjid_id);

    CREATE TABLE IF NOT EXISTS custom_domains (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL UNIQUE REFERENCES masjids(id) ON DELETE CASCADE,
      domain TEXT NOT NULL UNIQUE,
      cf_hostname_id TEXT,
      ssl_status TEXT NOT NULL DEFAULT 'pending',
      verified_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config_branches (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      admin_id TEXT NOT NULL,
      branch_name TEXT NOT NULL DEFAULT 'main',
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_branches_state ON config_branches(masjid_id, status);

    CREATE TABLE IF NOT EXISTS config_mutations (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL REFERENCES config_branches(id) ON DELETE CASCADE,
      domain TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      sequence_order INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mutations_sequence ON config_mutations(branch_id, sequence_order);

    CREATE TABLE IF NOT EXISTS config_snapshots (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,
      full_state_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_chronology ON config_snapshots(masjid_id, created_at);

    CREATE TABLE IF NOT EXISTS masjid_assets (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      associated_domain TEXT NOT NULL,
      associated_id TEXT,
      r2_key TEXT NOT NULL UNIQUE,
      public_url TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_assets_routing ON masjid_assets(masjid_id, associated_domain);

    CREATE TABLE IF NOT EXISTS announcement_attachments (
      id TEXT PRIMARY KEY,
      announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL REFERENCES masjid_assets(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mkt_terms (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      length_months INTEGER NOT NULL,
      billing_months INTEGER,
      price_cents_1 INTEGER NOT NULL,
      price_cents_2 INTEGER NOT NULL,
      price_cents_3plus INTEGER NOT NULL,
      payment_refs_json TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mkt_terms_masjid ON mkt_terms(masjid_id);

    CREATE TABLE IF NOT EXISTS mkt_settings (
      masjid_id TEXT PRIMARY KEY REFERENCES masjids(id) ON DELETE CASCADE,
      active_term_id TEXT REFERENCES mkt_terms(id) ON DELETE SET NULL,
      enrollment_open INTEGER NOT NULL DEFAULT 0,
      status_message TEXT,
      program_info TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mkt_registrations (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      term_id TEXT NOT NULL REFERENCES mkt_terms(id),
      status TEXT NOT NULL DEFAULT 'payment_succeeded',
      payment_provider TEXT NOT NULL,
      payment_customer_id TEXT,
      payment_subscription_id TEXT,
      payment_session_id TEXT UNIQUE,
      monthly_amount_cents INTEGER NOT NULL,
      father_name TEXT,
      father_phone TEXT,
      father_email TEXT,
      mother_name TEXT,
      mother_phone TEXT,
      mother_email TEXT,
      address_line1 TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'GA',
      postal_code TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'US',
      children_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mkt_registrations_lookup ON mkt_registrations(masjid_id, term_id, status);
    CREATE INDEX IF NOT EXISTS idx_mkt_registrations_session ON mkt_registrations(payment_session_id);

    CREATE TABLE IF NOT EXISTS mkt_outbox (
      id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL REFERENCES mkt_registrations(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      scheduled_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mkt_outbox_poll ON mkt_outbox(status, scheduled_at);
  `);

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