import { drizzle } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

const PROJECT_ROOT = typeof import.meta.dirname !== 'undefined'
  ? path.resolve(import.meta.dirname, '../../../../../..')
  : '/dummy';
const LOCAL_DB_PATH = path.resolve(PROJECT_ROOT, '.masjid/local.db');

let localDb: ReturnType<typeof drizzleSqlite> | null = null;

function getLocalDb() {
  if (localDb) return localDb;
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(LOCAL_DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  ensureTables(sqlite);
  localDb = drizzleSqlite(sqlite, { schema });
  return localDb;
}

function addColumnIfMissing(
  sqlite: Database.Database,
  table: string,
  column: string,
  def: string,
) {
  const existing = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (!existing.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}

function tableHasColumn(sqlite: Database.Database, table: string, column: string): boolean {
  const existing = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return existing.some((c) => c.name === column);
}

function migrateMktTables(sqlite: Database.Database) {
  // The old mkt_registrations stub had only a few columns. If it exists, drop the
  // whole Maktab schema so we can recreate the real tables.
  if (
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mkt_registrations'").get()
    && tableHasColumn(sqlite, 'mkt_registrations', 'student_name')
  ) {
    sqlite.exec(`
      DROP TABLE IF EXISTS mkt_outbox;
      DROP TABLE IF EXISTS mkt_registrations;
      DROP TABLE IF EXISTS mkt_settings;
      DROP TABLE IF EXISTS mkt_terms;
    `);
  }
}

function ensureTables(sqlite: Database.Database) {
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
      external_donation_url TEXT,
      admin_email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_masjids_slug ON masjids(slug);

    CREATE TABLE IF NOT EXISTS masjid_themes (
      masjid_id TEXT PRIMARY KEY REFERENCES masjids(id) ON DELETE CASCADE,
      style_system TEXT NOT NULL DEFAULT 'sakeenah',
      style_options TEXT NOT NULL DEFAULT '{}',
      layout_preset TEXT NOT NULL DEFAULT 'modern_minimal',
      primary_color TEXT NOT NULL DEFAULT '#1e3a8a',
      accent_color TEXT NOT NULL DEFAULT '#10b981',
      font_heading TEXT NOT NULL DEFAULT 'Inter',
      font_body TEXT NOT NULL DEFAULT 'Roboto',
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
      action_json TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS mkt_registrations (
      id TEXT PRIMARY KEY,
      masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
      student_name TEXT NOT NULL,
      parent_email TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      stripe_session_id TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

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

  migrateMktTables(sqlite);

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

  // Migrate existing local databases created before these columns existed.
  addColumnIfMissing(sqlite, 'masjid_themes', 'style_system', "TEXT NOT NULL DEFAULT 'sakeenah'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'style_options', "TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'time_format', "TEXT NOT NULL DEFAULT '24h'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_adhaan', "TEXT NOT NULL DEFAULT 'Adhaan'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_iqaamah', "TEXT NOT NULL DEFAULT 'Iqaamah'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_jumuah', "TEXT NOT NULL DEFAULT 'Jumu''ah'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_speech', "TEXT NOT NULL DEFAULT 'Speech'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_sunrise', "TEXT NOT NULL DEFAULT 'Sunrise'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_fajr', "TEXT NOT NULL DEFAULT 'Fajr'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_dhuhr', "TEXT NOT NULL DEFAULT 'Dhuhr'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_asr', "TEXT NOT NULL DEFAULT 'Asr'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_maghrib', "TEXT NOT NULL DEFAULT 'Maghrib'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_isha', "TEXT NOT NULL DEFAULT 'Isha'");
  addColumnIfMissing(sqlite, 'admins', 'whatsapp_phone', 'TEXT');
  addColumnIfMissing(sqlite, 'mkt_terms', 'billing_months', 'INTEGER');
  addColumnIfMissing(sqlite, 'mkt_settings', 'program_info', "TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing(sqlite, 'jumuah_sessions', 'speech_time', 'TEXT');
  addColumnIfMissing(sqlite, 'masjids', 'asr_madhab', "TEXT NOT NULL DEFAULT 'shafi'");
  addColumnIfMissing(sqlite, 'masjids', 'high_latitude_rule', "TEXT NOT NULL DEFAULT 'seventh_of_night'");
  addColumnIfMissing(sqlite, 'masjids', 'show_dual_asr', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'masjids', 'fajr_angle', 'REAL');
  addColumnIfMissing(sqlite, 'masjids', 'isha_angle', 'REAL');
  addColumnIfMissing(sqlite, 'masjids', 'adjust_fajr', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'masjids', 'adjust_sunrise', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'masjids', 'adjust_dhuhr', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'masjids', 'adjust_asr', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'masjids', 'adjust_maghrib', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'masjids', 'adjust_isha', 'INTEGER NOT NULL DEFAULT 0');
}

export function getDb(d1?: unknown): ReturnType<typeof drizzleSqlite> {
  // In local Node.js dev: always use our local SQLite, not the adapter's mock D1.
  const isWorker = typeof caches !== 'undefined' && typeof caches.default !== 'undefined';
  if (!isWorker && typeof process !== 'undefined') {
    return getLocalDb();
  }
  // In Cloudflare Workers: use the real D1 binding.
  if (d1) {
    ensureD1Columns(d1 as D1Database);
    return drizzle(d1 as D1Database, { schema }) as unknown as ReturnType<typeof drizzleSqlite>;
  }
  throw new Error('D1 database binding not available');
}

let d1Migrated = false;

const D1_COLUMN_MIGRATIONS: Array<[table: string, column: string, def: string]> = [
  ['masjid_themes', 'style_system', "TEXT NOT NULL DEFAULT 'sakeenah'"],
  ['masjid_themes', 'style_options', "TEXT NOT NULL DEFAULT '{}'"],
  ['masjid_themes', 'time_format', "TEXT NOT NULL DEFAULT '24h'"],
  ['masjid_themes', 'label_adhaan', "TEXT NOT NULL DEFAULT 'Adhaan'"],
  ['masjid_themes', 'label_iqaamah', "TEXT NOT NULL DEFAULT 'Iqaamah'"],
  ['masjid_themes', 'label_jumuah', "TEXT NOT NULL DEFAULT 'Jumu''ah'"],
  ['masjid_themes', 'label_speech', "TEXT NOT NULL DEFAULT 'Speech'"],
  ['masjid_themes', 'label_sunrise', "TEXT NOT NULL DEFAULT 'Sunrise'"],
  ['masjid_themes', 'label_fajr', "TEXT NOT NULL DEFAULT 'Fajr'"],
  ['masjid_themes', 'label_dhuhr', "TEXT NOT NULL DEFAULT 'Dhuhr'"],
  ['masjid_themes', 'label_asr', "TEXT NOT NULL DEFAULT 'Asr'"],
  ['masjid_themes', 'label_maghrib', "TEXT NOT NULL DEFAULT 'Maghrib'"],
  ['masjid_themes', 'label_isha', "TEXT NOT NULL DEFAULT 'Isha'"],
  ['admins', 'whatsapp_phone', 'TEXT'],
  ['mkt_terms', 'billing_months', 'INTEGER'],
  ['mkt_settings', 'program_info', "TEXT NOT NULL DEFAULT '{}'"],
  ['jumuah_sessions', 'speech_time', 'TEXT'],
  ['masjids', 'asr_madhab', "TEXT NOT NULL DEFAULT 'shafi'"],
];

function ensureD1Columns(d1db: D1Database) {
  if (d1Migrated) return;
  d1Migrated = true;

  for (const [table, column, def] of D1_COLUMN_MIGRATIONS) {
    try {
      const existing = d1db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      if (!existing.some((c) => c.name === column)) {
        d1db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
        console.log(`[migration] D1: added ${table}.${column}`);
      }
    } catch (e) {
      console.error(`[migration] D1: failed to add ${table}.${column}`, e instanceof Error ? e.message : e);
    }
  }
}

export type Db = ReturnType<typeof getDb>;