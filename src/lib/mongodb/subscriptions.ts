import { isRecordId } from "@/lib/db/ids";

import { assertCreatorIsAcceptingMembers } from "@/lib/account/status";
import {
  assertAccountIsActive,
  ensureCurrentUserProfile,
} from "@/lib/auth/profile-sync";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  CreatorProfileModel,
  PlanModel,
  SubscriberProfileModel,
  SubscriptionModel,
  type CreatorProfileDocument,
  type PlanDocument,
  type SubscriptionDocument,
} from "@/lib/mongodb/models";
import { notifyIfAllowed } from "@/lib/mongodb/notifications";
import { recalcCreatorSubscriberCount } from "@/lib/mongodb/creator-counts";
import type {
  SubscriptionDownloadQuota,
  SubscriptionResponse,
  SubscriptionStatus,
} from "@/types/subscription";
import type { PlanAccessLevel } from "@/types/plan";
import {
  QUOTA_WINDOW_MS,
  TIER_LIMITS,
  UNLIMITED_DOWNLOADS,
} from "@/config/tier-limits";

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type SerializeContext = {
  creatorProfile?: CreatorProfileDocument | null;
  plan?: PlanDocument | null;
};

async function loadCreatorProfile(
  doc: SubscriptionDocument
): Promise<CreatorProfileDocument | null> {
  if (doc.creatorProfileId) {
    const profile = await CreatorProfileModel.findById(doc.creatorProfileId);
    if (profile) return profile;
  }
  return CreatorProfileModel.findOne({ clerkUserId: doc.creatorClerkUserId });
}

async function loadPlan(
  doc: SubscriptionDocument
): Promise<PlanDocument | null> {
  if (!doc.planId) return null;
  return PlanModel.findById(doc.planId);
}

/**
 * Build a JSON-friendly snapshot of the subscription's current download
 * quota. Used inside `serializeSubscription` so any consumer of
 * `SubscriptionResponse` (subscriber dashboard, billing page, etc.)
 * can render "X / 30 downloads left" copy without an extra round trip.
 */
function safeTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function buildDownloadQuotaSnapshot(
  doc: SubscriptionDocument
): SubscriptionDownloadQuota {
  const accessLevel = (doc.accessLevel as PlanAccessLevel) ?? "free";
  const tier = TIER_LIMITS[accessLevel] ?? TIER_LIMITS.free;
  const now = Date.now();
  const periodStart = safeTime(doc.quotaPeriodStart);
  const expired = !periodStart || now - periodStart >= QUOTA_WINDOW_MS;
  const effectiveStart = expired ? now : periodStart;
  const used = expired ? 0 : Math.max(0, doc.monthlyDownloadCount ?? 0);
  const monthlyLimit =
    tier.monthlyDownloads === UNLIMITED_DOWNLOADS ? null : tier.monthlyDownloads;
  const remaining =
    monthlyLimit === null ? null : Math.max(0, monthlyLimit - used);
  return {
    monthlyLimit,
    usedThisPeriod: used,
    remaining,
    windowEnd: new Date(effectiveStart + QUOTA_WINDOW_MS).toISOString(),
  };
}

