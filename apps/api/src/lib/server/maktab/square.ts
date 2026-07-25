import type { SquareEnv, PaymentRefs } from './types';

export function hasSquare(env: Partial<SquareEnv>): boolean {
  return !!(env.SQUARE_ACCESS_TOKEN && env.SQUARE_APP_ID && env.SQUARE_LOCATION_ID);
}

function squareBase(env: SquareEnv): string {
  return env.ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com/v2'
    : 'https://connect.squareupsandbox.com/v2';
}

async function squarePost<T>(env: SquareEnv, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${squareBase(env)}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-08-21',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || (data as { errors?: unknown[] }).errors) {
    const message = JSON.stringify((data as { errors?: unknown[] }).errors ?? data);
    throw new Error(`Square API error: ${message}`);
  }
  return data as T;
}

function sortPlanVariations(variations: any[]): string[] {
  return variations
    .sort((a, b) => {
      const numA = parseInt((a.subscriptionPlanVariationData.name as string).match(/\d+/)?.[0] ?? '0', 10);
      const numB = parseInt((b.subscriptionPlanVariationData.name as string).match(/\d+/)?.[0] ?? '0', 10);
      return numA - numB;
    })
    .map((item) => item.id);
}

export async function createSquareTermPlan(
  term: {
    id: string;
    name: string;
    length_months: number;
    price_cents_1: number;
    price_cents_2: number;
    price_cents_3plus: number;
  },
  env: Partial<SquareEnv>,
): Promise<{ square: NonNullable<PaymentRefs['square']> } | null> {
  if (!hasSquare(env)) return null;
  const fullEnv = env as SquareEnv;

  const prices = [term.price_cents_1, term.price_cents_2, term.price_cents_3plus];
  const idempotencyKey = crypto.randomUUID();

  const upsertBody = {
    idempotency_key: idempotencyKey,
    object: {
      type: 'SUBSCRIPTION_PLAN',
      id: '#plan',
      subscriptionPlanData: {
        name: term.name,
        subscriptionPlanVariations: prices.map((amount, i) => ({
          type: 'SUBSCRIPTION_PLAN_VARIATION',
          id: `#var_${i}`,
          subscriptionPlanVariationData: {
            name: `${i + 1} Student(s)`,
            phases: [
              {
                ordinal: 0,
                cadence: 'MONTHLY',
                periods: term.length_months,
                pricing: {
                  type: 'STATIC',
                  priceMoney: { amount: String(amount), currency: 'USD' },
                },
              },
            ],
          },
        })),
      },
    },
  };

  const response = await squarePost<{
    catalogObject: {
      id: string;
      subscriptionPlanData: { subscriptionPlanVariations: any[] };
    };
  }>(fullEnv, '/catalog/object', upsertBody);

  const variationIds = sortPlanVariations(
    response.catalogObject.subscriptionPlanData.subscriptionPlanVariations,
  );

  if (variationIds.length !== 3) {
    throw new Error('Square term plan did not return 3 variations');
  }

  return {
    square: {
      plan_id: response.catalogObject.id,
      var_1: variationIds[0]!,
      var_2: variationIds[1]!,
      var_3plus: variationIds[2]!,
    },
  };
}

export async function createSquareSubscription(
  input: {
    parent: { name: string; email: string; phone: string };
    address: { line1: string; city: string; state: string; postal_code: string; country: string };
    childrenCount: number;
    sourceId: string;
    cardHolderName: string;
    refs: NonNullable<PaymentRefs['square']>;
  },
  env: Partial<SquareEnv>,
): Promise<{ subscriptionId: string; customerId: string }> {
  if (!hasSquare(env)) {
    throw new Error('Square is not configured');
  }
  const fullEnv = env as SquareEnv;
  const billingAddress = {
    addressLine1: input.address.line1,
    locality: input.address.city,
    administrativeDistrictLevel1: input.address.state,
    postalCode: input.address.postal_code,
    country: input.address.country,
  };

  const customer = await squarePost<{ customer: { id: string } }>(env, '/customers', {
    givenName: input.parent.name,
    emailAddress: input.parent.email,
    phoneNumber: input.parent.phone,
    address: billingAddress,
  });
  const customerId = customer.customer.id;

  const card = await squarePost<{ card: { id: string } }>(fullEnv, '/cards', {
    idempotencyKey: crypto.randomUUID(),
    sourceId: input.sourceId,
    card: {
      cardHolderName: input.cardHolderName,
      billingAddress,
      customerId,
    },
  });
  const cardId = card.card.id;

  const planVariationId =
    input.childrenCount === 1 ? input.refs.var_1
    : input.childrenCount === 2 ? input.refs.var_2
    : input.refs.var_3plus;

  const subscription = await squarePost<{ subscription: { id: string; status: string } }>(
    fullEnv,
    '/subscriptions',
    {
      idempotencyKey: crypto.randomUUID(),
      locationId: fullEnv.SQUARE_LOCATION_ID,
      planVariationId,
      customerId,
      startDate: new Date().toISOString().slice(0, 10),
      timezone: 'America/New_York',
      cardId,
    },
  );

  return {
    subscriptionId: subscription.subscription.id,
    customerId,
  };
}
