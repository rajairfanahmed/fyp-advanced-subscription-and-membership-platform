import { clerkClient } from "@clerk/nextjs/server";

import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  ContactModel,
  ContentModel,
  CreatorProfileModel,
  NotificationModel,
  PaymentModel,
  PlanModel,
  SubscriberProfileModel,
  SubscriptionModel,
  UserProfileModel,
} from "@/lib/mongodb/models";
import { deleteFromCloudflareR2 } from "@/lib/storage";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";

/**
 * Cascading delete for both creator and subscriber accounts.
 *
 * Order matters here — we cancel Stripe (so we stop billing), then
 * delete MongoDB rows (so the account no longer appears anywhere in
 * the app), then delete R2 objects (so storage is reclaimed), and
 * finally delete the Clerk user (so the user can immediately re-sign
 * up with the same email if they want a fresh start).
 *
 * Each step is wrapped in try/catch so a partial failure (e.g. Stripe
 * 5xx, an R2 object that's already gone) never aborts the rest of the
 * cascade — the alternative is a "half-deleted" account that the user
 * can't get rid of.
 *
 * Returns a per-step report so the calling route can show the user
 * exactly what was reclaimed (subscriptions cancelled, files removed,
 * etc.).
 */
export type DeletionReport = {
  role: "creator" | "subscriber";
  stripeSubscriptionsCanceled: number;
  stripeProductsArchived: number;
  contentDeleted: number;
  plansDeleted: number;
  subscriptionsDeleted: number;
  storageObjectsRemoved: number;
  warnings: string[];
};

