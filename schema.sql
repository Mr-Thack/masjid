-- ============================================================
-- Masjid Platform: Complete D1 Schema (SQLite-native)
-- ============================================================

-- ============================================================
-- Table 1: Master Tenant Profiles
-- ============================================================
CREATE TABLE masjids (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Chicago',
    calculation_method INT NOT NULL DEFAULT 2,      -- 2=ISNA, 3=MWL, 4=Umm al-Qura, 5=Egyptian, 6=Tehran, 7=Karachi, 8-13=see method-map.ts
    fajr_angle REAL,                                -- Custom Fajr twilight angle override (null = use preset)
    isha_angle REAL,                                -- Custom Isha twilight angle override (null = use preset)
    asr_madhab TEXT NOT NULL DEFAULT 'shafi',         -- 'shafi' | 'hanafi'
    high_latitude_rule TEXT NOT NULL DEFAULT 'seventh_of_night',  -- 'seventh_of_night' | 'middle_of_night' | 'twilight_angle' | 'none'
    show_dual_asr INTEGER NOT NULL DEFAULT 0,            -- 0=false, 1=true (display both Shafi + Hanafi Asr)
    adjust_fajr INTEGER NOT NULL DEFAULT 0,             -- manual minute offset for Fajr adhaan
    adjust_sunrise INTEGER NOT NULL DEFAULT 0,          -- manual minute offset for Sunrise display
    adjust_dhuhr INTEGER NOT NULL DEFAULT 0,            -- manual minute offset for Dhuhr adhaan
    adjust_asr INTEGER NOT NULL DEFAULT 0,              -- manual minute offset for Asr adhaan
    adjust_maghrib INTEGER NOT NULL DEFAULT 0,          -- manual minute offset for Maghrib adhaan
    adjust_isha INTEGER NOT NULL DEFAULT 0,             -- manual minute offset for Isha adhaan
    tenant_status TEXT NOT NULL DEFAULT 'SHADOW',    -- 'SHADOW' | 'ACTIVE'

    -- Contact & location (public-facing)
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    contact_phone TEXT,
    contact_email TEXT,                             -- Public, distinct from admin_email

    -- Social links
    facebook_url TEXT,
    youtube_url TEXT,
    instagram_url TEXT,
    website_url TEXT,

    -- Donation & admin
    about_markdown TEXT,                            -- About Us / history / story markdown content
    donation_links TEXT,                            -- JSON array of {label, url} for multiple donation links
    admin_email TEXT,                               -- Authenticated identity for email-based ingestion

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    show_donate_qr INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_masjids_slug ON masjids(slug);


-- ============================================================
-- Table 2: Design Tokens for Visual Identity
-- ============================================================
CREATE TABLE masjid_themes (
    masjid_id TEXT PRIMARY KEY,

    layout_preset TEXT NOT NULL DEFAULT 'modern_minimal',
    primary_color TEXT NOT NULL DEFAULT '#1e3a8a',
    accent_color TEXT NOT NULL DEFAULT '#10b981',
    font_heading TEXT NOT NULL DEFAULT 'Inter',
    font_body TEXT NOT NULL DEFAULT 'Roboto',

    -- Style system: 'sakeenah' (minimal) | 'mishkaat' (flagship)
    style_system TEXT NOT NULL DEFAULT 'sakeenah',
    -- JSON theme options interpreted per style system (metal, motif, arch, ...)
    style_options TEXT NOT NULL DEFAULT '{}',

    -- Display settings (per-masjid customization)
    time_format TEXT NOT NULL DEFAULT '24h',          -- '12h' | '24h'
    label_adhaan TEXT NOT NULL DEFAULT 'Adhaan',
    label_iqaamah TEXT NOT NULL DEFAULT 'Iqaamah',
    label_jumuah TEXT NOT NULL DEFAULT "Jumu'ah",
    label_speech TEXT NOT NULL DEFAULT 'Speech',
    label_sunrise TEXT NOT NULL DEFAULT 'Sunrise',
    label_fajr TEXT NOT NULL DEFAULT 'Fajr',
    label_dhuhr TEXT NOT NULL DEFAULT 'Dhuhr',
    label_asr TEXT NOT NULL DEFAULT 'Asr',
    label_maghrib TEXT NOT NULL DEFAULT 'Maghrib',
    label_isha TEXT NOT NULL DEFAULT 'Isha',

    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);


-- ============================================================
-- Table 3: Prayer Rules Engine (Iqaamah DSL)
-- ============================================================
CREATE TABLE prayer_rules (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    prayer_name TEXT NOT NULL,          -- 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
    execution_order INT NOT NULL,
    rule_name TEXT NOT NULL,            -- Human-readable label

    -- conditions_json: JSON array of condition objects, ALL must match (AND logic)
    --   [{"type":"always"}, {"type":"day_of_week","days":[5]}, {"type":"hijri_month","months":[9]}]
    conditions_json TEXT NOT NULL,

    -- action_json: single action object applied when all conditions match
    --   {"type":"add_minutes","minutes":15}
    --   {"type":"set_fixed_time","time":"13:30"}
    --   {"type":"round_up","increment":5}
    --   {"type":"round_down","increment":5}
    --   {"type":"round_nearest","increment":5}
    action_json TEXT NOT NULL,

    -- 0=disabled, 1=enabled. Rules with enabled=0 are skipped during computation.
    enabled INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);
CREATE INDEX idx_rules_lookup ON prayer_rules(masjid_id, prayer_name);
CREATE INDEX idx_rules_order ON prayer_rules(masjid_id, execution_order);


-- ============================================================
-- Table 4: Jumu'ah (Friday) Sessions
-- ============================================================
CREATE TABLE jumuah_sessions (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    label TEXT NOT NULL,
    time TEXT NOT NULL,                 -- "13:30" — fixed, not calculated
    khateeb TEXT,
    location TEXT,                      -- "Main Hall" / "Gymnasium Overflow"
    speech_time TEXT,                   -- Khutbah/speech start time (before iqaamah)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);
CREATE INDEX idx_jumuah_masjid ON jumuah_sessions(masjid_id);


-- ============================================================
-- Table 5: Announcements (blog feed + homepage hero)
-- ============================================================
CREATE TABLE announcements (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    compiled_html TEXT,                 -- Pre-compiled safe HTML (DOMPurify)
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'published',   -- 'draft' | 'published' | 'archived'
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE,
    UNIQUE(masjid_id, slug)
);
CREATE INDEX idx_announcements_masjid ON announcements(masjid_id, status, published_at);
CREATE INDEX idx_announcements_pinned ON announcements(masjid_id, is_pinned) WHERE is_pinned = TRUE;


-- ============================================================
-- Table 6: Content (Unified Posts & Pages)
-- ============================================================
CREATE TABLE content (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    compiled_html TEXT,
    content_type TEXT NOT NULL DEFAULT 'post',  -- 'post' | 'page'
    show_on_homepage INTEGER NOT NULL DEFAULT 0,
    show_on_info INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(masjid_id, slug)
);
CREATE INDEX idx_content_masjid_type ON content(masjid_id, content_type);
CREATE INDEX idx_content_homepage ON content(masjid_id) WHERE show_on_homepage = 1 AND content_type = 'post' AND is_hidden = 0;
CREATE INDEX idx_content_info ON content(masjid_id) WHERE show_on_info = 1 AND content_type = 'post' AND is_hidden = 0;


-- ============================================================
-- Table 7: Maktab Program (managed by workers/maktab)
-- ============================================================
CREATE TABLE mkt_terms (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_mkt_terms_masjid ON mkt_terms(masjid_id);

CREATE TABLE mkt_settings (
    masjid_id TEXT PRIMARY KEY REFERENCES masjids(id) ON DELETE CASCADE,
    active_term_id TEXT REFERENCES mkt_terms(id) ON DELETE SET NULL,
    enrollment_open INTEGER NOT NULL DEFAULT 0,
    status_message TEXT,
    assistance_code TEXT,
    program_info TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mkt_registrations (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    term_id TEXT NOT NULL REFERENCES mkt_terms(id),
    status TEXT NOT NULL DEFAULT 'checkout_created',
    payment_provider TEXT NOT NULL,                     -- 'stripe' | 'square'
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_mkt_registrations_lookup ON mkt_registrations(masjid_id, term_id, status);
CREATE INDEX idx_mkt_registrations_session ON mkt_registrations(payment_session_id);

CREATE TABLE mkt_outbox (
    id TEXT PRIMARY KEY,
    registration_id TEXT NOT NULL REFERENCES mkt_registrations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                                 -- 'parent_confirmation' | 'admin_notification'
    status TEXT NOT NULL DEFAULT 'pending',             -- 'pending' | 'sent' | 'failed'
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_mkt_outbox_poll ON mkt_outbox(status, scheduled_at);


-- ============================================================
-- Table 8: Admin Authentication
-- ============================================================
CREATE TABLE admins (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,        -- bcrypt hashed
    display_name TEXT,
    whatsapp_phone TEXT,                -- E.164 format, used for WhatsApp-based Zero-UI auth
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);
CREATE INDEX idx_admins_masjid ON admins(masjid_id);


-- ============================================================
-- Table 9: Custom Domains (Vanity URLs)
-- ============================================================
CREATE TABLE custom_domains (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL UNIQUE,
    cf_hostname_id TEXT,                            -- Cloudflare custom hostname ID
    ssl_status TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'active' | 'error'
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);


-- ============================================================
-- Table 10: Configuration Transaction Branches (Zero-UI)
-- ============================================================
CREATE TABLE config_branches (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    branch_name TEXT NOT NULL DEFAULT 'main',
    status TEXT NOT NULL DEFAULT 'OPEN',    -- 'OPEN' | 'MERGED' | 'ABANDONED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);
CREATE INDEX idx_branches_state ON config_branches(masjid_id, status);


-- ============================================================
-- Table 11: Granular Intent Mutations (Zero-UI Staging Ledger)
-- ============================================================
CREATE TABLE config_mutations (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    domain TEXT NOT NULL,                   -- 'THEME' | 'PROFILE' | 'PRAYER_RULES' | 'ANNOUNCEMENTS' | 'JUMUAH'
    action_type TEXT NOT NULL,              -- 'UPSERT' | 'DELETE' | 'PATCH'
    target_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(branch_id) REFERENCES config_branches(id) ON DELETE CASCADE
);
CREATE INDEX idx_mutations_sequence ON config_mutations(branch_id, sequence_order ASC);


-- ============================================================
-- Table 12: Point-In-Time Snapshots (Zero-UI Time-Travel)
-- ============================================================
CREATE TABLE config_snapshots (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    full_state_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);
CREATE INDEX idx_snapshots_chronology ON config_snapshots(masjid_id, created_at DESC);


-- ============================================================
-- Table 13: Multimodal Asset Map (Zero-UI Media)
-- ============================================================
CREATE TABLE masjid_assets (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    associated_domain TEXT NOT NULL,        -- 'ANNOUNCEMENTS' | 'TIMETABLE_PARSER' | 'THEME'
    associated_id TEXT,
    r2_key TEXT NOT NULL UNIQUE,
    public_url TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);
CREATE INDEX idx_assets_routing ON masjid_assets(masjid_id, associated_domain);


-- ============================================================
-- Table 14: Announcement-Attachment Join (Zero-UI)
-- ============================================================
CREATE TABLE announcement_attachments (
    id TEXT PRIMARY KEY,
    announcement_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    FOREIGN KEY(asset_id) REFERENCES masjid_assets(id) ON DELETE CASCADE
);

-- ============================================================
-- Table 15: Navigation Items (per-masjid navigation config)
-- ============================================================
CREATE TABLE nav_items (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    kind TEXT NOT NULL,                     -- 'route' | 'page' | 'link'
    route_segment TEXT,                     -- built-in route (e.g., 'prayer', 'news')
    page_slug TEXT,                         -- content slug where content_type='page' (when kind='page')
    external_url TEXT,                      -- external link URL (when kind='link')
    label TEXT NOT NULL,
    icon TEXT,                              -- lucide icon name
    is_highlighted INTEGER NOT NULL DEFAULT 0,
    show_on_desktop_header INTEGER NOT NULL DEFAULT 1,
    show_on_mobile_bottom INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_nav_items_masjid ON nav_items(masjid_id, sort_order);

-- ============================================================
-- Table 16: Per-Masjid Integration Keys (Square, Brevo, etc.)
-- ============================================================
CREATE TABLE masjid_integrations (
    masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,         -- 'square' | 'brevo'
    key_name TEXT NOT NULL,         -- 'access_token' | 'app_id' | 'location_id' | 'api_key' | 'sender_email' | 'sender_name'
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (masjid_id, provider, key_name)
);