export async function serializeSubscription(
  doc: SubscriptionDocument,
  ctx: SerializeContext = {}
): Promise<SubscriptionResponse> {
  const creatorProfile =
    ctx.creatorProfile === undefined ? await loadCreatorProfile(doc) : ctx.creatorProfile;
  const plan = ctx.plan === undefined ? await loadPlan(doc) : ctx.plan;

  return {
    id: doc._id.toString(),
    subscriberClerkUserId: doc.subscriberClerkUserId,
    subscriberProfileId: doc.subscriberProfileId
      ? doc.subscriberProfileId.toString()
      : null,
    creatorClerkUserId: doc.creatorClerkUserId,
    creatorProfileId: doc.creatorProfileId ? doc.creatorProfileId.toString() : null,
    creatorName: creatorProfile?.creatorName ?? "Advanced Subscription & Membership Platform Creator",
    creatorSlug: creatorProfile?.creatorSlug ?? "",
    creatorAvatarUrl: creatorProfile?.avatarUrl ?? "",
    planId: doc.planId ? doc.planId.toString() : null,
    planName: plan?.name ?? labelForAccessLevel(doc.accessLevel as PlanAccessLevel),
    accessLevel: doc.accessLevel as PlanAccessLevel,
    status: doc.status as SubscriptionStatus,
    billingCycle: "monthly",
    currency: doc.currency,
    priceMonthly: Number(doc.priceMonthly) || 0,
    startedAt: doc.startedAt
      ? doc.startedAt.toISOString()
      : doc.createdAt.toISOString(),
    currentPeriodEnd: toIso(doc.currentPeriodEnd),
    canceledAt: toIso(doc.canceledAt),
    cancelAtPeriodEnd: Boolean(doc.cancelAtPeriodEnd),
    stripeCustomerId: doc.stripeCustomerId ?? "",
    stripeSubscriptionId: doc.stripeSubscriptionId ?? "",
    downloadQuota: buildDownloadQuotaSnapshot(doc),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function labelForAccessLevel(level: PlanAccessLevel) {
  if (level === "premium") return "Premium";
  if (level === "basic") return "Basic";
  return "Free";
}

async function resolveCreatorById(input: {
  creatorClerkUserId?: unknown;
  creatorSlug?: unknown;
}): Promise<CreatorProfileDocument | null> {
  if (typeof input.creatorClerkUserId === "string" && input.creatorClerkUserId.trim()) {
    return CreatorProfileModel.findOne({
      clerkUserId: input.creatorClerkUserId.trim(),
    });
  }
  if (typeof input.creatorSlug === "string" && input.creatorSlug.trim()) {
    return CreatorProfileModel.findOne({
      creatorSlug: slugify(input.creatorSlug),
    });
  }
  return null;
}

/**
 * List the current subscriber's subscriptions (newest first). Cancelled
 * rows are kept in the result so the UI can show history; consumers
 * filter by `status === "active"` if they only want live ones.
 */
export async function listCurrentUserSubscriptions(): Promise<SubscriptionResponse[]> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) return [];

  const docs = await SubscriptionModel.find({
    subscriberClerkUserId: synced.user.id,
  }).sort({ updatedAt: -1, createdAt: -1 });

  return Promise.all(docs.map((doc) => serializeSubscription(doc)));
}

/**
 * Free-tier subscribe. Creates (or revives) a single Subscription row
 * tying the current subscriber to the supplied creator at the creator's
 * default Free plan. Only the `free` access level is allowed via this
 * route — `basic` and `premium` will go through Stripe Checkout once
 * that lands.
 */
export async function subscribeCurrentUserToFreeTier(input: {
  creatorClerkUserId?: unknown;
  creatorSlug?: unknown;
}): Promise<SubscriptionResponse> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) {
    throw new Error("Sign in to subscribe to a creator.");
  }
  assertAccountIsActive(synced.profile);
  if (synced.role !== "subscriber" || synced.isAdmin) {
    throw new Error("Only subscriber accounts can subscribe to creators.");
  }

  const creator = await resolveCreatorById(input);
  if (!creator) {
    throw new Error("That creator could not be found.");
  }
  await assertCreatorIsAcceptingMembers(creator.clerkUserId);

  if (creator.clerkUserId === synced.user.id) {
    throw new Error("You cannot subscribe to yourself.");
  }

  const existing = await SubscriptionModel.findOne({
    subscriberClerkUserId: synced.user.id,
    creatorClerkUserId: creator.clerkUserId,
  });
  if (
    existing &&
    existing.accessLevel !== "free" &&
    (existing.status === "active" ||
      existing.status === "trialing" ||
      existing.status === "past_due")
  ) {
    throw new Error(
      "You already have a paid membership with this creator. Use Subscribe on Basic or Premium to change plans."
    );
  }

  // Pick the creator's active free plan if one exists; otherwise we
  // still create a free row so the user can preview free content.
  const freePlan = await PlanModel.findOne({
    creatorClerkUserId: creator.clerkUserId,
    accessLevel: "free",
    isActive: true,
  }).sort({ sortOrder: 1, createdAt: 1 });

  const subscriberProfile = await SubscriberProfileModel.findOne({
    clerkUserId: synced.user.id,
  });

  const update = {
    $set: {
      subscriberProfileId: subscriberProfile?._id ?? null,
      creatorProfileId: creator._id,
      planId: freePlan?._id ?? null,
      accessLevel: "free" as const,
      status: "active" as SubscriptionStatus,
      billingCycle: "monthly" as const,
      currency: freePlan?.currency ?? "usd",
      priceMonthly: 0,
      canceledAt: null,
      cancelAtPeriodEnd: false,
    },
    $setOnInsert: {
      subscriberClerkUserId: synced.user.id,
      creatorClerkUserId: creator.clerkUserId,
      startedAt: new Date(),
    },
  };

  let doc = await SubscriptionModel.findOneAndUpdate(
    {
      subscriberClerkUserId: synced.user.id,
      creatorClerkUserId: creator.clerkUserId,
    },
    update,
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

  if (!doc) {
    doc = await SubscriptionModel.findOne({
      subscriberClerkUserId: synced.user.id,
      creatorClerkUserId: creator.clerkUserId,
    });
  }

  if (!doc) {
    throw new Error("Your membership could not be saved. Please try again.");
  }
    try {
      await recalcCreatorSubscriberCount(creator.clerkUserId);
    } catch (error) {
      console.warn("[subscriptions:recalc-count]", error);
    }
    try {
      await notifyIfAllowed({
        recipientClerkUserId: synced.user.id,
        category: "creator",
        title: `Subscribed to ${creator.creatorName}`,
        message: `You now have free-tier access to ${creator.creatorName}'s public content.`,
        link: `/creators/${creator.creatorSlug}`,
        metadata: { event: "subscription.created", accessLevel: "free" },
      });
    } catch (error) {
      console.warn("[subscriptions:notify-subscriber]", error);
    }
    try {
      const subscriberLabel =
        synced.profile?.displayName ||
        synced.user.primaryEmailAddress?.emailAddress ||
        "A subscriber";
      await notifyIfAllowed({
        recipientClerkUserId: creator.clerkUserId,
        category: "creator",
        title: "New subscriber joined",
        message: `${subscriberLabel} just joined your free tier.`,
        link: "/creator/subscribers",
        creatorWorkspaceAlertKey: "newSubscriber",
        metadata: { event: "subscription.created", accessLevel: "free" },
      });
    } catch (error) {
      console.warn("[subscriptions:notify-creator]", error);
    }

  return serializeSubscription(doc, { creatorProfile: creator, plan: freePlan });
}

