import { describe, it, expect, vi, beforeAll } from 'vitest';
import { getDb } from '$lib/server/db';
import { masjids, masjidThemes, admins, mktTerms, mktSettings, mktRegistrations } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { GET as getMaktabInfo } from '../../routes/api/v1/masjids/[slug]/maktab/+server';
import { POST as postEnrollment } from '../../routes/api/v1/masjids/[slug]/maktab/enroll/+server';
import { GET as getSettings, PUT as putSettings } from '../../routes/api/v1/admin/masjids/[id]/maktab/settings/+server';
import { GET as getTerms, POST as postTerms } from '../../routes/api/v1/admin/masjids/[id]/maktab/terms/+server';
import { POST as activateTerm } from '../../routes/api/v1/admin/masjids/[id]/maktab/terms/[termId]/activate/+server';
import { GET as getRegistrations } from '../../routes/api/v1/admin/masjids/[id]/maktab/registrations/+server';

let db: ReturnType<typeof getDb>;

function createRequest(method: string, path: string, body?: unknown, headers?: Record<string, string>): Request {
  return new Request(new URL(path, 'http://localhost').toString(), {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function adminLocals(masjidId: string) {
  return {
    admin: {
      sub: 'admin-test',
      masjid_id: masjidId,
      email: 'admin@example.com',
      display_name: 'Test Admin',
    },
  };
}

async function seedMasjid(slug: string) {
  const id = `masjid-${slug}`;
  await db.insert(masjids).values({
    id,
    slug,
    name: 'Test Masjid',
    latitude: 33.9,
    longitude: -84.6,
    timezone: 'America/New_York',
  });
  await db.insert(masjidThemes).values({ masjidId: id });
  await db.insert(admins).values({
    id: `admin-${slug}`,
    masjidId: id,
    email: `admin-${slug}@example.com`,
    passwordHash: 'unused',
  });
  return id;
}

function squareMockFetch() {
  return vi.fn().mockImplementation(async (url: string, _init: any) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/catalog/object')) {
      return new Response(
        JSON.stringify({
          catalog_object: {
            id: 'plan_1',
            subscription_plan_data: {
              subscription_plan_variations: [
                { id: 'var_a', subscription_plan_variation_data: { name: '1 Student(s)' } },
                { id: 'var_b', subscription_plan_variation_data: { name: '2 Student(s)' } },
                { id: 'var_c', subscription_plan_variation_data: { name: '3 Student(s)' } },
              ],
            },
          },
        }),
        { status: 200 },
      );
    }
    if (path.endsWith('/customers')) {
      return new Response(JSON.stringify({ customer: { id: 'cust_1' } }), { status: 200 });
    }
    if (path.endsWith('/cards')) {
      return new Response(JSON.stringify({ card: { id: 'card_1' } }), { status: 200 });
    }
    if (path.endsWith('/subscriptions')) {
      return new Response(JSON.stringify({ subscription: { id: 'sub_1', status: 'ACTIVE' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ errors: [{ message: 'unexpected Square request' }] }), { status: 400 });
  });
}

function squareEnv() {
  return {
    SQUARE_ACCESS_TOKEN: 'sq0at-test',
    SQUARE_APP_ID: 'sq0id-test',
    SQUARE_LOCATION_ID: 'LTEST',
    ENVIRONMENT: 'development',
  };
}

const ENROLL_PAYLOAD = {
  father: { name: 'Test Parent', phone: '+14155552671', email: 'parent@example.com' },
  address_line1: '123 Main St',
  city: 'Atlanta',
  postal_code: '30303',
  country: 'US',
  children: [{ name: 'Child One', dob: '2015-01-01', sex: 'male' }],
  source_id: 'cnon:card_token',
  card_holder_name: 'Test Parent',
};

beforeAll(() => {
  db = getDb();
});

// ─────────────────────────────────────────────────────────────────────────────────
// Public: GET /masjids/:slug/maktab
// ─────────────────────────────────────────────────────────────────────────────────
describe('GET /masjids/:slug/maktab', () => {
  it('returns 404 for unknown masjid', async () => {
    const req = createRequest('GET', '/api/v1/masjids/unknown/maktab');
    const res = await getMaktabInfo({ params: { slug: 'unknown' }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(404);
  });

  it('returns closed state when no settings row exists', async () => {
    const slug = `mkt-closed-${Date.now()}`;
    await seedMasjid(slug);
    const req = createRequest('GET', `/api/v1/masjids/${slug}/maktab`);
    const res = await getMaktabInfo({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.open).toBe(false);
    expect(body.term).toBeNull();
    expect(body.square_config).toBeNull();
    expect(body.status_message).toBeNull();
  });

  it('returns open state with active term and prices', async () => {
    const slug = `mkt-open-${Date.now()}`;
    const id = await seedMasjid(slug);

    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId,
      masjidId: id,
      name: 'Fall 2026',
      lengthMonths: 4,
      priceCents1: 10000,
      priceCents2: 16000,
      priceCents3plus: 20000,
    });
    await db.insert(mktSettings).values({
      masjidId: id,
      activeTermId: termId,
      enrollmentOpen: true,
    });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/maktab`);
    const res = await getMaktabInfo({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.open).toBe(true);
    expect(body.term.name).toBe('Fall 2026');
    expect(body.term.prices['1']).toBe(10000);
    expect(body.term.prices['2']).toBe(16000);
    expect(body.term.prices['3plus']).toBe(20000);
  });

  it('returns open=false when settings exist but enrollment is off', async () => {
    const slug = `mkt-off-${Date.now()}`;
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id, name: 'Term', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
    });
    await db.insert(mktSettings).values({ masjidId: id, activeTermId: termId, enrollmentOpen: false });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/maktab`);
    const res = await getMaktabInfo({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.open).toBe(false);
  });

  it('returns open=false when term is deleted (cascade sets activeTermId null)', async () => {
    const slug = `mkt-cascade-${Date.now()}`;
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id, name: 'Gone', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
    });
    await db.insert(mktSettings).values({ masjidId: id, activeTermId: termId, enrollmentOpen: true });
    await db.delete(mktTerms).where(eq(mktTerms.id, termId));

    const req = createRequest('GET', `/api/v1/masjids/${slug}/maktab`);
    const res = await getMaktabInfo({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.open).toBe(false);
    expect(body.term).toBeNull();
  });

  it('returns square_config when env vars are present', async () => {
    const slug = `mkt-squarecfg-${Date.now()}`;
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id, name: 'Term', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
    });
    await db.insert(mktSettings).values({ masjidId: id, activeTermId: termId, enrollmentOpen: true });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/maktab`);
    const res = await getMaktabInfo({
      params: { slug }, request: req, url: new URL(req.url), locals: {},
      platform: { env: { SQUARE_ACCESS_TOKEN: 'x', SQUARE_APP_ID: 'app', SQUARE_LOCATION_ID: 'loc', ENVIRONMENT: 'production' } },
      cookies: {} as any, fetch: globalThis.fetch,
    } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.square_config.app_id).toBe('app');
    expect(body.square_config.location_id).toBe('loc');
    expect(body.square_config.environment).toBe('production');
  });

  it('returns square_config as sandbox when not production', async () => {
    const slug = `mkt-sq-sandbox-${Date.now()}`;
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id, name: 'Term', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
    });
    await db.insert(mktSettings).values({ masjidId: id, activeTermId: termId, enrollmentOpen: true });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/maktab`);
    const res = await getMaktabInfo({
      params: { slug }, request: req, url: new URL(req.url), locals: {},
      platform: { env: { SQUARE_ACCESS_TOKEN: 'x', SQUARE_APP_ID: 'app', SQUARE_LOCATION_ID: 'loc' } },
      cookies: {} as any, fetch: globalThis.fetch,
    } as any);
    const body = await res.json();
    expect(body.square_config.environment).toBe('sandbox');
  });

  it('returns status_message when set', async () => {
    const slug = `mkt-msg-${Date.now()}`;
    const id = await seedMasjid(slug);
    await db.insert(mktSettings).values({ masjidId: id, enrollmentOpen: false, statusMessage: 'Enrollment opens July 28' });

    const req = createRequest('GET', `/api/v1/masjids/${slug}/maktab`);
    const res = await getMaktabInfo({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    const body = await res.json();
    expect(body.status_message).toBe('Enrollment opens July 28');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// Public: POST /masjids/:slug/maktab/enroll
// ─────────────────────────────────────────────────────────────────────────────────
describe('POST /masjids/:slug/maktab/enroll', () => {
  async function enrollSetup(slug: string) {
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id, name: 'Term', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 9000, priceCents3plus: 12000,
      paymentRefsJson: JSON.stringify({ square: { plan_id: 'p', var_1: 'v1', var_2: 'v2', var_3plus: 'v3' } }),
      isActive: true,
    });
    await db.insert(mktSettings).values({ masjidId: id, activeTermId: termId, enrollmentOpen: true });
    return { id, termId };
  }

  it('full enrollment flow succeeds', async () => {
    const slug = `enroll-ok-${Date.now()}`;
    await enrollSetup(slug);

    const mockFetch = squareMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, ENROLL_PAYLOAD);
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('payment_succeeded');
      expect(body.subscription_id).toBe('sub_1');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns 404 for unknown masjid', async () => {
    const req = createRequest('POST', '/api/v1/masjids/fake-masjid/maktab/enroll', ENROLL_PAYLOAD);
    const res = await postEnrollment({ params: { slug: 'fake-masjid' }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(404);
  });

  it('rejects when enrollment is closed', async () => {
    const slug = `enroll-closed-${Date.now()}`;
    const id = await seedMasjid(slug);
    await db.insert(mktSettings).values({ masjidId: id, enrollmentOpen: false });

    const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, ENROLL_PAYLOAD);
    const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(409);
  });

  it('rejects when Square config is missing', async () => {
    const slug = `enroll-nosq-${Date.now()}`;
    await enrollSetup(slug);

    const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, ENROLL_PAYLOAD);
    const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(500);
  });

  it('rejects when term has no Square payment refs', async () => {
    const slug = `enroll-noref-${Date.now()}`;
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id, name: 'Broken Term', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
      paymentRefsJson: '{}',
      isActive: true,
    });
    await db.insert(mktSettings).values({ masjidId: id, activeTermId: termId, enrollmentOpen: true });

    const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, ENROLL_PAYLOAD);
    const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(500);
  });

  it('rejects invalid body (missing source_id)', async () => {
    const slug = `enroll-val-${Date.now()}`;
    await enrollSetup(slug);

    const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
      father: ENROLL_PAYLOAD.father,
      address_line1: '123 Main St',
      city: 'Atlanta',
      postal_code: '30303',
      children: [{ name: 'Child One', dob: '2015-01-01', sex: 'male' }],
    });
    const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(400);
  });

  it('rejects when no parent has complete info', async () => {
    const slug = `enroll-noparent-${Date.now()}`;
    await enrollSetup(slug);

    const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
      father: { name: 'Dad' },
      address_line1: '123 Main St',
      city: 'Atlanta',
      postal_code: '30303',
      children: [{ name: 'Child One', dob: '2015-01-01', sex: 'male' }],
      source_id: 'cnon:token',
      card_holder_name: 'Dad',
    });
    const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(400);
  });

  it('rejects empty children array', async () => {
    const slug = `enroll-nochild-${Date.now()}`;
    await enrollSetup(slug);

    const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
      ...ENROLL_PAYLOAD,
      children: [],
    });
    const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(400);
  });

  it('rejects invalid ZIP code', async () => {
    const slug = `enroll-badzip-${Date.now()}`;
    await enrollSetup(slug);

    const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
      ...ENROLL_PAYLOAD,
      postal_code: 'abcde',
    });
    const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(400);
  });

  it('handles Square API failure during subscription creation', async () => {
    const slug = `enroll-sqfail-${Date.now()}`;
    await enrollSetup(slug);

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/customers')) {
        return new Response(JSON.stringify({ errors: [{ detail: 'Invalid phone number' }] }), { status: 422 });
      }
      return new Response(JSON.stringify({ customer: { id: 'cust_1' } }), { status: 200 });
    });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, ENROLL_PAYLOAD);
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(500);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('succeeds even when Brevo email fails (non-blocking)', async () => {
    const slug = `enroll-emailfail-${Date.now()}`;
    await enrollSetup(slug);

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/customers')) {
        return new Response(JSON.stringify({ customer: { id: 'cust_e1' } }), { status: 200 });
      }
      if (path.endsWith('/cards')) {
        return new Response(JSON.stringify({ card: { id: 'card_e1' } }), { status: 200 });
      }
      if (path.endsWith('/subscriptions')) {
        return new Response(JSON.stringify({ subscription: { id: 'sub_e1', status: 'ACTIVE' } }), { status: 200 });
      }
      if (url.includes('brevo')) {
        return new Response('Server Error', { status: 500 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, ENROLL_PAYLOAD);
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: { ...squareEnv(), BREVO_API_KEY: 'brevo-key', SENDER_EMAIL: 'noreply@test.com', SENDER_NAME: 'Test' } }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('payment_succeeded');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('correctly selects 1-child pricing tier', async () => {
    const slug = `enroll-1-${Date.now()}`;
    await enrollSetup(slug);

    const mockFetch = squareMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
        ...ENROLL_PAYLOAD,
        children: [{ name: 'Kid', dob: '2015-01-01', sex: 'male' }],
      });
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('correctly selects 2-child pricing tier', async () => {
    const slug = `enroll-2-${Date.now()}`;
    await enrollSetup(slug);

    const mockFetch = squareMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
        ...ENROLL_PAYLOAD,
        children: [
          { name: 'Kid A', dob: '2015-01-01', sex: 'male' },
          { name: 'Kid B', dob: '2017-03-15', sex: 'female' },
        ],
      });
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('correctly selects 3+-child pricing tier', async () => {
    const slug = `enroll-3-${Date.now()}`;
    await enrollSetup(slug);

    const mockFetch = squareMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
        ...ENROLL_PAYLOAD,
        children: [
          { name: 'Kid A', dob: '2015-01-01', sex: 'male' },
          { name: 'Kid B', dob: '2017-03-15', sex: 'female' },
          { name: 'Kid C', dob: '2019-06-20', sex: 'male' },
          { name: 'Kid D', dob: '2021-11-10', sex: 'female' },
        ],
      });
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to mother when only mother info is provided', async () => {
    const slug = `enroll-mom-${Date.now()}`;
    await enrollSetup(slug);

    const mockFetch = squareMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
        mother: { name: 'Test Mom', phone: '+14155552672', email: 'mom@example.com' },
        address_line1: '123 Main St',
        city: 'Atlanta',
        postal_code: '30303',
        children: [{ name: 'Child One', dob: '2015-01-01', sex: 'female' }],
        source_id: 'cnon:card_token',
        card_holder_name: 'Test Mom',
      });
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts 9-digit ZIP code (ZIP+4)', async () => {
    const slug = `enroll-zip9-${Date.now()}`;
    await enrollSetup(slug);

    const mockFetch = squareMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
        ...ENROLL_PAYLOAD,
        postal_code: '30303-1234',
      });
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('persists registration with correct fields', async () => {
    const slug = `enroll-persist-${Date.now()}`;
    const { id: masjidId, termId } = await enrollSetup(slug);

    const mockFetch = squareMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/masjids/${slug}/maktab/enroll`, {
        father: { name: 'Ali Baba', phone: '+14155551001', email: 'ali@example.com' },
        mother: { name: 'Fatima Baba', phone: '+14155551002', email: 'fatima@example.com' },
        address_line1: '456 Oak Ave',
        city: 'Decatur',
        postal_code: '30030',
        children: [
          { name: 'Hasan Baba', dob: '2014-02-14', sex: 'male' },
          { name: 'Husayn Baba', dob: '2016-08-22', sex: 'male' },
        ],
        source_id: 'cnon:card_token',
        card_holder_name: 'Ali Baba',
      });
      const res = await postEnrollment({ params: { slug }, request: req, url: new URL(req.url), locals: {}, platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(200);
      const body = await res.json();

      const regs = await db.select().from(mktRegistrations).where(eq(mktRegistrations.masjidId, masjidId)).orderBy(desc(mktRegistrations.createdAt));
      expect(regs).toHaveLength(1);
      const reg = regs[0]!;
      expect(reg.fatherName).toBe('Ali Baba');
      expect(reg.motherName).toBe('Fatima Baba');
      expect(reg.fatherEmail).toBe('ali@example.com');
      expect(reg.motherEmail).toBe('fatima@example.com');
      expect(reg.city).toBe('Decatur');
      expect(reg.monthlyAmountCents).toBe(9000);
      expect(reg.termId).toBe(termId);
      expect(reg.status).toBe('payment_succeeded');
      expect(reg.paymentProvider).toBe('square');
      expect(reg.paymentCustomerId).toBe('cust_1');
      expect(reg.paymentSubscriptionId).toBe('sub_1');
      expect(reg.state).toBe('GA');
      expect(reg.country).toBe('US');

      const children = JSON.parse(reg.childrenJson);
      expect(children).toHaveLength(2);
      expect(children[0].name).toBe('Hasan Baba');
      expect(children[1].name).toBe('Husayn Baba');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// Admin: GET / PUT /admin/:id/maktab/settings
// ─────────────────────────────────────────────────────────────────────────────────
describe('Admin settings', () => {
  it('GET returns UNAUTHORIZED without admin', async () => {
    const req = createRequest('GET', '/api/v1/admin/masjids/fake/settings');
    const res = await getSettings({ params: { id: 'fake' }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(401);
  });

  it('GET returns FORBIDDEN for wrong masjid', async () => {
    const req = createRequest('GET', '/api/v1/admin/masjids/other-masjid/settings');
    const res = await getSettings({ params: { id: 'other-masjid' }, request: req, url: new URL(req.url), locals: adminLocals('my-masjid'), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(403);
  });

  it('GET returns empty settings for masjid with no row', async () => {
    const slug = `settings-empty-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/settings`);
    const res = await getSettings({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrollment_open).toBe(false);
    expect(body.active_term).toBeNull();
  });

  it('PUT returns UNAUTHORIZED without admin', async () => {
    const req = createRequest('PUT', '/api/v1/admin/masjids/fake/settings', { enrollment_open: true });
    const res = await putSettings({ params: { id: 'fake' }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(401);
  });

  it('PUT returns FORBIDDEN for wrong masjid', async () => {
    const req = createRequest('PUT', '/api/v1/admin/masjids/other/settings', {});
    const res = await putSettings({ params: { id: 'other' }, request: req, url: new URL(req.url), locals: adminLocals('mine'), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(403);
  });

  it('PUT returns NOT_FOUND for non-existent active_term_id', async () => {
    const slug = `settings-badterm-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/settings`, {
      active_term_id: 'does-not-exist',
      enrollment_open: true,
    });
    const res = await putSettings({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(404);
  });

  it('PUT rejects invalid body (boolean for active_term_id)', async () => {
    const slug = `settings-bad-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/settings`, {
      enrollment_open: 'yes',
    });
    const res = await putSettings({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(400);
  });

  it('PUT can set all fields', async () => {
    const slug = `settings-all-${Date.now()}`;
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id, name: 'Term X', lengthMonths: 6,
      priceCents1: 8000, priceCents2: 15000, priceCents3plus: 20000,
    });

    const req = createRequest('PUT', `/api/v1/admin/masjids/${id}/settings`, {
      active_term_id: termId,
      enrollment_open: true,
      status_message: 'Limited spots!',
    });
    const res = await putSettings({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrollment_open).toBe(true);
    expect(body.status_message).toBe('Limited spots!');
    expect(body.active_term.id).toBe(termId);
    expect(body.active_term.prices['1']).toBe(8000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// Admin: GET / POST /admin/:id/maktab/terms
// ─────────────────────────────────────────────────────────────────────────────────
describe('Admin terms', () => {
  it('GET returns UNAUTHORIZED without admin', async () => {
    const req = createRequest('GET', '/api/v1/admin/masjids/fake/terms');
    const res = await getTerms({ params: { id: 'fake' }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(401);
  });

  it('GET returns FORBIDDEN for wrong masjid', async () => {
    const req = createRequest('GET', '/api/v1/admin/masjids/other/terms');
    const res = await getTerms({ params: { id: 'other' }, request: req, url: new URL(req.url), locals: adminLocals('mine'), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(403);
  });

  it('GET returns empty list when no terms exist', async () => {
    const slug = `terms-none-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/terms`);
    const res = await getTerms({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.terms).toHaveLength(0);
  });

  it('POST returns UNAUTHORIZED without admin', async () => {
    const req = createRequest('POST', '/api/v1/admin/masjids/fake/terms', { name: 'T', length_months: 3, price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000 });
    const res = await postTerms({ params: { id: 'fake' }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(401);
  });

  it('POST returns FORBIDDEN for wrong masjid', async () => {
    const req = createRequest('POST', '/api/v1/admin/masjids/other/terms', { name: 'T', length_months: 3, price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000 });
    const res = await postTerms({ params: { id: 'other' }, request: req, url: new URL(req.url), locals: adminLocals('mine'), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(403);
  });

  it('POST creates term successfully', async () => {
    const slug = `terms-create-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms`, {
      name: 'Spring 2027',
      length_months: 5,
      price_cents_1: 12000,
      price_cents_2: 20000,
      price_cents_3plus: 25000,
    });
    const res = await postTerms({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.term.name).toBe('Spring 2027');
    expect(body.term.length_months).toBe(5);
    expect(body.term.prices['1']).toBe(12000);
    expect(body.term.prices['2']).toBe(20000);
    expect(body.term.prices['3plus']).toBe(25000);
  });

  it('POST creates term with Square plan when env is configured', async () => {
    const slug = `terms-sq-${Date.now()}`;
    const id = await seedMasjid(slug);

    const mockFetch = squareMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms`, {
        name: 'Summer 2027',
        length_months: 3,
        price_cents_1: 9000,
        price_cents_2: 15000,
        price_cents_3plus: 19000,
      });
      const res = await postTerms({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(201);

      const term = await db.select().from(mktTerms).where(eq(mktTerms.masjidId, id)).orderBy(desc(mktTerms.createdAt)).get();
      const refs = JSON.parse(term?.paymentRefsJson ?? '{}');
      expect(refs.square.plan_id).toBe('plan_1');
      expect(refs.square.var_1).toBe('var_a');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('POST returns error when Square plan creation fails', async () => {
    const slug = `terms-sqfail-${Date.now()}`;
    const id = await seedMasjid(slug);

    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ detail: 'Bad request' }] }), { status: 400 }));
    vi.stubGlobal('fetch', mockFetch);
    try {
      const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms`, {
        name: 'Fallback Term', length_months: 2,
        price_cents_1: 5000, price_cents_2: 8000, price_cents_3plus: 10000,
      });
      const res = await postTerms({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: squareEnv() }, cookies: {} as any, fetch: mockFetch } as any);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.message).toContain('Square API error');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('POST rejects invalid body (negative price)', async () => {
    const slug = `terms-neg-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms`, {
      name: 'Bad Term', length_months: 3,
      price_cents_1: -500, price_cents_2: 8000, price_cents_3plus: 10000,
    });
    const res = await postTerms({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(400);
  });

  it('POST rejects empty term name', async () => {
    const slug = `terms-empty-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms`, {
      name: '', length_months: 3,
      price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000,
    });
    const res = await postTerms({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(400);
  });

  it('POST rejects length_months > 12', async () => {
    const slug = `terms-long-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms`, {
      name: 'Long', length_months: 24,
      price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000,
    });
    const res = await postTerms({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(400);
  });

  it('GET returns terms ordered by created_at DESC', async () => {
    const slug = `terms-order-${Date.now()}`;
    const id = await seedMasjid(slug);

    await db.insert(mktTerms).values({
      id: crypto.randomUUID(), masjidId: id, name: 'First', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
      createdAt: '2026-01-01T00:00:00Z',
    });
    await db.insert(mktTerms).values({
      id: crypto.randomUUID(), masjidId: id, name: 'Second', lengthMonths: 4,
      priceCents1: 6000, priceCents2: 9000, priceCents3plus: 11000,
      createdAt: '2026-07-01T00:00:00Z',
    });

    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/terms`);
    const res = await getTerms({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    const body = await res.json();
    expect(body.terms).toHaveLength(2);
    expect(body.terms[0].name).toBe('Second');
    expect(body.terms[1].name).toBe('First');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// Admin: POST /admin/:id/maktab/terms/:termId/activate
// ─────────────────────────────────────────────────────────────────────────────────
describe('Admin activate term', () => {
  it('returns UNAUTHORIZED without admin', async () => {
    const req = createRequest('POST', '/api/v1/admin/masjids/fake/terms/t1/activate');
    const res = await activateTerm({ params: { id: 'fake', termId: 't1' }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(401);
  });

  it('returns FORBIDDEN for wrong masjid', async () => {
    const req = createRequest('POST', '/api/v1/admin/masjids/other/terms/t1/activate');
    const res = await activateTerm({ params: { id: 'other', termId: 't1' }, request: req, url: new URL(req.url), locals: adminLocals('mine'), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(403);
  });

  it('returns NOT_FOUND for non-existent term', async () => {
    const slug = `act-bad-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms/nonexistent/activate`);
    const res = await activateTerm({ params: { id, termId: 'nonexistent' }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(404);
  });

  it('returns NOT_FOUND for term belonging to different masjid', async () => {
    const slug1 = `act-other-${Date.now()}`;
    const slug2 = `act-main-${Date.now()}`;
    const id1 = await seedMasjid(slug1);
    const id2 = await seedMasjid(slug2);

    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id1, name: 'Term', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
      paymentRefsJson: JSON.stringify({ square: { plan_id: 'p1', var_1: 'v1', var_2: 'v2', var_3plus: 'v3' } }),
    });

    const req = createRequest('POST', `/api/v1/admin/masjids/${id2}/terms/${termId}/activate`);
    const res = await activateTerm({ params: { id: id2, termId }, request: req, url: new URL(req.url), locals: adminLocals(id2), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(404);
  });

  it('returns CONFLICT for term without Square refs', async () => {
    const slug = `act-nosq-${Date.now()}`;
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termId, masjidId: id, name: 'No SQ', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
      paymentRefsJson: '{}',
    });

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms/${termId}/activate`);
    const res = await activateTerm({ params: { id, termId }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(409);
  });

  it('activates term and deactivates previous active term', async () => {
    const slug = `act-switch-${Date.now()}`;
    const id = await seedMasjid(slug);

    const termA = crypto.randomUUID();
    const termB = crypto.randomUUID();
    await db.insert(mktTerms).values({
      id: termA, masjidId: id, name: 'Term A', lengthMonths: 3,
      priceCents1: 5000, priceCents2: 8000, priceCents3plus: 10000,
      paymentRefsJson: JSON.stringify({ square: { plan_id: 'pa', var_1: 'va1', var_2: 'va2', var_3plus: 'va3' } }),
      isActive: true,
    });
    await db.insert(mktTerms).values({
      id: termB, masjidId: id, name: 'Term B', lengthMonths: 6,
      priceCents1: 6000, priceCents2: 10000, priceCents3plus: 12000,
      paymentRefsJson: JSON.stringify({ square: { plan_id: 'pb', var_1: 'vb1', var_2: 'vb2', var_3plus: 'vb3' } }),
      isActive: false,
    });

    const req = createRequest('POST', `/api/v1/admin/masjids/${id}/terms/${termB}/activate`);
    const res = await activateTerm({ params: { id, termId: termB }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);

    const termADb = await db.select().from(mktTerms).where(eq(mktTerms.id, termA)).get();
    const termBDb = await db.select().from(mktTerms).where(eq(mktTerms.id, termB)).get();
    expect(termADb?.isActive).toBe(false);
    expect(termBDb?.isActive).toBe(true);

    const settings = await db.select().from(mktSettings).where(eq(mktSettings.masjidId, id)).get();
    expect(settings?.activeTermId).toBe(termB);
    expect(settings?.enrollmentOpen).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// Admin: GET /admin/:id/maktab/registrations
// ─────────────────────────────────────────────────────────────────────────────────
describe('Admin registrations', () => {
  it('returns UNAUTHORIZED without admin', async () => {
    const req = createRequest('GET', '/api/v1/admin/masjids/fake/registrations');
    const res = await getRegistrations({ params: { id: 'fake' }, request: req, url: new URL(req.url), locals: {}, platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(401);
  });

  it('returns FORBIDDEN for wrong masjid', async () => {
    const req = createRequest('GET', '/api/v1/admin/masjids/other/registrations');
    const res = await getRegistrations({ params: { id: 'other' }, request: req, url: new URL(req.url), locals: adminLocals('mine'), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(403);
  });

  it('returns empty array when no registrations', async () => {
    const slug = `reg-empty-${Date.now()}`;
    const id = await seedMasjid(slug);

    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/registrations`);
    const res = await getRegistrations({ params: { id }, request: req, url: new URL(req.url), locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registrations).toHaveLength(0);
  });

  it('filters by term_id', async () => {
    const slug = `reg-term-${Date.now()}`;
    const id = await seedMasjid(slug);

    const termA = crypto.randomUUID();
    const termB = crypto.randomUUID();
    await db.insert(mktTerms).values({ id: termA, masjidId: id, name: 'A', lengthMonths: 3, priceCents1: 1, priceCents2: 1, priceCents3plus: 1 });
    await db.insert(mktTerms).values({ id: termB, masjidId: id, name: 'B', lengthMonths: 3, priceCents1: 1, priceCents2: 1, priceCents3plus: 1 });

    await db.insert(mktRegistrations).values({
      id: crypto.randomUUID(), masjidId: id, termId: termA, status: 'payment_succeeded',
      paymentProvider: 'square', monthlyAmountCents: 5000,
      fatherName: 'Dad A', addressLine1: '1 Main', city: 'City', state: 'GA', postalCode: '30000', country: 'US', childrenJson: '[]',
    });
    await db.insert(mktRegistrations).values({
      id: crypto.randomUUID(), masjidId: id, termId: termB, status: 'payment_succeeded',
      paymentProvider: 'square', monthlyAmountCents: 6000,
      fatherName: 'Dad B', addressLine1: '2 Main', city: 'City', state: 'GA', postalCode: '30001', country: 'US', childrenJson: '[]',
    });

    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/registrations?term_id=${termA}`);
    const res = await getRegistrations({ params: { id }, url: new URL(`http://localhost/api/v1/admin/masjids/${id}/registrations?term_id=${termA}`), request: req, locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    const body = await res.json();
    expect(body.registrations).toHaveLength(1);
    expect(body.registrations[0].father_name).toBe('Dad A');
  });

  it('filters by status', async () => {
    const slug = `reg-stat-${Date.now()}`;
    const id = await seedMasjid(slug);
    const termId = crypto.randomUUID();
    await db.insert(mktTerms).values({ id: termId, masjidId: id, name: 'T', lengthMonths: 3, priceCents1: 1, priceCents2: 1, priceCents3plus: 1 });

    await db.insert(mktRegistrations).values({
      id: crypto.randomUUID(), masjidId: id, termId, status: 'payment_succeeded',
      paymentProvider: 'square', monthlyAmountCents: 5000,
      fatherName: 'Good', addressLine1: '1', city: 'C', state: 'GA', postalCode: '30000', country: 'US', childrenJson: '[]',
    });
    await db.insert(mktRegistrations).values({
      id: crypto.randomUUID(), masjidId: id, termId, status: 'failed',
      paymentProvider: 'square', monthlyAmountCents: 5000,
      fatherName: 'Bad', addressLine1: '2', city: 'C', state: 'GA', postalCode: '30001', country: 'US', childrenJson: '[]',
    });

    const req = createRequest('GET', `/api/v1/admin/masjids/${id}/registrations?status=failed`);
    const res = await getRegistrations({ params: { id }, url: new URL(`http://localhost/api/v1/admin/masjids/${id}/registrations?status=failed`), request: req, locals: adminLocals(id), platform: { env: {} }, cookies: {} as any, fetch: globalThis.fetch } as any);
    const body = await res.json();
    expect(body.registrations).toHaveLength(1);
    expect(body.registrations[0].father_name).toBe('Bad');
  });
});