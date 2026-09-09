import type Stripe from "stripe";

import {
  getStripeClient,
  isStripeConfigured,
} from "@/lib/stripe/client";

type StripePlanMetadata = {
  subscriberClerkUserId?: string;
  creatorClerkUserId?: string;
  planId: string;
  accessLevel: string;
};

/**
 * Swap the Stripe subscription onto a different Price (tier change).
 * Also stamps plan_id / access_level metadata so later webhooks resolve
 * the correct local Plan even if the Billing Portal changed the price.
 */
export async function updateStripeSubscriptionPrice(input: {
  stripeSubscriptionId: string;
  stripePriceId: string;
  metadata: StripePlanMetadata;
}): Promise<Stripe.Subscription | null> {
  if (!isStripeConfigured()) return null;
  const stripe = getStripeClient();
  const current = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
  const itemId = current.items.data[0]?.id;
  if (!itemId) {
    throw new Error("Stripe subscription has no price item to update.");
  }

  const metadata: Stripe.MetadataParam = {
    ...current.metadata,
    plan_id: input.metadata.planId,
    access_level: input.metadata.accessLevel,
  };
  if (input.metadata.subscriberClerkUserId) {
    metadata.subscriber_clerk_user_id = input.metadata.subscriberClerkUserId;
  }
  if (input.metadata.creatorClerkUserId) {
    metadata.creator_clerk_user_id = input.metadata.creatorClerkUserId;
  }

  return stripe.subscriptions.update(input.stripeSubscriptionId, {
    items: [{ id: itemId, price: input.stripePriceId }],
    metadata,
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
  });
}

/** Keep access until the current Stripe period ends, then stop billing. */
export async function cancelStripeSubscriptionAtPeriodEnd(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!isStripeConfigured()) return null;
  const stripe = getStripeClient();
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}

/** Immediate cancel — used by admin force-cancel and refunds. */
export async function cancelStripeSubscriptionNow(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!isStripeConfigured()) return null;
  const stripe = getStripeClient();
  return stripe.subscriptions.cancel(stripeSubscriptionId);
}

/**
 * Clear `cancel_at_period_end` on a still-live Stripe subscription.
 * Fully canceled (ended) subscriptions cannot be resumed — the
 * subscriber must check out again.
 */
export async function resumeStripeSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }
  const stripe = getStripeClient();
  const current = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  if (current.status === "canceled") {
    throw new Error("STRIPE_SUBSCRIPTION_ENDED");
  }
  if (
    current.status !== "active" &&
    current.status !== "trialing" &&
    current.status !== "past_due" &&
    current.status !== "unpaid"
  ) {
    throw new Error("STRIPE_SUBSCRIPTION_NOT_RESUMABLE");
  }
  if (!current.cancel_at_period_end) {
    return current;
  }
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Push the Stripe billing period out to `periodEnd` by setting trial_end.
 * Access continues (trialing maps to granted access); invoices pause until then.
 */
export async function extendStripeSubscriptionPeriod(
  stripeSubscriptionId: string,
  periodEnd: Date
): Promise<Stripe.Subscription | null> {
  if (!isStripeConfigured()) return null;
  const unix = Math.floor(periodEnd.getTime() / 1000);
  if (!Number.isFinite(unix) || unix <= Math.floor(Date.now() / 1000)) {
    throw new Error("Extended period must be in the future.");
  }
  const stripe = getStripeClient();
  return stripe.subscriptions.update(stripeSubscriptionId, {
    trial_end: unix,
    proration_behavior: "none",
  });
}

/** Stamp plan metadata onto an existing Stripe subscription without changing price. */
export async function stampStripeSubscriptionPlanMetadata(input: {
  stripeSubscriptionId: string;
  planId: string;
  accessLevel: string;
}): Promise<void> {
  if (!isStripeConfigured()) return;
  const stripe = getStripeClient();
  const current = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
  await stripe.subscriptions.update(input.stripeSubscriptionId, {
    metadata: {
      ...current.metadata,
      plan_id: input.planId,
      access_level: input.accessLevel,
    },
  });
}