/**
 * Cancel my own subscription.
 * Free memberships end immediately.
 * Paid memberships cancel at the end of the Stripe billing period so
 * access continues until then (and Stripe stops charging after).
 */
export async function cancelCurrentUserSubscription(
  subscriptionId: string
): Promise<SubscriptionResponse | null> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) return null;
  assertAccountIsActive(synced.profile);
  if (!isRecordId(subscriptionId)) return null;

  const existing = await SubscriptionModel.findOne({
    _id: subscriptionId,
    subscriberClerkUserId: synced.user.id,
  });
  if (!existing) return null;

  const isPaid = existing.accessLevel !== "free" && Boolean(existing.stripeSubscriptionId);

  if (isPaid) {
    try {
      const { cancelStripeSubscriptionAtPeriodEnd } = await import(
        "@/lib/stripe/subscription-ops"
      );
      await cancelStripeSubscriptionAtPeriodEnd(existing.stripeSubscriptionId);
    } catch (error) {
      console.error("[subscriptions:cancel:stripe]", error);
      throw new Error(
        "Stripe could not schedule the cancellation. Try the billing portal or contact support."
      );
    }
    existing.cancelAtPeriodEnd = true;
    existing.canceledAt = null;
    await existing.save();
  } else {
    existing.status = "canceled";
    existing.canceledAt = new Date();
    existing.cancelAtPeriodEnd = false;
    await existing.save();
  }

  const doc = existing;

  if (doc) {
    try {
      await recalcCreatorSubscriberCount(doc.creatorClerkUserId);
    } catch (error) {
      console.warn("[subscriptions:recalc-count]", error);
    }
    try {
      const creatorProfile = await loadCreatorProfile(doc);
      const creatorName = creatorProfile?.creatorName ?? "the creator";
      const creatorSlug = creatorProfile?.creatorSlug ?? "";
      await notifyIfAllowed({
        recipientClerkUserId: doc.subscriberClerkUserId,
        category: "renewal",
        title: isPaid ? "Cancellation scheduled" : "Subscription canceled",
        message: isPaid
          ? `Your paid membership with ${creatorName} will end at the close of the current billing period. You keep access until then.`
          : `Your subscription to ${creatorName} has been canceled. You can resubscribe anytime.`,
        link: creatorSlug ? `/creators/${creatorSlug}` : "/subscription",
        metadata: { event: "subscription.canceled", accessLevel: doc.accessLevel },
      });
      await notifyIfAllowed({
        recipientClerkUserId: doc.creatorClerkUserId,
        category: "creator",
        title: isPaid ? "Subscriber scheduled cancellation" : "Subscriber canceled",
        message: isPaid
          ? `A ${doc.accessLevel} subscriber scheduled cancellation at period end.`
          : `A ${doc.accessLevel} subscriber has canceled their subscription.`,
        link: "/creator/subscribers",
        creatorWorkspaceAlertKey: "renewalSummary",
        metadata: { event: "subscription.canceled", accessLevel: doc.accessLevel },
      });
    } catch (error) {
      console.warn("[subscriptions:notify-cancel]", error);
    }
  }

  return serializeSubscription(doc);
}

