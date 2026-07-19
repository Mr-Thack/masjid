# Project Blueprint: Multi-Tenant AI-Native Serverless SaaS Platform for Masaajid

**Comprehensive Context Preservation, System Specification, and Rollout Strategy**

---

## 1. Project Overview & Core Vision

This project is a multi-tenant, serverless Software-as-a-Service (SaaS) platform designed for Islamic community centers (*Masaajid*). It transforms fragmented, fragile, and high-maintenance legacy web setups (e.g., outdated WordPress or Weebly sites dependent on unsupported PHP libraries) into an ultra-reliable, zero-maintenance, edge-native infrastructure.

### The Core Problem

Most local mosques are managed by non-technical volunteers or elders who lack the time or skills to maintain complex content management systems. Consequently, their websites frequently crash, suffer from software drift, or present security vulnerabilities. Yet, these sites host mission-critical information for the community: **highly dynamic prayer timetables (*Azaan* and *Iqaamah* times)** that change daily based on astronomical calculations and local administrative rules. These timings must be broadcasted simultaneously to mobile users and physical, low-power smart TVs acting as display boards inside the main prayer hall.

### The Solution

A highly optimized SaaS architecture built entirely on Cloudflare's serverless edge network. Instead of forcing non-technical users to interact with a complex no-code visual backend, the platform introduces a **Zero-UI Agentic Ingestion Pipeline**. Admins update their schedules or announcements simply by emailing a plain-text message or a smartphone photo of a printed paper timetable. An AI agent handles the extraction, validation, and schema conversion, compiling the data instantly onto a global Content Delivery Network (CDN) with sub-millisecond response times and near $100\%$ availability ($5\text{-nines}$).

---

## 2. Academic & Systems Framing (CS 4365 Context)

To satisfy the requirements of Dr. Calton Pu’s enterprise computing curriculum, the platform is intentionally architected around fundamental distributed systems laws, focusing heavily on **Quality of Service (QoS) dimensions, data integrity, and strict decoupling**.

### Autonomous Learning & Technology Trend Analysis

The project embodies Dr. Pu's core philosophy of autonomous learning: analyzing architectural trends to leverage cutting-edge, emergent technology paradigms. By using serverless edge environments (Cloudflare Workers) and the **Model Context Protocol (MCP)** to connect LLMs to traditional operational layers (like email servers and file systems), the system replaces heavy, brittle server infrastructure with event-driven, sandboxed runtime environments.

### The Principle of Conservation of QoS

In distributed enterprise applications, you cannot scale functionality and speed indefinitely without paying an architectural budget price. This architecture enforces QoS conservation by dividing the application into separate zones based on **Data Change Velocity**:

* Long-tail, layout-heavy content changes very slowly but carries a high data footprint. This is shifted entirely to a **Write-Time Static Compiler**.
* Time-sensitive scheduling matrices change frequently but carry a microscopic footprint. This is isolated within a **Read-Heavy Deterministic Engine**.
By removing heavy client-side JavaScript hydration and database reads from runtime page loads, the public-facing endpoints achieve rock-solid stability and bounded latency under heavy traffic spikes.

### The Principle of Conservation of Money & Serializability

Financial transactions (such as *Maktab* student registrations or *Iftaar* seasonal dinner sponsorships) require absolute transactional safety. To eliminate complex state synchronization, data race conditions, and heavy legal liabilities, the platform enforces **PCI-DSS Scope Reduction**.
All payment card interactions are completely offloaded to Stripe-hosted Checkout frameworks. The system remains stateless during payment entry. Upon successful completion, Stripe fires an asynchronous, cryptographically signed HTTP webhook payload back to the edge application, which updates the relational state using atomic database transactions.

---

## 3. The Asymmetric Dual-Engine Architecture

The platform architecture completely avoids live runtime database lookups or client-side rendering for day-to-day web users. It runs on two distinct engines with opposite operational lifecycles.

### Engine 1: The Write-Time Static Content Compiler (CMS Engine)

