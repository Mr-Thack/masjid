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