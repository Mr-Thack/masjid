// Stripe webhook handler — placeholder for future Stripe integration.
// Current payment provider is Square (see lib/server/maktab/square.ts).
// Stripe was removed because account verification could not be completed in time.

export async function handleStripeWebhook(
  signature: string,
  body: string,
  secret?: string,
): Promise<Response> {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}