import Stripe from "stripe";

type StripeClient = InstanceType<typeof Stripe>;

let client: StripeClient | null = null;

/**
 * Server-only Stripe client. Returns null if STRIPE_SECRET_KEY is unset, so
 * monetization endpoints can fail closed (503) without crashing the API.
 */
export function getStripe(): StripeClient | null {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client = new Stripe(key);
  return client;
}

export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}
