import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

function uuid() {
  return crypto.randomUUID();
}

export const masjids = sqliteTable('masjids', {
  id: text('id').primaryKey().$defaultFn(uuid),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  timezone: text('timezone').notNull().default('America/Chicago'),
  calculationMethod: integer('calculation_method').notNull().default(2),
  tenantStatus: text('tenant_status').notNull().default('SHADOW'),
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  facebookUrl: text('facebook_url'),
  youtubeUrl: text('youtube_url'),
  instagramUrl: text('instagram_url'),
  websiteUrl: text('website_url'),
  externalDonationUrl: text('external_donation_url'),
  adminEmail: text('admin_email'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const masjidThemes = sqliteTable('masjid_themes', {
  masjidId: text('masjid_id').primaryKey().references(() => masjids.id, { onDelete: 'cascade' }),
  layoutPreset: text('layout_preset').notNull().default('modern_minimal'),
  primaryColor: text('primary_color').notNull().default('#1e3a8a'),
  accentColor: text('accent_color').notNull().default('#10b981'),
  fontHeading: text('font_heading').notNull().default('Inter'),
  fontBody: text('font_body').notNull().default('Roboto'),
});

export const prayerRules = sqliteTable('prayer_rules', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  prayerName: text('prayer_name').notNull(),
  executionOrder: integer('execution_order').notNull(),
  ruleName: text('rule_name').notNull(),
  conditionsJson: text('conditions_json').notNull(),
  actionJson: text('action_json').notNull(),
}, (table) => ({
  lookupIdx: index('idx_rules_lookup').on(table.masjidId, table.prayerName),
  orderIdx: index('idx_rules_order').on(table.masjidId, table.executionOrder),
}));

export const jumuahSessions = sqliteTable('jumuah_sessions', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  time: text('time').notNull(),
  khateeb: text('khateeb'),
  language: text('language').default('en'),
  location: text('location'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (table) => ({
  masjidIdx: index('idx_jumuah_masjid').on(table.masjidId),
}));

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  compiledHtml: text('compiled_html'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('published'),
  publishedAt: text('published_at').default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  masjidIdx: index('idx_announcements_masjid').on(table.masjidId, table.status, table.publishedAt),
  pinnedIdx: index('idx_announcements_pinned').on(table.masjidId, table.isPinned),
  uniqueSlug: uniqueIndex('uq_announcements_slug').on(table.masjidId, table.slug),
}));

export const masjidPages = sqliteTable('masjid_pages', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  compiledHtml: text('compiled_html'),
  rawMarkdown: text('raw_markdown').notNull(),
  lastUpdated: text('last_updated').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  lookupIdx: index('idx_pages_lookup').on(table.masjidId, table.slug),
  uniqueSlug: uniqueIndex('uq_pages_slug').on(table.masjidId, table.slug),
}));

export const mktRegistrations = sqliteTable('mkt_registrations', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  studentName: text('student_name').notNull(),
  parentEmail: text('parent_email').notNull(),
  paymentStatus: text('payment_status').notNull().default('PENDING'),
  stripeSessionId: text('stripe_session_id').unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const admins = sqliteTable('admins', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  masjidIdx: index('idx_admins_masjid').on(table.masjidId),
}));

export const customDomains = sqliteTable('custom_domains', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().unique().references(() => masjids.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull().unique(),
  cfHostnameId: text('cf_hostname_id'),
  sslStatus: text('ssl_status').notNull().default('pending'),
  verifiedAt: text('verified_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});