/**
 * Reactivate a canceled free follow, or resume a paid membership that
 * is still in the cancel-at-period-end window. Fully ended Stripe
 * subscriptions must check out again.
 */
export async function reactivateCurrentUserSubscription(
  subscriptionId: string
): Promise<SubscriptionResponse | null> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) return null;
  assertAccountIsActive(synced.profile);
  if (!isRecordId(subscriptionId)) return null;

  const existing = await SubscriptionModel.findOne({
    _id: subscriptionId,
    subscriberClerkUserId: synced.user.id,
  });
  if (!existing) return null;

  const isPaid = existing.accessLevel !== "free" && Boolean(existing.stripeSubscriptionId);
  if (isPaid) {
    if (!existing.cancelAtPeriodEnd) {
      throw new Error("This paid membership is not scheduled to cancel.");
    }
    try {
      const { resumeStripeSubscription } = await import("@/lib/stripe/subscription-ops");
      await resumeStripeSubscription(existing.stripeSubscriptionId);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "STRIPE_SUBSCRIPTION_ENDED") {
        throw new Error("This membership already ended. Subscribe again from the creator's page.");
      }
      if (code === "STRIPE_SUBSCRIPTION_NOT_RESUMABLE") {
        throw new Error("This membership cannot be resumed. Subscribe again from the creator's page.");
      }
      throw new Error("Stripe could not resume the membership. Try the billing portal or contact support.");
    }
    existing.cancelAtPeriodEnd = false;
    existing.canceledAt = null;
    if (existing.status === "canceled") existing.status = "active";
    await existing.save();
    try {
      await recalcCreatorSubscriberCount(existing.creatorClerkUserId);
    } catch (error) {
      console.warn("[subscriptions:recalc-count]", error);
    }
    try {
      const creatorProfile = await loadCreatorProfile(existing);
      const creatorName = creatorProfile?.creatorName ?? "the creator";
      await notifyIfAllowed({
        recipientClerkUserId: existing.subscriberClerkUserId,
        category: "renewal",
        title: "Membership will continue",
        message: `Billing will continue for ${creatorName}. Your access stays active.`,
        link: "/subscription",
        metadata: { event: "subscription.resumed", accessLevel: existing.accessLevel },
      });
    } catch (error) {
      console.warn("[subscriptions:notify-resume]", error);
    }
    return serializeSubscription(existing);
  }

  existing.status = "active";
  existing.canceledAt = null;
  existing.cancelAtPeriodEnd = false;
  await existing.save();

  try {
    await recalcCreatorSubscriberCount(existing.creatorClerkUserId);
  } catch (error) {
    console.warn("[subscriptions:recalc-count]", error);
  }
  try {
    const creatorProfile = await loadCreatorProfile(existing);
    const creatorName = creatorProfile?.creatorName ?? "the creator";
    const creatorSlug = creatorProfile?.creatorSlug ?? "";
    await notifyIfAllowed({
      recipientClerkUserId: existing.subscriberClerkUserId,
      category: "creator",
      title: `Subscription reactivated`,
      message: `Welcome back — your free-tier access to ${creatorName} is active again.`,
      link: creatorSlug ? `/creators/${creatorSlug}` : "/subscription",
      metadata: { event: "subscription.reactivated", accessLevel: "free" },
    });
  } catch (error) {
    console.warn("[subscriptions:notify-reactivate]", error);
  }

  return serializeSubscription(existing);
}

export type CreatorOwnedSubscriptionAction =
  | "schedule_cancel"
  | "keep_membership"
  | "remove_follower";

const CREATOR_MANAGEABLE_STATUSES = ["active", "trialing", "past_due"] as const;

/**
 * Creator-side membership actions, scoped to subscriptions they own.
 * Paid: schedule cancel at period end, or resume if already scheduled.
 * Free: remove the follower immediately (no Stripe).
 */