* **Target Data:** Dynamic text blocks, announcements, informational sub-pages (About Us, School Portals).
* **Lifecycle:** Triggers exclusively when an administrator requests an edit.
* **Mechanism:** 1. The raw configuration layout is stored as a flat structured JSON object or raw markdown within Cloudflare D1 or R2 storage.
2. Upon edit submission, a background Worker spins up, pulls down a lightweight markdown compiler, and compiles the layout into static HTML strings.
3. **The Security Gate:** To protect the platform from malicious prompt injection or cross-site scripting (XSS), the compiled string is filtered through a strict sanitization boundary (`DOMPurify`). This strips out dangerous executable elements (`<script>`, `onload` handlers, unwhitelisted iframes).
4. The clean static layout is injected into the global CDN cache indefinitely. Users accessing the site pull raw web strings out of memory at the closest edge data center, incurring zero server execution or database query overhead.

### Engine 2: The Run-Time Scheduling Engine (The Iqaamah DSL)

* **Target Data:** Daily calculated *Azaan* (astronomical calculation) and *Iqaamah* (congregational congregation offsets) prayer matrices.
* **Lifecycle:** Automatically re-calculates at midnight local time or instantly upon an administrative rule override.
* **Mechanism:**
1. The database holds a series of sequential, declarative rules arrays for each mosque tenant (e.g., *Rule 1: If day is Friday, lock Dhuhr time to 1:30 PM; Rule 2: On all days, round up the calculated offset to the nearest 5-minute interval*).
2. The edge worker uses geographic coordinate variables to run localized solar/lunar algorithms, then executes the declarative rules array sequentially to output a highly specific 24-hour JSON time table.
3. This table is pushed straight to a fast Key-Value (KV) cache with a 24-hour Time-to-Live (TTL). Mobile applications, PWAs, and local TV streams query this pre-compiled static JSON array out of global memory.



---

## 4. The Go-To-Market & Deployment Lifecycle

To eliminate the "Cold Start" problem common to new SaaS platforms, the rollout strategy uses a two-stage deployment lifecycle. This enables frictionless client acquisition without manual boarding friction.

```
+-----------------------------------------------------------------------------------+
| STAGE 1: THE SHADOW PHASE                                                         |
|                                                                                   |
|  [Target Mosque Website] ──► (Automated Web Scraper) ──► [Cloudflare D1 Seeded]   |
|                                                                │                  |
|  [Public Global Users] ◄── (Pulls Statically Cached Shell) ◄───┘                  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ (Board Agrees & Registers via Outreach)
+-----------------------------------------------------------------------------------+
| STAGE 2: THE ACTIVE PHASE                                                         |
|                                                                                   |
|  [Mosque Uncle Admin] ──► (Emails Snapshot/Text) ──► [LLM Agent via MCP Server]   |
|                                                                │                  |
|  [Public Global TV/App] ◄── (24-Hour Calculated JSON Table) ◄──┘                  |
+-----------------------------------------------------------------------------------+

```

### Stage 1: The "Shadow" Infrastructure (Frictionless Pre-population)

* **The State Configuration:** New tenants are mapped inside the relational schema with a tracking state of `tenant_status = 'SHADOW'`.
* **Passive Ingestion (Scraping):** A localized backend script parses existing public mosque websites, scripts, or embedded widgets, extracting their current timetables and basic informational structures to seed the D1 database.
* **The Core Footprint:** The platform generates a beautiful, responsive mobile shell and a flat `/display` TV endpoint for every shadowed mosque, populated completely by the scraped data.
* **The Donation Passthrough:** Since the platform is not actively authenticated by the board yet, the "Donate" button maps to a flat string configuration containing their *existing* payment link (Mohid, PayPal, GoFundMe). It acts as a zero-liability outbound browser redirect.
* **Academic Baseline Metrics:** This phase serves as an empirical benchmark setup for Dr. Pu's milestones. Because the shadow site replicates the content of their live site, you can run automated network queries to collect comparative analytics, showing hard evidence of edge-native performance gains (e.g., comparing a 1500ms WordPress TTFB against a 15ms Cloudflare Edge TTFB).

### Stage 2: The "Active Migration" Infrastructure

