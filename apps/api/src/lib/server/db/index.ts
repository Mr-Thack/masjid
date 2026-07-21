import { drizzle } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../../../../..');
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
      layout_preset TEXT NOT NULL DEFAULT 'modern_minimal',
      primary_color TEXT NOT NULL DEFAULT '#1e3a8a',
      accent_color TEXT NOT NULL DEFAULT '#10b981',
      font_heading TEXT NOT NULL DEFAULT 'Inter',
      font_body TEXT NOT NULL DEFAULT 'Roboto',
      time_format TEXT NOT NULL DEFAULT '24h',
      label_adhaan TEXT NOT NULL DEFAULT 'Adhaan',
      label_iqaamah TEXT NOT NULL DEFAULT 'Iqaamah',
      label_jumuah TEXT NOT NULL DEFAULT "Jumu'ah",
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

  // Migrate existing local databases created before these columns existed.
  addColumnIfMissing(sqlite, 'masjid_themes', 'time_format', "TEXT NOT NULL DEFAULT '24h'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_adhaan', "TEXT NOT NULL DEFAULT 'Adhaan'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_iqaamah', "TEXT NOT NULL DEFAULT 'Iqaamah'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_jumuah', "TEXT NOT NULL DEFAULT 'Jumu''ah'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_sunrise', "TEXT NOT NULL DEFAULT 'Sunrise'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_fajr', "TEXT NOT NULL DEFAULT 'Fajr'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_dhuhr', "TEXT NOT NULL DEFAULT 'Dhuhr'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_asr', "TEXT NOT NULL DEFAULT 'Asr'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_maghrib', "TEXT NOT NULL DEFAULT 'Maghrib'");
  addColumnIfMissing(sqlite, 'masjid_themes', 'label_isha', "TEXT NOT NULL DEFAULT 'Isha'");
  addColumnIfMissing(sqlite, 'admins', 'whatsapp_phone', 'TEXT');
}

export function getDb(d1?: unknown): ReturnType<typeof drizzleSqlite> {
  // In local Node.js dev, always use our local SQLite — ignore the adapter's mock D1.
  if (typeof process !== 'undefined') {
    return getLocalDb();
  }
  // In Cloudflare Workers: use the real D1 binding.
  if (d1) {
    return drizzle(d1 as D1Database, { schema }) as unknown as ReturnType<typeof drizzleSqlite>;
  }
  throw new Error('D1 database binding not available');
}

export type Db = ReturnType<typeof getDb>;