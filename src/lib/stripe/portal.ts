import {
  assertAccountIsActive,
  ensureCurrentUserProfile,
} from "@/lib/auth/profile-sync";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { SubscriptionModel } from "@/lib/mongodb/models";
import { getStripeClient } from "@/lib/stripe/client";

/**
 * Build a Stripe Customer Portal session for the signed-in user. The
 * portal lets them manage payment methods, view invoices, and cancel
 * paid subscriptions. Throws when the user has no Stripe customer yet
 * (i.e. they have never started a paid checkout).
 */
export async function createBillingPortalSessionForCurrentUser(
  returnUrl?: string
): Promise<{ url: string }> {
  const stripe = getStripeClient();

  const synced = await ensureCurrentUserProfile();
  if (!synced) {
    throw new Error("Sign in to open the billing portal.");
  }
  assertAccountIsActive(synced.profile);

  await connectToMongoDB();

  const sub = await SubscriptionModel.findOne({
    subscriberClerkUserId: synced.user.id,
    stripeCustomerId: { $ne: "" },
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!sub?.stripeCustomerId) {
    throw new Error(
      "No Stripe customer on file yet. Start a paid subscription before opening the billing portal."
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl?.trim() || `${baseUrl}/billing`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a billing portal URL.");
  }

  return { url: session.url };
}