* **The Activation Shift:** Once a mosque board accepts the free platform, their account shifts to `tenant_status = 'ACTIVE'`, unlocking programmatic ingestion capabilities.
* **The Zero-UI Ingestion Mechanics:** The non-technical administrator takes a photo of a printed paper timetable sheet or types a message and emails it directly to `updates@yourplatform.com`.
* **The Agentic Core (MCP Loop):** 1. An inbound email webhook router parses the sender's address, validates it against authenticated cryptographic administrative identifiers in D1, and delivers the attachment to a Cloudflare Workers AI instance running a lightweight, open-source model (e.g., Llama).
2. Utilizing the **Model Context Protocol (MCP)** linked to the email ingestion toolset, the LLM parses the image metadata or unstructured text, maps the elements onto the required JSON structural schema, and executes a database transaction to update the mosque’s rules or timetables.
3. **The Automated Verification Layer:** To protect the live display inside the prayer hall from AI hallucinations, a deterministic verification guard validates the output before committing the change. If the AI proposes an impossible schedule (e.g., setting *Isha* time prior to *Maghrib* time), the write is rejected, the CDN locks to its *last known good state*, and an automated error alert is emailed back to the user.
4. Upon a successful, validated write, the agent updates D1, flushes the global CDN cache, and automatically emails a confirmation message back to the uncle: *"Walaykum Assalam. Your prayer timings have been updated and are now live on your main hall display screen."*

### Stage 3: Automated Scaled Outreach

With Stage 1 and Stage 2 complete, an automated email outreach script targets a mass list of public mosque contact directories. Instead of pitching a theoretical SaaS, the email presents a fully functional asset: *"We have pre-built an ad-free, ultra-fast, zero-maintenance version of your portal running live at `yourplatform.com/your-masjid`. It requires no dashboards—you update it simply by emailing a snapshot of your monthly paper timetable. Reply if you want to point your vanity domain name here for free."*

---

## 5. Microservices & Deployment Topology

The entire system architecture lives inside a single **Unified Monorepo Workspace**, allowing shared types, database helpers, and validation utilities, while compiling separate features into isolated, lightweight V8 isolates on the Cloudflare edge network.

* **`masjid-api-core` (Cloudflare Workers / SvelteKit API Engine):** The main router handling endpoint orchestration, multi-tenant state resolution, webhook catchers, and scheduling logic.
* **`masjid-ui-tv` (Cloudflare Pages Route: `/display`):** A strictly unhydrated presentation file containing minimal, semantic, handwritten HTML and CSS. It includes a basic viewport client script: if a standard mobile device agent accesses this layout, a popup blocks interaction and redirects them to the consumer view. This ensures the endpoint functions on legacy, low-memory "potato-grade" smart TV browsers inside the prayer hall without memory leaks or crashes.
* **`masjid-ui-consumer` (Cloudflare Pages Dynamic Root: `/[masjid_slug]`):** The flagship responsive application for standard web users. It implements a Progressive Web App (PWA) framework. A registered service worker caches the core UI shell and the downloaded 24-hour JSON timetable locally. If a congregant steps into a mosque basement with zero signal reception, the page still renders instantly out of device memory.
* **`masjid-worker-push` (Cloudflare Workers + KV):** An out-of-band asynchronous processing queue. It stores browser cryptographic notification subscription arrays inside a flat KV map. When an announcement goes out, it runs delivery threads separately, preventing high-concurrency network bottlenecks from impacting the primary API or timing display loops.

---

## 6. Complete Relational Database Schema Specification (Cloudflare D1)

This clean D1 (SQLite-native) script outlines the multi-tenant logical partitioning paradigm. Every record ties back to a central `masjid_id`. Unstructured layouts are preserved securely inside native text columns parsed directly as JSON blocks within SvelteKit edge configurations.

