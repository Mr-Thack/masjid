import { describe, it, expect, vi, afterEach } from 'vitest';
import { hasSquare, createSquareTermPlan, createSquareSubscription } from '../../lib/server/maktab/square';
import fs from 'node:fs';
import path from 'node:path';

const FULL_ENV = {
  SQUARE_ACCESS_TOKEN: 'sq0at-test',
  SQUARE_APP_ID: 'sq0id-test',
  SQUARE_LOCATION_ID: 'LTEST',
  ENVIRONMENT: 'development',
};

describe('hasSquare', () => {
  it('returns true when all three Square vars are present', () => {
    expect(hasSquare(FULL_ENV)).toBe(true);
  });

  it('returns false when SQUARE_ACCESS_TOKEN is missing', () => {
    expect(hasSquare({ SQUARE_APP_ID: 'x', SQUARE_LOCATION_ID: 'y' })).toBe(false);
  });

  it('returns false when SQUARE_APP_ID is missing', () => {
    expect(hasSquare({ SQUARE_ACCESS_TOKEN: 'x', SQUARE_LOCATION_ID: 'y' })).toBe(false);
  });

  it('returns false when SQUARE_LOCATION_ID is missing', () => {
    expect(hasSquare({ SQUARE_ACCESS_TOKEN: 'x', SQUARE_APP_ID: 'y' })).toBe(false);
  });

  it('returns false for empty env', () => {
    expect(hasSquare({})).toBe(false);
  });

  it('returns false when a var is empty string', () => {
    expect(hasSquare({ SQUARE_ACCESS_TOKEN: '', SQUARE_APP_ID: 'x', SQUARE_LOCATION_ID: 'y' })).toBe(false);
  });
});

function mockTermPlanResponse(overrides: Record<string, any> = {}) {
  return new Response(JSON.stringify({
    catalog_object: {
      id: 'PLAN_123',
      subscription_plan_data: {
        subscription_plan_variations: [
          { id: 'v1', subscription_plan_variation_data: { name: '1 Student(s)' } },
          { id: 'v2', subscription_plan_variation_data: { name: '2 Student(s)' } },
          { id: 'v3', subscription_plan_variation_data: { name: '3 Student(s)' } },
        ],
      },
      ...overrides,
    },
  }), { status: 200 });
}

