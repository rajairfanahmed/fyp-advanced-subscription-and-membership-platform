import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  getStripeClient,
  getStripeWebhookSecret,
  StripeNotConfiguredError,
} from "@/lib/stripe/client";
import { handleStripeWebhookEvent } from "@/lib/stripe/webhook";

/**
 * Disable the default body parser — Stripe needs the raw request
 * payload byte-for-byte to verify the signature. Using `req.text()`
 * gives us the raw string in the App Router.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 *
 * Configure the matching endpoint in the Stripe Dashboard
 * (https://dashboard.stripe.com/webhooks) and copy the signing
 * secret into `STRIPE_WEBHOOK_SECRET`.
 *
 * Each handler in `handleStripeWebhookEvent` is idempotent — re-running
 * the same event upserts the same row, so Stripe retries are safe.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    console.error("[stripe:webhook] STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json(
      { error: "Webhook receiver is not configured." },
      { status: 503 }
    );
  }

  const rawBody = await req.text();

  let stripe: ReturnType<typeof getStripeClient>;
  try {
    stripe = getStripeClient();
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json(
        { error: "Stripe is not configured on the server." },
        { status: 503 }
      );
    }
    throw error;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Signature verification failed.";
    console.error("[stripe:webhook] signature verification failed", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await handleStripeWebhookEvent(event);
  } catch (error) {
    console.error("[stripe:webhook]", event.type, error);
    // Return 500 so Stripe retries the delivery. The handler itself is
    // idempotent, so retries are safe.
    return NextResponse.json(
      { error: "Webhook handler error." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