```sql
-- Multi-Tenant System Architecture Schema Reference Specification
-- Target Platform: Cloudflare D1 (SQLite Serverless Runtime)

DROP TABLE IF EXISTS mkt_registrations;
DROP TABLE IF EXISTS masjid_pages;
DROP TABLE IF EXISTS prayer_rules;
DROP TABLE IF EXISTS masjid_themes;
DROP TABLE IF EXISTS masjids;

-- 1. Master Tenant Profiles
CREATE TABLE masjids (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    calculation_method INT NOT NULL DEFAULT 2,          -- Default: ISNA / Standard Math
    tenant_status TEXT NOT NULL DEFAULT 'SHADOW',       -- Enumerated: 'SHADOW' or 'ACTIVE'
    external_donation_url TEXT,                        -- Direct outbound passthrough link
    admin_email TEXT,                                  -- Validated administrative sender target
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Design Tokens for Tenant Visual Identity & Differentiation
CREATE TABLE masjid_themes (
    masjid_id TEXT PRIMARY KEY,
    layout_preset TEXT NOT NULL DEFAULT 'modern_minimal', -- Maps to 3-5 pre-built Svelte shells
    primary_color TEXT NOT NULL DEFAULT '#1e3a8a',       -- Tailwind-mapped variable string
    accent_color TEXT NOT NULL DEFAULT '#10b981',        -- Tailwind-mapped variable string
    font_heading TEXT NOT NULL DEFAULT 'Inter',
    font_body TEXT NOT NULL DEFAULT 'Roboto',
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);

-- 3. Declarative Structural Rules Array (The Scheduling Engine DSL)
CREATE TABLE prayer_rules (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    prayer_name TEXT NOT NULL,          -- Strict checking: 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha'
    execution_order INT NOT NULL,       -- Ordered array chain parsed sequentially at runtime
    rule_name TEXT NOT NULL,
    condition_json TEXT NOT NULL,       -- Conditionals block: e.g., {"day_of_week": [5], "is_ramadan": false}
    action_json TEXT NOT NULL,          -- Functional outputs: e.g., {"type": "SET_FIXED_TIME", "value": "13:30"}
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);

-- 4. Edge-CMS Document Configuration Blocks (Write-Time Content Container)
CREATE TABLE masjid_pages (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    slug TEXT NOT NULL,                 -- Route endpoints: e.g., 'home', 'announcements', 'about'
    title TEXT NOT NULL,
    compiled_html TEXT,                 -- HTML string generated at write-time via DOMPurify sanitization
    raw_markdown TEXT NOT NULL,         -- Source string used for subsequent administrative AI editing
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE,
    UNIQUE(masjid_id, slug)
);

-- 5. Isolated Sub-Service Container: Maktab Student Registry (Stage 2 Integration)
CREATE TABLE mkt_registrations (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'PENDING',    -- Enumerated State: 'PENDING', 'PAID'
    stripe_session_id TEXT UNIQUE,                     -- Cryptographic token passed via webhook
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(masjid_id) REFERENCES masjids(id) ON DELETE CASCADE
);

-- Indexing optimization layers for high-speed multi-tenant partitioning
CREATE INDEX idx_masjids_slug ON masjids(slug);
CREATE INDEX idx_rules_lookup ON prayer_rules(masjid_id, prayer_name);
CREATE INDEX idx_pages_lookup ON masjid_pages(masjid_id, slug);

```

---

## 7. Crucial Real-World Pitfalls & Pitching Manual

### The Identity/Domain Routing Pitfall

* **The Reality:** Real mosques will not tolerate standard sub-folder routing formats (`yourplatform.com/local-masjid`). They require independent vanity domain handling (`localmasjid.org`).
* **The Mitigation Strategy:** Implement **Cloudflare for SaaS (Custom Hostnames)** within the core infrastructure configuration. The core server handles inbound connections programmatically. When a mosque transitions to an active layout, the system creates a custom hostname endpoint via Cloudflare's background configuration API, provisioning dedicated, automated SSL allocations as soon as the client links a CNAME tag at their domain registrar.

### The Third-Party Embedded App Trap

* **The Reality:** While a strict static HTML compiler sanitizes code blocks through `DOMPurify` to maintain high levels of system safety, mosques depend heavily on external iframe injection hooks (e.g., interactive donation frames from Mohid or Masjidal, streaming widgets from YouTube or Facebook for Friday sermons). If the compiler strips these targets blindly, the platform will be unusable for active admins.
* **The Mitigation Strategy:** Build a structured `Widget Embed` node component explicitly into the backend page primitive library. Rather than allowing raw, open script text boxes, provide an administrative option that takes *only* the specific verification identity key or source URL from the user. The edge engine validates this source string against an explicitly locked, system-wide destination whitelist (`*.mohid.co`, `*.youtube.com`), appending secure sandbox properties (`sandbox="allow-scripts allow-same-origin"`) before spitting it out to the client.

### Visual Differentiation Strategy

* **The Reality:** Mosque boards will drop a shared template setup if their public face looks completely identical to every neighboring community center.
* **The Mitigation Strategy:** Leverage **Tailwind CSS variables linked to database design tokens**. The hand-built core Svelte layouts pull down the flat design vectors (`primary_color`, `font_heading`) from the database row at the edge. Svelte maps these directly into the root HTML frame as custom properties. Tailwind's compilation class layer converts these tokens dynamically at runtime. Changing just three hex strings inside a flat row switches the complete color scheme, brand identities, layout alignment, and presentation typography instantly. This gives every client an explicitly isolated, custom appearance without adding compile-time management or layout code variations to your monorepo workspace.