export async function manageCreatorOwnedSubscription(
  subscriptionId: string,
  action: CreatorOwnedSubscriptionAction
): Promise<SubscriptionResponse | null> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced || synced.role !== "creator" || synced.isAdmin) {
    throw new Error("Only creator accounts can manage subscribers.");
  }
  assertAccountIsActive(synced.profile);
  if (!isRecordId(subscriptionId)) return null;

  const existing = await SubscriptionModel.findOne({
    _id: subscriptionId,
    creatorClerkUserId: synced.user.id,
  });
  if (!existing) return null;

  const isLive = CREATOR_MANAGEABLE_STATUSES.includes(
    existing.status as (typeof CREATOR_MANAGEABLE_STATUSES)[number]
  );
  const isPaid = existing.accessLevel !== "free" && Boolean(existing.stripeSubscriptionId);

  if (action === "schedule_cancel") {
    if (!isPaid || !isLive) {
      throw new Error("Only active paid memberships can be scheduled to cancel.");
    }
    if (existing.cancelAtPeriodEnd) {
      return serializeSubscription(existing);
    }
    try {
      const { cancelStripeSubscriptionAtPeriodEnd } = await import(
        "@/lib/stripe/subscription-ops"
      );
      await cancelStripeSubscriptionAtPeriodEnd(existing.stripeSubscriptionId);
    } catch (error) {
      console.error("[creator:subscribers:cancel:stripe]", error);
      throw new Error("Stripe could not schedule the cancellation. Try again or contact support.");
    }
    existing.cancelAtPeriodEnd = true;
    existing.canceledAt = null;
    await existing.save();
  } else if (action === "keep_membership") {
    if (!isPaid || !isLive || !existing.cancelAtPeriodEnd) {
      throw new Error("This membership is not scheduled to cancel.");
    }
    try {
      const { resumeStripeSubscription } = await import("@/lib/stripe/subscription-ops");
      await resumeStripeSubscription(existing.stripeSubscriptionId);
    } catch (error) {
      console.error("[creator:subscribers:resume:stripe]", error);
      throw new Error("Stripe could not resume this membership. Try again or contact support.");
    }
    existing.cancelAtPeriodEnd = false;
    existing.canceledAt = null;
    await existing.save();
  } else if (action === "remove_follower") {
    if (existing.accessLevel !== "free") {
      throw new Error("Paid members cannot be removed immediately. Schedule cancellation instead.");
    }
    if (!isLive) {
      throw new Error("This follower is already inactive.");
    }
    existing.status = "canceled";
    existing.canceledAt = new Date();
    existing.cancelAtPeriodEnd = false;
    await existing.save();
  } else {
    throw new Error("Unknown membership action.");
  }

  try {
    await recalcCreatorSubscriberCount(existing.creatorClerkUserId);
  } catch (error) {
    console.warn("[creator:subscribers:recalc-count]", error);
  }

  try {
    const creatorProfile = await loadCreatorProfile(existing);
    const creatorName = creatorProfile?.creatorName ?? "the creator";
    const creatorSlug = creatorProfile?.creatorSlug ?? "";
    if (action === "schedule_cancel") {
      await notifyIfAllowed({
        recipientClerkUserId: existing.subscriberClerkUserId,
        category: "renewal",
        title: "Cancellation scheduled",
        message: `${creatorName} scheduled your paid membership to end at the close of the current billing period. You keep access until then.`,
        link: creatorSlug ? `/creators/${creatorSlug}` : "/subscription",
        metadata: { event: "subscription.cancel_scheduled", by: "creator" },
      });
    } else if (action === "keep_membership") {
      await notifyIfAllowed({
        recipientClerkUserId: existing.subscriberClerkUserId,
        category: "renewal",
        title: "Membership continued",
        message: `${creatorName} kept your paid membership. Billing will continue as usual.`,
        link: creatorSlug ? `/creators/${creatorSlug}` : "/subscription",
        metadata: { event: "subscription.resumed", by: "creator" },
      });
    } else {
      await notifyIfAllowed({
        recipientClerkUserId: existing.subscriberClerkUserId,
        category: "creator",
        title: "Free membership ended",
        message: `Your free-tier access to ${creatorName} has ended. You can subscribe again anytime.`,
        link: creatorSlug ? `/creators/${creatorSlug}` : "/subscription",
        metadata: { event: "subscription.canceled", by: "creator", accessLevel: "free" },
      });
    }
  } catch (error) {
    console.warn("[creator:subscribers:notify]", error);
  }

  return serializeSubscription(existing);
}

