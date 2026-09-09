import type Stripe from "stripe";

import {
  assertAccountIsActive,
  ensureCurrentUserProfile,
} from "@/lib/auth/profile-sync";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  CreatorProfileModel,
  PlanModel,
  SubscriptionModel,
} from "@/lib/mongodb/models";
import { getStripeClient } from "@/lib/stripe/client";
import { syncPlanToStripe } from "@/lib/stripe/plan-sync";

type CreateCheckoutInput = {
  planId: string;
  successUrl?: string;
  cancelUrl?: string;
};

export type CreateCheckoutResult =
  | { url: string; applied?: false }
  | { url: null; applied: true };

/**
 * Resolve (or create) the Stripe Customer for the signed-in user.
 *
 * 1. If we have a Subscription row for (subscriber → creator) with a
 *    `stripeCustomerId`, reuse it — same subscriber should keep the
 *    same customer across re-subscriptions.
 * 2. Otherwise look up by metadata.clerk_user_id.
 * 3. Otherwise create a fresh Customer.
 */
async function ensureStripeCustomer(args: {
  stripe: Stripe;
  clerkUserId: string;
  email: string;
  fullName: string;
  creatorClerkUserId: string;
}): Promise<string> {
  const { stripe, clerkUserId, email, fullName, creatorClerkUserId } = args;

  const existingSub = await SubscriptionModel.findOne({
    subscriberClerkUserId: clerkUserId,
    stripeCustomerId: { $ne: "" },
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (existingSub?.stripeCustomerId) {
    return existingSub.stripeCustomerId;
  }

  if (email) {
    const search = await stripe.customers.search({
      query: `metadata['clerk_user_id']:'${clerkUserId.replace(/'/g, "\\'")}'`,
      limit: 1,
    });
    const hit = search.data[0];
    if (hit?.id) return hit.id;
  }

  const created = await stripe.customers.create({
    email: email || undefined,
    name: fullName || undefined,
    metadata: {
      clerk_user_id: clerkUserId,
      creator_clerk_user_id: creatorClerkUserId,
    },
  });

  return created.id;
}

/**
 * Build a Stripe Checkout Session for the supplied plan and return the
 * hosted URL the client should redirect to. Throws on validation or
 * Stripe configuration errors so the route handler can convert them
 * into a 4xx response.
 */
export async function createCheckoutSessionForPlan(
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> {
  const stripe = getStripeClient();

  const synced = await ensureCurrentUserProfile();
  if (!synced) {
    throw new Error("Sign in to start checkout.");
  }
  assertAccountIsActive(synced.profile);
  if (synced.role !== "subscriber" || synced.isAdmin) {
    throw new Error("Only subscriber accounts can subscribe to creators.");
  }

  await connectToMongoDB();

  const plan = await PlanModel.findById(input.planId);
  if (!plan || !plan.isActive) {
    throw new Error("That plan is no longer available.");
  }
  if (plan.accessLevel === "free") {
    throw new Error("Free plans don't go through checkout.");
  }
  if (!plan.stripePriceId) {
    // Self-heal: a creator just published a paid plan but the
    // background Stripe sync was skipped (Stripe was unreachable, or
    // the plan was created before this code shipped). Try once now —
    // if it still fails the subscriber gets a clear retry message
    // instead of a permanent "Coming soon" CTA.
    try {
      await syncPlanToStripe(plan);
    } catch (error) {
      console.error("[checkout] just-in-time stripe sync failed", {
        planId: plan._id.toString(),
        error: error instanceof Error ? error.message : error,
      });
    }
    if (!plan.stripePriceId) {
      throw new Error(
        "This plan isn't ready for checkout yet. Please retry in a moment, or contact the creator if the problem persists."
      );
    }
  }
  if (plan.creatorClerkUserId === synced.user.id) {
    throw new Error("You cannot subscribe to your own plan.");
  }

  const creator = await CreatorProfileModel.findOne({
    clerkUserId: plan.creatorClerkUserId,
  });
  if (!creator) {
    throw new Error("This plan's creator profile is missing.");
  }

  const existingSub = await SubscriptionModel.findOne({
    subscriberClerkUserId: synced.user.id,
    creatorClerkUserId: plan.creatorClerkUserId,
  });

  if (
    existingSub &&
    existingSub.planId?.toString() === plan._id.toString() &&
    existingSub.stripeSubscriptionId &&
    (existingSub.status === "active" ||
      existingSub.status === "trialing" ||
      existingSub.status === "past_due") &&
    !existingSub.cancelAtPeriodEnd
  ) {
    throw new Error("You already have this plan.");
  }

  // Same creator, already paying Stripe: swap the Price in place so we
  // never open a second subscription (double billing).
  if (
    existingSub?.stripeSubscriptionId &&
    (existingSub.status === "active" ||
      existingSub.status === "trialing" ||
      existingSub.status === "past_due") &&
    plan.stripePriceId
  ) {
    const { updateStripeSubscriptionPrice } = await import(
      "@/lib/stripe/subscription-ops"
    );
    const { upsertSubscriptionFromStripe } = await import("@/lib/stripe/webhook");
    const stripeSub = await updateStripeSubscriptionPrice({
      stripeSubscriptionId: existingSub.stripeSubscriptionId,
      stripePriceId: plan.stripePriceId,
      metadata: {
        subscriberClerkUserId: synced.user.id,
        creatorClerkUserId: plan.creatorClerkUserId,
        planId: plan._id.toString(),
        accessLevel: plan.accessLevel,
      },
    });
    if (stripeSub) {
      await upsertSubscriptionFromStripe(stripeSub, {
        subscriberClerkUserId: synced.user.id,
        creatorClerkUserId: plan.creatorClerkUserId,
        planId: plan._id.toString(),
        accessLevel: plan.accessLevel,
      });
      return { url: null, applied: true };
    }
  }

  const email =
    synced.user.primaryEmailAddress?.emailAddress ??
    synced.user.emailAddresses?.[0]?.emailAddress ??
    "";
  const fullName =
    [synced.user.firstName, synced.user.lastName].filter(Boolean).join(" ").trim() ||
    synced.profile.displayName ||
    "";

  const customerId = await ensureStripeCustomer({
    stripe,
    clerkUserId: synced.user.id,
    email,
    fullName,
    creatorClerkUserId: plan.creatorClerkUserId,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  const successUrl =
    input.successUrl ||
    `${baseUrl}/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    input.cancelUrl ||
    `${baseUrl}/creators/${creator.creatorSlug}?checkout=cancelled`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: synced.user.id,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata: {
      subscriber_clerk_user_id: synced.user.id,
      creator_clerk_user_id: plan.creatorClerkUserId,
      creator_profile_id: creator._id.toString(),
      plan_id: plan._id.toString(),
      access_level: plan.accessLevel,
    },
    subscription_data: {
      metadata: {
        subscriber_clerk_user_id: synced.user.id,
        creator_clerk_user_id: plan.creatorClerkUserId,
        plan_id: plan._id.toString(),
        access_level: plan.accessLevel,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { url: session.url };
}