describe('createSquareTermPlan', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when Square is not configured', async () => {
    const result = await createSquareTermPlan(
      { id: 't1', name: 'T', length_months: 3, price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000 },
      {},
    );
    expect(result).toBeNull();
  });

  it('creates a plan and returns structured refs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockTermPlanResponse()));

    const result = await createSquareTermPlan(
      { id: 't1', name: 'Fall 2026', length_months: 4, price_cents_1: 10000, price_cents_2: 16000, price_cents_3plus: 20000 },
      FULL_ENV,
    );
    expect(result).not.toBeNull();
    expect(result!.square.plan_id).toBe('PLAN_123');
    expect(result!.square.var_1).toBe('v1');
    expect(result!.square.var_2).toBe('v2');
    expect(result!.square.var_3plus).toBe('v3');
  });

  it('sorts variations numerically by name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        catalog_object: {
          id: 'PLAN_456',
          subscription_plan_data: {
            subscription_plan_variations: [
              { id: 'v3', subscription_plan_variation_data: { name: '3 Student(s)' } },
              { id: 'v1', subscription_plan_variation_data: { name: '1 Student(s)' } },
              { id: 'v2', subscription_plan_variation_data: { name: '2 Student(s)' } },
            ],
          },
        },
      }), { status: 200 }),
    ));

    const result = await createSquareTermPlan(
      { id: 't2', name: 'Spring', length_months: 3, price_cents_1: 5000, price_cents_2: 8000, price_cents_3plus: 10000 },
      FULL_ENV,
    );
    expect(result!.square.var_1).toBe('v1');
    expect(result!.square.var_2).toBe('v2');
    expect(result!.square.var_3plus).toBe('v3');
  });

  it('sends snake_case body to Square', async () => {
    let sentBody: any;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      sentBody = JSON.parse(opts.body);
      return new Response(JSON.stringify({
        catalog_object: {
          id: 'PLAN_SNAKE',
          subscription_plan_data: {
            subscription_plan_variations: [
              { id: 'v1', subscription_plan_variation_data: { name: '1 Student(s)' } },
              { id: 'v2', subscription_plan_variation_data: { name: '2 Student(s)' } },
              { id: 'v3', subscription_plan_variation_data: { name: '3 Student(s)' } },
            ],
          },
        },
      }), { status: 200 });
    }));

    await createSquareTermPlan(
      { id: 't7', name: 'Snake', length_months: 9, price_cents_1: 10000, price_cents_2: 16000, price_cents_3plus: 20000 },
      FULL_ENV,
    );

    expect(sentBody.idempotency_key).toBeDefined();
    expect(sentBody.object.type).toBe('SUBSCRIPTION_PLAN');
    const data = sentBody.object.subscription_plan_data;
    expect(data).toBeDefined();
    expect(data.subscription_plan_variations).toHaveLength(3);
    const phase = data.subscription_plan_variations[0].subscription_plan_variation_data.phases[0];
    expect(phase.pricing.type).toBe('STATIC');
    expect(phase.pricing.price_money.amount).toBe(10000);
  });

  it('throws when Square returns errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ detail: 'Invalid request' }] }), { status: 400 }),
    ));

    await expect(createSquareTermPlan(
      { id: 't3', name: 'Bad', length_months: 3, price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000 },
      FULL_ENV,
    )).rejects.toThrow('Square API error');
  });

  it('throws when Square returns fewer than 3 variations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        catalog_object: {
          id: 'PLAN_BAD',
          subscription_plan_data: {
            subscription_plan_variations: [
              { id: 'v1', subscription_plan_variation_data: { name: '1 Student(s)' } },
              { id: 'v2', subscription_plan_variation_data: { name: '2 Student(s)' } },
            ],
          },
        },
      }), { status: 200 }),
    ));

    await expect(createSquareTermPlan(
      { id: 't4', name: 'Broken', length_months: 3, price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000 },
      FULL_ENV,
    )).rejects.toThrow('did not return 3 variations');
  });

  it('uses sandbox URL in development', async () => {
    let calledUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      calledUrl = url;
      return mockTermPlanResponse();
    }));

    await createSquareTermPlan(
      { id: 't5', name: 'Dev', length_months: 3, price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000 },
      FULL_ENV,
    );
    expect(calledUrl).toContain('squareupsandbox.com');
  });

  it('uses production URL when ENVIRONMENT=production', async () => {
    let calledUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      calledUrl = url;
      return mockTermPlanResponse();
    }));

    await createSquareTermPlan(
      { id: 't6', name: 'Prod', length_months: 3, price_cents_1: 1000, price_cents_2: 2000, price_cents_3plus: 3000 },
      { ...FULL_ENV, ENVIRONMENT: 'production' },
    );
    expect(calledUrl).toContain('connect.squareup.com');
  });
});

describe('createSquareSubscription', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const refs = { plan_id: 'p1', var_1: 'v1', var_2: 'v2', var_3plus: 'v3' };

  const parentInput = {
    parent: { name: 'Test Parent', email: 'parent@test.com', phone: '+14155552671' },
    address: { line1: '123 Main St', city: 'Atlanta', state: 'GA', postal_code: '30303', country: 'US' },
    childrenCount: 1,
    sourceId: 'cnon:card_token',
    cardHolderName: 'Test Parent',
    refs,
  };

  it('throws when Square is not configured', async () => {
    await expect(createSquareSubscription(parentInput, {})).rejects.toThrow('Square is not configured');
  });

  it('creates customer, card, and subscription', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ customer: { id: 'cust_123' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ card: { id: 'card_456' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ subscription: { id: 'sub_789', status: 'ACTIVE' } }), { status: 200 }));

    vi.stubGlobal('fetch', mockFetch);

    const result = await createSquareSubscription(parentInput, FULL_ENV);
    expect(result.subscriptionId).toBe('sub_789');
    expect(result.customerId).toBe('cust_123');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('sends snake_case body to Square', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      bodies.push(JSON.parse(opts.body));
      if (bodies.length === 1) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (bodies.length === 2) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription(parentInput, FULL_ENV);

    expect(bodies[0].given_name).toBe('Test Parent');
    expect(bodies[0].email_address).toBe('parent@test.com');
    expect(bodies[1].source_id).toBe('cnon:card_token');
    expect(bodies[1].card.cardholder_name).toBe('Test Parent');
    expect(bodies[1].card.billing_address.address_line_1).toBe('123 Main St');
    expect(bodies[2].plan_variation_id).toBe('v1');
  });

  it('selects correct variation for 1 child', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      if (body.given_name) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (body.source_id) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription({ ...parentInput, childrenCount: 1 }, FULL_ENV);
    const calls = (globalThis.fetch as any).mock.calls;
    const subCall = JSON.parse(calls[2]?.[1]?.body ?? '{}');
    expect(subCall.plan_variation_id).toBe('v1');
  });

  it('selects correct variation for 2 children', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      if (body.given_name) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (body.source_id) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription({ ...parentInput, childrenCount: 2 }, FULL_ENV);
    const calls = (globalThis.fetch as any).mock.calls;
    const subCall = JSON.parse(calls[2]?.[1]?.body ?? '{}');
    expect(subCall.plan_variation_id).toBe('v2');
  });

  it('selects 3plus variation for 3 children', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      if (body.given_name) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (body.source_id) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription({ ...parentInput, childrenCount: 3 }, FULL_ENV);
    const calls = (globalThis.fetch as any).mock.calls;
    const subCall = JSON.parse(calls[2]?.[1]?.body ?? '{}');
    expect(subCall.plan_variation_id).toBe('v3');
  });

  it('selects 3plus variation for 5 children', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      if (body.given_name) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (body.source_id) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription({ ...parentInput, childrenCount: 5 }, FULL_ENV);
    const calls = (globalThis.fetch as any).mock.calls;
    const subCall = JSON.parse(calls[2]?.[1]?.body ?? '{}');
    expect(subCall.plan_variation_id).toBe('v3');
  });

  it('throws on Square customer creation failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ detail: 'Bad phone number' }] }), { status: 422 }),
    ));

    await expect(createSquareSubscription(parentInput, FULL_ENV)).rejects.toThrow('Square API error');
  });

  it('throws on Square card creation failure', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ detail: 'Invalid card' }] }), { status: 422 })),
    );

    await expect(createSquareSubscription(parentInput, FULL_ENV)).rejects.toThrow('Square API error');
  });
});

