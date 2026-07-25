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

  timeFormat: text('time_format').notNull().default('24h'),
  labelAdhaan: text('label_adhaan').notNull().default('Adhaan'),
  labelIqaamah: text('label_iqaamah').notNull().default('Iqaamah'),
  labelJumuah: text('label_jumuah').notNull().default("Jumu'ah"),
  labelSpeech: text('label_speech').notNull().default('Speech'),
  labelSunrise: text('label_sunrise').notNull().default('Sunrise'),
  labelFajr: text('label_fajr').notNull().default('Fajr'),
  labelDhuhr: text('label_dhuhr').notNull().default('Dhuhr'),
  labelAsr: text('label_asr').notNull().default('Asr'),
  labelMaghrib: text('label_maghrib').notNull().default('Maghrib'),
  labelIsha: text('label_isha').notNull().default('Isha'),
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
  location: text('location'),
  speechTime: text('speech_time'),
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

export const mktTerms = sqliteTable('mkt_terms', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  lengthMonths: integer('length_months').notNull(),
  billingMonths: integer('billing_months'),
  priceCents1: integer('price_cents_1').notNull(),
  priceCents2: integer('price_cents_2').notNull(),
  priceCents3plus: integer('price_cents_3plus').notNull(),
  paymentRefsJson: text('payment_refs_json').notNull().default('{}'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  masjidIdx: index('idx_mkt_terms_masjid').on(table.masjidId),
}));

export const mktSettings = sqliteTable('mkt_settings', {
  masjidId: text('masjid_id').primaryKey().references(() => masjids.id, { onDelete: 'cascade' }),
  activeTermId: text('active_term_id').references(() => mktTerms.id, { onDelete: 'set null' }),
  enrollmentOpen: integer('enrollment_open', { mode: 'boolean' }).notNull().default(false),
  statusMessage: text('status_message'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const mktRegistrations = sqliteTable('mkt_registrations', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  termId: text('term_id').notNull().references(() => mktTerms.id),
  status: text('status').notNull().default('payment_succeeded'),
  paymentProvider: text('payment_provider').notNull(),
  paymentCustomerId: text('payment_customer_id'),
  paymentSubscriptionId: text('payment_subscription_id'),
  paymentSessionId: text('payment_session_id').unique(),
  monthlyAmountCents: integer('monthly_amount_cents').notNull(),
  fatherName: text('father_name'),
  fatherPhone: text('father_phone'),
  fatherEmail: text('father_email'),
  motherName: text('mother_name'),
  motherPhone: text('mother_phone'),
  motherEmail: text('mother_email'),
  addressLine1: text('address_line1').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull().default('GA'),
  postalCode: text('postal_code').notNull(),
  country: text('country').notNull().default('US'),
  childrenJson: text('children_json').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  lookupIdx: index('idx_mkt_registrations_lookup').on(table.masjidId, table.termId, table.status),
  sessionIdx: index('idx_mkt_registrations_session').on(table.paymentSessionId),
}));

export const mktOutbox = sqliteTable('mkt_outbox', {
  id: text('id').primaryKey().$defaultFn(uuid),
  registrationId: text('registration_id').notNull().references(() => mktRegistrations.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  scheduledAt: text('scheduled_at').default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pollIdx: index('idx_mkt_outbox_poll').on(table.status, table.scheduledAt),
}));

export const admins = sqliteTable('admins', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  whatsappPhone: text('whatsapp_phone'),
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

export const configBranches = sqliteTable('config_branches', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  adminId: text('admin_id').notNull(),
  branchName: text('branch_name').notNull().default('main'),
  status: text('status').notNull().default('OPEN'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  stateIdx: index('idx_branches_state').on(table.masjidId, table.status),
}));

export const configMutations = sqliteTable('config_mutations', {
  id: text('id').primaryKey().$defaultFn(uuid),
  branchId: text('branch_id').notNull().references(() => configBranches.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull(),
  actionType: text('action_type').notNull(),
  targetKey: text('target_key').notNull(),
  payloadJson: text('payload_json').notNull(),
  sequenceOrder: integer('sequence_order').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  sequenceIdx: index('idx_mutations_sequence').on(table.branchId, table.sequenceOrder),
}));

export const configSnapshots = sqliteTable('config_snapshots', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  fullStateJson: text('full_state_json').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  chronologyIdx: index('idx_snapshots_chronology').on(table.masjidId, table.createdAt),
}));

export const masjidAssets = sqliteTable('masjid_assets', {
  id: text('id').primaryKey().$defaultFn(uuid),
  masjidId: text('masjid_id').notNull().references(() => masjids.id, { onDelete: 'cascade' }),
  associatedDomain: text('associated_domain').notNull(),
  associatedId: text('associated_id'),
  r2Key: text('r2_key').notNull().unique(),
  publicUrl: text('public_url').notNull().unique(),
  contentType: text('content_type').notNull(),
  fileSize: integer('file_size').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  routingIdx: index('idx_assets_routing').on(table.masjidId, table.associatedDomain),
}));

export const announcementAttachments = sqliteTable('announcement_attachments', {
  id: text('id').primaryKey().$defaultFn(uuid),
  announcementId: text('announcement_id').notNull().references(() => announcements.id, { onDelete: 'cascade' }),
  assetId: text('asset_id').notNull().references(() => masjidAssets.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});