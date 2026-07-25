import { describe, it, expect, vi, afterEach } from 'vitest';
import { hasSquare, createSquareTermPlan, createSquareSubscription } from '../../lib/server/maktab/square';

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        catalogObject: {
          id: 'PLAN_123',
          subscriptionPlanData: {
            subscriptionPlanVariations: [
              { id: 'v1', subscriptionPlanVariationData: { name: '1 Student(s)' } },
              { id: 'v2', subscriptionPlanVariationData: { name: '2 Student(s)' } },
              { id: 'v3', subscriptionPlanVariationData: { name: '3 Student(s)' } },
            ],
          },
        },
      }), { status: 200 }),
    ));

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
        catalogObject: {
          id: 'PLAN_456',
          subscriptionPlanData: {
            subscriptionPlanVariations: [
              { id: 'v3', subscriptionPlanVariationData: { name: '3 Student(s)' } },
              { id: 'v1', subscriptionPlanVariationData: { name: '1 Student(s)' } },
              { id: 'v2', subscriptionPlanVariationData: { name: '2 Student(s)' } },
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
        catalogObject: {
          id: 'PLAN_BAD',
          subscriptionPlanData: {
            subscriptionPlanVariations: [
              { id: 'v1', subscriptionPlanVariationData: { name: '1 Student(s)' } },
              { id: 'v2', subscriptionPlanVariationData: { name: '2 Student(s)' } },
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
      return new Response(JSON.stringify({
        catalogObject: {
          id: 'PLAN_789',
          subscriptionPlanData: {
            subscriptionPlanVariations: [
              { id: 'v1', subscriptionPlanVariationData: { name: '1 Student(s)' } },
              { id: 'v2', subscriptionPlanVariationData: { name: '2 Student(s)' } },
              { id: 'v3', subscriptionPlanVariationData: { name: '3 Student(s)' } },
            ],
          },
        },
      }), { status: 200 });
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
      return new Response(JSON.stringify({
        catalogObject: {
          id: 'PLAN_PROD',
          subscriptionPlanData: {
            subscriptionPlanVariations: [
              { id: 'v1', subscriptionPlanVariationData: { name: '1 Student(s)' } },
              { id: 'v2', subscriptionPlanVariationData: { name: '2 Student(s)' } },
              { id: 'v3', subscriptionPlanVariationData: { name: '3 Student(s)' } },
            ],
          },
        },
      }), { status: 200 });
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

  it('selects correct variation for 1 child', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      urls.push(url);
      if (url.includes('/customers')) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (url.includes('/cards')) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription({ ...parentInput, childrenCount: 1 }, FULL_ENV);
    const subCall = JSON.parse((globalThis.fetch as any).mock.calls[2]?.[1]?.body ?? '{}');
    expect(subCall.planVariationId).toBe('v1');
  });

  it('selects correct variation for 2 children', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/customers')) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (url.includes('/cards')) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription({ ...parentInput, childrenCount: 2 }, FULL_ENV);
    const subCall = JSON.parse((globalThis.fetch as any).mock.calls[2]?.[1]?.body ?? '{}');
    expect(subCall.planVariationId).toBe('v2');
  });

  it('selects 3plus variation for 3 children', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/customers')) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (url.includes('/cards')) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription({ ...parentInput, childrenCount: 3 }, FULL_ENV);
    const subCall = JSON.parse((globalThis.fetch as any).mock.calls[2]?.[1]?.body ?? '{}');
    expect(subCall.planVariationId).toBe('v3');
  });

  it('selects 3plus variation for 5 children', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/customers')) return new Response(JSON.stringify({ customer: { id: 'c1' } }), { status: 200 });
      if (url.includes('/cards')) return new Response(JSON.stringify({ card: { id: 'c2' } }), { status: 200 });
      return new Response(JSON.stringify({ subscription: { id: 's1', status: 'ACTIVE' } }), { status: 200 });
    }));

    await createSquareSubscription({ ...parentInput, childrenCount: 5 }, FULL_ENV);
    const subCall = JSON.parse((globalThis.fetch as any).mock.calls[2]?.[1]?.body ?? '{}');
    expect(subCall.planVariationId).toBe('v3');
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