describe('Square sandbox integration', () => {
  function loadSandboxEnv(): Record<string, string> {
    const envPath = path.resolve(import.meta.dirname, '../../../../../.env.dev');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
    return env;
  }

  const sandboxEnv = loadSandboxEnv();
  const hasSquare = !!(sandboxEnv.SQUARE_ACCESS_TOKEN && sandboxEnv.SQUARE_APP_ID && sandboxEnv.SQUARE_LOCATION_ID);
  const itSquare = hasSquare ? it : it.skip;

  itSquare('creates a plan against the real Square sandbox', async () => {
    const result = await createSquareTermPlan(
      {
        id: 'test',
        name: 'Integration Test Term',
        length_months: 4,
        price_cents_1: 10000,
        price_cents_2: 16000,
        price_cents_3plus: 20000,
      },
      {
        SQUARE_ACCESS_TOKEN: sandboxEnv.SQUARE_ACCESS_TOKEN,
        SQUARE_APP_ID: sandboxEnv.SQUARE_APP_ID,
        SQUARE_LOCATION_ID: sandboxEnv.SQUARE_LOCATION_ID,
        ENVIRONMENT: 'development',
      },
    );

    expect(result).not.toBeNull();
    expect(result!.square.plan_id).toBeTruthy();
    expect(result!.square.var_1).toBeTruthy();
    expect(result!.square.var_2).toBeTruthy();
    expect(result!.square.var_3plus).toBeTruthy();
  }, 15000);

  itSquare('enrolls a student with dummy data against the real Square sandbox', async () => {
    const plan = await createSquareTermPlan(
      {
        id: 'enroll-test',
        name: 'Enrollment Test Term',
        length_months: 6,
        price_cents_1: 15000,
        price_cents_2: 25000,
        price_cents_3plus: 30000,
      },
      {
        SQUARE_ACCESS_TOKEN: sandboxEnv.SQUARE_ACCESS_TOKEN,
        SQUARE_APP_ID: sandboxEnv.SQUARE_APP_ID,
        SQUARE_LOCATION_ID: sandboxEnv.SQUARE_LOCATION_ID,
        ENVIRONMENT: 'development',
      },
    );
    expect(plan).not.toBeNull();

    const result = await createSquareSubscription(
      {
        parent: { name: 'Test Parent', email: 'test-parent@example.com', phone: '+14155552671' },
        address: { line1: '123 Main St', city: 'San Francisco', state: 'CA', postal_code: '94103', country: 'US' },
        childrenCount: 1,
        sourceId: 'cnon:card-nonce-ok',
        cardHolderName: 'Test Parent',
        refs: plan!.square,
      },
      {
        SQUARE_ACCESS_TOKEN: sandboxEnv.SQUARE_ACCESS_TOKEN,
        SQUARE_APP_ID: sandboxEnv.SQUARE_APP_ID,
        SQUARE_LOCATION_ID: sandboxEnv.SQUARE_LOCATION_ID,
        ENVIRONMENT: 'development',
      },
    );

    expect(result.subscriptionId).toBeTruthy();
    expect(result.customerId).toBeTruthy();
  }, 15000);
});