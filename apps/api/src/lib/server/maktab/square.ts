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
  const base = squareBase(env);
  const url = `${base}${path}`;
  const response = await fetch(url, {
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
    const errors = (data as { errors?: unknown[] }).errors;
    const detail = JSON.stringify({ sent: body, received: errors ?? data });
    throw new Error(`Square API error: ${response.status} ${url} — ${detail}`);
  }
  return data as T;
}

function sortPlanVariations(variations: any[]): string[] {
  return variations
    .sort((a, b) => {
      const numA = parseInt((a.subscription_plan_variation_data.name as string).match(/\d+/)?.[0] ?? '0', 10);
      const numB = parseInt((b.subscription_plan_variation_data.name as string).match(/\d+/)?.[0] ?? '0', 10);
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
      subscription_plan_data: {
        name: term.name,
        subscription_plan_variations: prices.map((amount, i) => ({
          type: 'SUBSCRIPTION_PLAN_VARIATION',
          id: `#var_${i}`,
          subscription_plan_variation_data: {
            name: `${i + 1} Student(s)`,
            phases: [
              {
                cadence: 'MONTHLY',
                periods: term.length_months,
                recurring_price_money: { amount, currency: 'USD' },
              },
            ],
          },
        })),
      },
    },
  };

  const response = await squarePost<{
    catalog_object: {
      id: string;
      subscription_plan_data: { subscription_plan_variations: any[] };
    };
  }>(fullEnv, '/catalog/object', upsertBody);

  const variationIds = sortPlanVariations(
    response.catalog_object.subscription_plan_data.subscription_plan_variations,
  );

  if (variationIds.length !== 3) {
    throw new Error('Square term plan did not return 3 variations');
  }

  return {
    square: {
      plan_id: response.catalog_object.id,
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
    address_line_1: input.address.line1,
    locality: input.address.city,
    administrative_district_level_1: input.address.state,
    postal_code: input.address.postal_code,
    country: input.address.country,
  };

  const customer = await squarePost<{ customer: { id: string } }>(env, '/customers', {
    given_name: input.parent.name,
    email_address: input.parent.email,
    phone_number: input.parent.phone,
    address: billingAddress,
  });
  const customerId = customer.customer.id;

  const card = await squarePost<{ card: { id: string } }>(fullEnv, '/cards', {
    idempotency_key: crypto.randomUUID(),
    source_id: input.sourceId,
    card: {
      cardholder_name: input.cardHolderName,
      billing_address: billingAddress,
      customer_id: customerId,
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
      idempotency_key: crypto.randomUUID(),
      location_id: fullEnv.SQUARE_LOCATION_ID,
      plan_variation_id: planVariationId,
      customer_id: customerId,
      start_date: new Date().toISOString().slice(0, 10),
      timezone: 'America/New_York',
      card_id: cardId,
    },
  );

  return {
    subscriptionId: subscription.subscription.id,
    customerId,
  };
}