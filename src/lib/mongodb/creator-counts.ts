import {
  CreatorProfileModel,
  ContentModel,
  SubscriptionModel,
} from "@/lib/mongodb/models";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

/**
 * Recompute and persist `CreatorProfile.subscriberCount` from the
 * authoritative Subscription rows. Cheap enough to run on every
 * subscribe / cancel / Stripe webhook and avoids drift from missed
 * increments. No-op if the creator profile is missing.
 */
export async function recalcCreatorSubscriberCount(
  creatorClerkUserId: string
): Promise<number> {
  if (!creatorClerkUserId) return 0;

  const count = await SubscriptionModel.countDocuments({
    creatorClerkUserId,
    status: { $in: [...ACTIVE_STATUSES] },
  });

  await CreatorProfileModel.updateOne(
    { clerkUserId: creatorClerkUserId },
    { $set: { subscriberCount: count } }
  );

  return count;
}

/**
 * Recompute and persist `CreatorProfile.contentCount` from non-archived
 * content. Used as a self-healing fallback in case an increment was
 * missed; routine archive / publish operations can call this instead of
 * doing manual ±1 maths.
 */
export async function recalcCreatorContentCount(
  creatorClerkUserId: string
): Promise<number> {
  if (!creatorClerkUserId) return 0;

  const count = await ContentModel.countDocuments({
    creatorClerkUserId,
    status: { $ne: "archived" },
  });

  await CreatorProfileModel.updateOne(
    { clerkUserId: creatorClerkUserId },
    { $set: { contentCount: count } }
  );

  return count;
}
