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
    calculation_method INT NOT NULL DEFAULT 2,      -- 2=ISNA, 3=MWL, 4=Umm al-Qura, 5=Egyptian
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
    external_donation_url TEXT,                     -- Direct outbound passthrough (Mohid, PayPal, etc.)
    admin_email TEXT,                               -- Authenticated identity for email-based ingestion

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    language TEXT DEFAULT 'en',
    location TEXT,                      -- "Main Hall" / "Gymnasium Overflow"
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
-- Table 6: Static Sub-Pages (CMS)
-- ============================================================
CREATE TABLE masjid_pages (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    slug TEXT NOT NULL,                 -- 'home', 'about', 'services', 'school'
    title TEXT NOT NULL,
    compiled_html TEXT,
    raw_markdown TEXT NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE,
    UNIQUE(masjid_id, slug)
);
CREATE INDEX idx_pages_lookup ON masjid_pages(masjid_id, slug);


-- ============================================================
-- Table 7: Maktab Student Registrations (Stage 2)
-- ============================================================
CREATE TABLE mkt_registrations (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'PENDING',     -- 'PENDING' | 'PAID'
    stripe_session_id TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);


-- ============================================================
-- Table 8: Admin Authentication
-- ============================================================
CREATE TABLE admins (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,        -- bcrypt hashed
    display_name TEXT,
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