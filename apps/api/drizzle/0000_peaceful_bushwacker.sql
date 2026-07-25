CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`whatsapp_phone` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
CREATE INDEX `idx_admins_masjid` ON `admins` (`masjid_id`);--> statement-breakpoint
CREATE TABLE `announcement_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `masjid_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`content_markdown` text NOT NULL,
	`compiled_html` text,
	`is_pinned` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_announcements_masjid` ON `announcements` (`masjid_id`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_announcements_pinned` ON `announcements` (`masjid_id`,`is_pinned`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_announcements_slug` ON `announcements` (`masjid_id`,`slug`);--> statement-breakpoint
CREATE TABLE `config_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`admin_id` text NOT NULL,
	`branch_name` text DEFAULT 'main' NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_branches_state` ON `config_branches` (`masjid_id`,`status`);--> statement-breakpoint
CREATE TABLE `config_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`domain` text NOT NULL,
	`action_type` text NOT NULL,
	`target_key` text NOT NULL,
	`payload_json` text NOT NULL,
	`sequence_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`branch_id`) REFERENCES `config_branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mutations_sequence` ON `config_mutations` (`branch_id`,`sequence_order`);--> statement-breakpoint
CREATE TABLE `config_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`summary` text NOT NULL,
	`full_state_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_chronology` ON `config_snapshots` (`masjid_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`domain` text NOT NULL,
	`cf_hostname_id` text,
	`ssl_status` text DEFAULT 'pending' NOT NULL,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_domains_masjid_id_unique` ON `custom_domains` (`masjid_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_domains_domain_unique` ON `custom_domains` (`domain`);--> statement-breakpoint
CREATE TABLE `jumuah_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`label` text NOT NULL,
	`time` text NOT NULL,
	`khateeb` text,
	`location` text,
	`speech_time` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_jumuah_masjid` ON `jumuah_sessions` (`masjid_id`);--> statement-breakpoint
CREATE TABLE `masjid_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`associated_domain` text NOT NULL,
	`associated_id` text,
	`r2_key` text NOT NULL,
	`public_url` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `masjid_assets_r2_key_unique` ON `masjid_assets` (`r2_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `masjid_assets_public_url_unique` ON `masjid_assets` (`public_url`);--> statement-breakpoint
CREATE INDEX `idx_assets_routing` ON `masjid_assets` (`masjid_id`,`associated_domain`);--> statement-breakpoint
CREATE TABLE `masjid_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`compiled_html` text,
	`raw_markdown` text NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pages_lookup` ON `masjid_pages` (`masjid_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pages_slug` ON `masjid_pages` (`masjid_id`,`slug`);--> statement-breakpoint
CREATE TABLE `masjid_themes` (
	`masjid_id` text PRIMARY KEY NOT NULL,
	`layout_preset` text DEFAULT 'modern_minimal' NOT NULL,
	`primary_color` text DEFAULT '#1e3a8a' NOT NULL,
	`accent_color` text DEFAULT '#10b981' NOT NULL,
	`font_heading` text DEFAULT 'Inter' NOT NULL,
	`font_body` text DEFAULT 'Roboto' NOT NULL,
	`time_format` text DEFAULT '24h' NOT NULL,
	`label_adhaan` text DEFAULT 'Adhaan' NOT NULL,
	`label_iqaamah` text DEFAULT 'Iqaamah' NOT NULL,
	`label_jumuah` text DEFAULT 'Jumu''ah' NOT NULL,
	`label_speech` text DEFAULT 'Speech' NOT NULL,
	`label_sunrise` text DEFAULT 'Sunrise' NOT NULL,
	`label_fajr` text DEFAULT 'Fajr' NOT NULL,
	`label_dhuhr` text DEFAULT 'Dhuhr' NOT NULL,
	`label_asr` text DEFAULT 'Asr' NOT NULL,
	`label_maghrib` text DEFAULT 'Maghrib' NOT NULL,
	`label_isha` text DEFAULT 'Isha' NOT NULL,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `masjids` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`timezone` text DEFAULT 'America/Chicago' NOT NULL,
	`calculation_method` integer DEFAULT 2 NOT NULL,
	`tenant_status` text DEFAULT 'SHADOW' NOT NULL,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`country` text,
	`contact_phone` text,
	`contact_email` text,
	`facebook_url` text,
	`youtube_url` text,
	`instagram_url` text,
	`website_url` text,
	`external_donation_url` text,
	`admin_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `masjids_slug_unique` ON `masjids` (`slug`);--> statement-breakpoint
CREATE TABLE `mkt_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`scheduled_at` text DEFAULT CURRENT_TIMESTAMP,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`registration_id`) REFERENCES `mkt_registrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mkt_outbox_poll` ON `mkt_outbox` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `mkt_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`term_id` text NOT NULL,
	`status` text DEFAULT 'payment_succeeded' NOT NULL,
	`payment_provider` text NOT NULL,
	`payment_customer_id` text,
	`payment_subscription_id` text,
	`payment_session_id` text,
	`monthly_amount_cents` integer NOT NULL,
	`father_name` text,
	`father_phone` text,
	`father_email` text,
	`mother_name` text,
	`mother_phone` text,
	`mother_email` text,
	`address_line1` text NOT NULL,
	`city` text NOT NULL,
	`state` text DEFAULT 'GA' NOT NULL,
	`postal_code` text NOT NULL,
	`country` text DEFAULT 'US' NOT NULL,
	`children_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `mkt_terms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mkt_registrations_payment_session_id_unique` ON `mkt_registrations` (`payment_session_id`);--> statement-breakpoint
CREATE INDEX `idx_mkt_registrations_lookup` ON `mkt_registrations` (`masjid_id`,`term_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_mkt_registrations_session` ON `mkt_registrations` (`payment_session_id`);--> statement-breakpoint
CREATE TABLE `mkt_settings` (
	`masjid_id` text PRIMARY KEY NOT NULL,
	`active_term_id` text,
	`enrollment_open` integer DEFAULT false NOT NULL,
	`status_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_term_id`) REFERENCES `mkt_terms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `mkt_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`name` text NOT NULL,
	`length_months` integer NOT NULL,
	`price_cents_1` integer NOT NULL,
	`price_cents_2` integer NOT NULL,
	`price_cents_3plus` integer NOT NULL,
	`payment_refs_json` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mkt_terms_masjid` ON `mkt_terms` (`masjid_id`);--> statement-breakpoint
CREATE TABLE `prayer_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`masjid_id` text NOT NULL,
	`prayer_name` text NOT NULL,
	`execution_order` integer NOT NULL,
	`rule_name` text NOT NULL,
	`conditions_json` text NOT NULL,
	`action_json` text NOT NULL,
	FOREIGN KEY (`masjid_id`) REFERENCES `masjids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_rules_lookup` ON `prayer_rules` (`masjid_id`,`prayer_name`);--> statement-breakpoint
CREATE INDEX `idx_rules_order` ON `prayer_rules` (`masjid_id`,`execution_order`);