import Stripe from "stripe";

/**
 * Server-only Stripe client. Reads `STRIPE_SECRET_KEY` lazily so that
 * routes which don't actually use Stripe can still build/run when the
 * key is missing (e.g. local dev without a Stripe account).
 *
 * Always pinned to a known API version to avoid silent breakage when
 * Stripe rolls out new ones.
 */

const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

declare global {
  var __stripeClient: Stripe | undefined;
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local before using checkout/billing portal/webhooks."
    );
    this.name = "StripeNotConfiguredError";
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * Returns a memoised Stripe instance. Throws `StripeNotConfiguredError`
 * if the secret key is missing — callers (route handlers) should catch
 * this and respond with a 503 / friendly message.
 */
export function getStripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new StripeNotConfiguredError();
  }

  if (globalThis.__stripeClient) {
    return globalThis.__stripeClient;
  }

  const client = new Stripe(secret, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: {
      name: "Nexora",
      url: "https://nexora.app",
    },
    typescript: true,
  });

  globalThis.__stripeClient = client;
  return client;
}

/**
 * Webhook signing secret for `POST /api/webhooks/stripe`. Returns
 * empty string if not configured — handler must reject in that case.
 */
export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}
