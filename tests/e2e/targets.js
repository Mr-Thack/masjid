// ---------------------------------------------------------------------------
// E2E target resolution — ONE place that knows where tests point.
//
// E2E_ENV=local (default) | staging | prod
// Per-app overrides (win over everything):
//   E2E_CONSUMER_URL, E2E_TV_URL, E2E_ADMIN_URL, E2E_API_URL
// Admin credentials:
//   local  → seeded defaults (admin@masjid-alnoor.org / password123)
//   remote → ONLY from E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (CI secrets).
//            If unset, auth tests SKIP — never hardcode remote credentials.
//
// `writes`: may the suite mutate server state? local + staging only — the
// staging D1 (masjid-db-staging) is disposable and seeded from the local
// seed dump, so the seeded admin works there too. Prod is read-only.
// ---------------------------------------------------------------------------

const ENVS = {
  local: {
    consumer: 'http://localhost:5175',
    tv: 'http://localhost:5174',
    admin: 'http://localhost:5176',
    api: 'http://localhost:5173',
    remote: false,
    writes: true,
    expectedEnvironment: 'dev',
  },
  // Staging = FULL mirror: mapi-staging worker + masjid-db-staging D1 +
  // masjid-staging.pages.dev (VITE_API_URL points at mapi-staging).
  // See docs/integration-testing.md §2.1.
  staging: {
    consumer: 'https://masjid-staging.pages.dev',
    tv: 'https://masjid-staging.pages.dev',
    admin: 'https://masjid-staging.pages.dev',
    api: 'https://mapi-staging.mr-thack.workers.dev',
    remote: true,
    writes: true, // disposable staging DB — mutation cases run here
    expectedEnvironment: 'staging',
  },
  prod: {
    consumer: 'https://masjid-live.pages.dev',
    tv: 'https://masjid-live.pages.dev',
    admin: 'https://masjid-live.pages.dev',
    api: 'https://mapi.mr-thack.workers.dev',
    remote: true,
    writes: false,
    expectedEnvironment: 'production',
  },
};

export function targets() {
  const env = process.env.E2E_ENV || 'local';
  const base = ENVS[env];
  if (!base) throw new Error(`Unknown E2E_ENV "${env}" — expected local|staging|prod`);

  const cfg = {
    env,
    consumer: process.env.E2E_CONSUMER_URL || base.consumer,
    tv: process.env.E2E_TV_URL || base.tv,
    admin: process.env.E2E_ADMIN_URL || base.admin,
    api: process.env.E2E_API_URL || base.api,
    remote: base.remote,
    writes: base.writes,
    expectedEnvironment: base.expectedEnvironment,
    adminEmail: undefined,
    adminPassword: undefined,
  };

  if (env === 'prod') {
    // Prod: credentials ONLY from env (CI secrets); unset → auth tests skip.
    cfg.adminEmail = process.env.E2E_ADMIN_EMAIL;
    cfg.adminPassword = process.env.E2E_ADMIN_PASSWORD;
  } else {
    // Local + staging: the staging D1 is seeded from the local seed dump, so
    // the seeded admin works in both. Env vars still win if provided.
    cfg.adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@masjid-alnoor.org';
    cfg.adminPassword = process.env.E2E_ADMIN_PASSWORD || 'password123';
  }

  // Origins an SPA may legitimately send /api/* requests to. Locally the Vite
  // dev proxy makes API calls same-origin, so the page origin is allowed too.
  // Remotely the ONLY valid origin is the API worker — a request to the pages
  // origin means VITE_API_URL was missing at build time (failure class C1).
  const originOf = (u) => new URL(u).origin;
  cfg.allowedApiOrigins = cfg.remote
    ? [originOf(cfg.api)]
    : [originOf(cfg.api), originOf(cfg.consumer), originOf(cfg.tv), originOf(cfg.admin)];

  return cfg;
}

export const SLUG_A = 'masjid-al-noor'; // local seed: Mishkaat flagship
export const SLUG_B = 'masjid-al-jabal'; // local seed: Sakeenah, Indo-Pak labels
export const SLUG_C = 'masjid-test'; // local seed: E2E isolate, never tested by consumer suite
export const SLUG_UNKNOWN = 'definitely-not-a-masjid';