async function safeDeleteR2(key: string | undefined, warnings: string[]) {
  if (!key) return false;
  try {
    await deleteFromCloudflareR2(key);
    return true;
  } catch (error) {
    warnings.push(`R2 delete failed for ${key}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function cancelStripeSubscriptionSafe(
  stripeSubscriptionId: string | undefined,
  warnings: string[]
): Promise<boolean> {
  if (!stripeSubscriptionId) return false;
  if (!isStripeConfigured()) return false;
  try {
    const stripe = getStripeClient();
    await stripe.subscriptions.cancel(stripeSubscriptionId);
    return true;
  } catch (error) {
    warnings.push(
      `Stripe cancel failed for ${stripeSubscriptionId}: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

async function archiveStripeProductSafe(
  stripeProductId: string | undefined,
  warnings: string[]
): Promise<boolean> {
  if (!stripeProductId) return false;
  if (!isStripeConfigured()) return false;
  try {
    const stripe = getStripeClient();
    // Mark inactive — Stripe forbids deleting products that have been
    // associated with prices. Archiving is the closest reversible op.
    await stripe.products.update(stripeProductId, { active: false });
    return true;
  } catch (error) {
    warnings.push(
      `Stripe archive failed for ${stripeProductId}: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

async function deleteClerkUserSafe(clerkUserId: string, warnings: string[]) {
  try {
    const client = await clerkClient();
    await client.users.deleteUser(clerkUserId);
  } catch (error) {
    warnings.push(
      `Clerk user delete failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Deletes a subscriber account: cancels their Stripe subscriptions,
 * removes subscription docs, removes the user/subscriber profile,
 * removes the avatar from R2, then deletes the Clerk user.
 */
export async function deleteSubscriberAccount(clerkUserId: string): Promise<DeletionReport> {
  await connectToMongoDB();

  const report: DeletionReport = {
    role: "subscriber",
    stripeSubscriptionsCanceled: 0,
    stripeProductsArchived: 0,
    contentDeleted: 0,
    plansDeleted: 0,
    subscriptionsDeleted: 0,
    storageObjectsRemoved: 0,
    warnings: [],
  };

  const subscriptions = await SubscriptionModel.find({ subscriberClerkUserId: clerkUserId });

  for (const sub of subscriptions) {
    const cancelled = await cancelStripeSubscriptionSafe(sub.stripeSubscriptionId, report.warnings);
    if (cancelled) report.stripeSubscriptionsCanceled += 1;
  }

  const subDelete = await SubscriptionModel.deleteMany({ subscriberClerkUserId: clerkUserId });
  report.subscriptionsDeleted = subDelete.deletedCount ?? 0;

  await NotificationModel.deleteMany({ recipientClerkUserId: clerkUserId }).catch((err) => {
    report.warnings.push(`Notification cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  });

  await PaymentModel.deleteMany({ subscriberClerkUserId: clerkUserId }).catch((err) => {
    report.warnings.push(`Payment cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  });

  await ContactModel.deleteMany({ clerkUserId }).catch(() => {
    /* contact form rows aren't critical */
  });

  const userProfile = await UserProfileModel.findOne({ clerkUserId });
  if (userProfile?.avatarKey) {
    if (await safeDeleteR2(userProfile.avatarKey, report.warnings)) {
      report.storageObjectsRemoved += 1;
    }
  }

  await SubscriberProfileModel.deleteOne({ clerkUserId });
  await UserProfileModel.deleteOne({ clerkUserId });

  await deleteClerkUserSafe(clerkUserId, report.warnings);

  return report;
}

/**
 * Deletes a creator workspace and EVERYTHING attached to it:
 *   - Cancel Stripe subscriptions for every subscriber of this creator.
 *   - Archive Stripe products tied to this creator's plans.
 *   - Delete every Content row + every R2 asset for the creator.
 *   - Delete every Plan row.
 *   - Delete the CreatorProfile (banner + avatar from R2).
 *   - Delete the UserProfile.
 *   - Delete the Clerk user.
 */
export async function deleteCreatorAccount(clerkUserId: string): Promise<DeletionReport> {
  await connectToMongoDB();

  const report: DeletionReport = {
    role: "creator",
    stripeSubscriptionsCanceled: 0,
    stripeProductsArchived: 0,
    contentDeleted: 0,
    plansDeleted: 0,
    subscriptionsDeleted: 0,
    storageObjectsRemoved: 0,
    warnings: [],
  };

  // 1. Cancel every active Stripe subscription against this creator
  //    so subscribers stop being billed.
  const subscriberSubs = await SubscriptionModel.find({ creatorClerkUserId: clerkUserId });
  for (const sub of subscriberSubs) {
    const cancelled = await cancelStripeSubscriptionSafe(sub.stripeSubscriptionId, report.warnings);
    if (cancelled) report.stripeSubscriptionsCanceled += 1;
  }
  const subDel = await SubscriptionModel.deleteMany({ creatorClerkUserId: clerkUserId });
  report.subscriptionsDeleted = subDel.deletedCount ?? 0;

  // 2. Archive Stripe products & delete plan rows.
  const plans = await PlanModel.find({ creatorClerkUserId: clerkUserId });
  for (const plan of plans) {
    if (plan.stripeProductId) {
      const archived = await archiveStripeProductSafe(plan.stripeProductId, report.warnings);
      if (archived) report.stripeProductsArchived += 1;
    }
  }
  const planDel = await PlanModel.deleteMany({ creatorClerkUserId: clerkUserId });
  report.plansDeleted = planDel.deletedCount ?? 0;

  // 3. Delete every Content row and reclaim its R2 assets.
  const contents = await ContentModel.find({ creatorClerkUserId: clerkUserId });
  for (const content of contents) {
    if (await safeDeleteR2(content.thumbnailKey, report.warnings)) report.storageObjectsRemoved += 1;
    if (await safeDeleteR2(content.videoKey, report.warnings)) report.storageObjectsRemoved += 1;
    if (await safeDeleteR2(content.fileKey, report.warnings)) report.storageObjectsRemoved += 1;
  }
  const contentDel = await ContentModel.deleteMany({ creatorClerkUserId: clerkUserId });
  report.contentDeleted = contentDel.deletedCount ?? 0;

  // 4. Notifications + payments + contact rows.
  await NotificationModel.deleteMany({
    $or: [{ creatorClerkUserId: clerkUserId }, { recipientClerkUserId: clerkUserId }],
  }).catch((err) => {
    report.warnings.push(`Notification cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  });
  await PaymentModel.deleteMany({
    $or: [{ creatorClerkUserId: clerkUserId }, { subscriberClerkUserId: clerkUserId }],
  }).catch((err) => {
    report.warnings.push(`Payment cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  });
  await ContactModel.deleteMany({ clerkUserId }).catch(() => {
    /* not critical */
  });

  // 5. Delete the creator profile (banner + avatar from R2).
  const creatorProfile = await CreatorProfileModel.findOne({ clerkUserId });
  if (creatorProfile?.avatarKey) {
    if (await safeDeleteR2(creatorProfile.avatarKey, report.warnings)) report.storageObjectsRemoved += 1;
  }
  if (creatorProfile?.bannerKey) {
    if (await safeDeleteR2(creatorProfile.bannerKey, report.warnings)) report.storageObjectsRemoved += 1;
  }
  await CreatorProfileModel.deleteOne({ clerkUserId });

  // 6. Delete user profile (and any leftover subscriber profile in
  //    case the user toggled roles at some point).
  const userProfile = await UserProfileModel.findOne({ clerkUserId });
  if (userProfile?.avatarKey) {
    if (await safeDeleteR2(userProfile.avatarKey, report.warnings)) report.storageObjectsRemoved += 1;
  }
  await SubscriberProfileModel.deleteOne({ clerkUserId });
  await UserProfileModel.deleteOne({ clerkUserId });

  // 7. Finally, delete the Clerk user so the same email can sign
  //    back up immediately if they want a fresh start.
  await deleteClerkUserSafe(clerkUserId, report.warnings);

  return report;
}
