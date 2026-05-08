import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  ContentModel,
  CreatorProfileModel,
  PlanModel,
  type ContentDocument,
  type CreatorProfileDocument,
} from "@/lib/mongodb/models";
import type { ContentType, FileSubtype, RequiredPlan } from "@/types/content";
import type { PlanAccessLevel } from "@/types/plan";

export type PublicCreator = {
  /**
   * The Clerk userId of the creator. Exposed on the public payload so
   * subscribers can call `POST /api/subscriptions { creatorClerkUserId }`
   * for the free tier without us having to round-trip the slug again.
   */
  clerkUserId: string;
  slug: string;
  name: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  subscriberCount: number;
  contentCount: number;
  totalViews: number;
};

export type PublicCreatorPlan = {
  id: string;
  name: string;
  description: string;
  accessLevel: PlanAccessLevel;
  priceMonthly: number;
  currency: string;
  features: string[];
  /** True when a Stripe price has been attached and checkout is possible. */
  stripeReady: boolean;
};

export type PublicContent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  contentType: ContentType;
  requiredPlan: RequiredPlan;
  thumbnailUrl: string;
  videoDurationLabel: string;
  articleSummary: string;
  fileSubtype: FileSubtype | "";
  creatorName: string;
  creatorSlug: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function serializeCreator(profile: CreatorProfileDocument): PublicCreator {
  return {
    clerkUserId: profile.clerkUserId,
    slug: profile.creatorSlug,
    name: profile.creatorName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
    subscriberCount: profile.subscriberCount,
    contentCount: profile.contentCount,
    totalViews: profile.totalViews,
  };
}

async function listActivePlansForCreator(
  clerkUserId: string
): Promise<PublicCreatorPlan[]> {
  const plans = await PlanModel.find({
    creatorClerkUserId: clerkUserId,
    isActive: true,
  }).sort({ sortOrder: 1, createdAt: 1 });

  return plans.map((plan) => ({
    id: plan._id.toString(),
    name: plan.name,
    description: plan.description,
    accessLevel: plan.accessLevel as PlanAccessLevel,
    priceMonthly: plan.priceMonthly,
    currency: plan.currency,
    features: Array.isArray(plan.features) ? [...plan.features] : [],
    stripeReady: Boolean(plan.stripePriceId && plan.stripePriceId.trim()),
  }));
}

function serializeContent(content: ContentDocument, creator: CreatorProfileDocument): PublicContent {
  return {
    id: content._id.toString(),
    slug: content.slug,
    title: content.title,
    description: content.description,
    contentType: content.contentType,
    requiredPlan: content.requiredPlan,
    thumbnailUrl: content.thumbnailUrl,
    videoDurationLabel: content.videoDurationLabel,
    articleSummary: content.articleSummary,
    fileSubtype: content.contentType === "file" ? (content.fileSubtype as FileSubtype | "") : "",
    creatorName: creator.creatorName,
    creatorSlug: creator.creatorSlug,
  };
}

export async function getPublishedCreators(limit = 24) {
  await connectToMongoDB();
  const creators = await CreatorProfileModel.find({ profileStatus: "published" })
    .sort({ updatedAt: -1 })
    .limit(limit);
  return creators.map(serializeCreator);
}

export async function getPublishedCreatorBySlug(creatorSlug: string) {
  await connectToMongoDB();
  const creator = await CreatorProfileModel.findOne({
    creatorSlug: slugify(creatorSlug),
    profileStatus: "published",
  });
  return creator ? serializeCreator(creator) : null;
}

export async function getPublishedContent(limit = 24) {
  await connectToMongoDB();
  const creators = await CreatorProfileModel.find({ profileStatus: "published" });
  const creatorsByClerkId = new Map(creators.map((creator) => [creator.clerkUserId, creator]));

  const content = await ContentModel.find({ status: "published" })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit * 2);

  return content
    .map((item) => {
      const creator = creatorsByClerkId.get(item.creatorClerkUserId);
      return creator ? serializeContent(item, creator) : null;
    })
    .filter((item): item is PublicContent => Boolean(item))
    .slice(0, limit);
}

export type PublicPlanSummary = {
  accessLevel: PlanAccessLevel;
  /** Human label, "Free" / "Basic" / "Premium". */
  label: "Free" | "Basic" | "Premium";
  /**
   * Cheapest active plan we found at this access level. `null` if no
   * creator has published a plan in this tier yet.
   */
  startingPriceMonthly: number | null;
  currency: string;
  /** How many active plans across all creators sit at this tier. */
  planCount: number;
  /** Cumulative count of active subscriptions on this tier. */
  subscribersCount: number;
  /**
   * Most popular feature labels across plans at this tier (deduped,
   * top 6). Falls back to a tiny set of marketing copy when no
   * creators have written features yet so the UI stays useful.
   */
  features: string[];
};

export type PublicPlansSummary = {
  /** Plan summary for each access level. Always 3 entries. */
  tiers: PublicPlanSummary[];
  /** True only when at least one creator has published a paid plan. */
  hasRealPlans: boolean;
  /** True when any plan is wired to Stripe and can be subscribed to. */
  stripeReady: boolean;
};

const FALLBACK_FEATURES: Record<PlanAccessLevel, string[]> = {
  free: [
    "Free articles and video previews.",
    "Up to 5 file downloads per creator each month.",
    "Standard creator updates.",
  ],
  basic: [
    "Free + Basic-tier videos and articles.",
    "Up to 30 file downloads per creator each month.",
    "PDF, ZIP, and RAR downloads.",
  ],
  premium: [
    "Every tier of content from the creator.",
    "Unlimited file downloads.",
    "Priority support and templates.",
  ],
};

const ACCESS_LEVELS: PlanAccessLevel[] = ["free", "basic", "premium"];

function planLabel(accessLevel: PlanAccessLevel): "Free" | "Basic" | "Premium" {
  if (accessLevel === "premium") return "Premium";
  if (accessLevel === "basic") return "Basic";
  return "Free";
}

/**
 * Aggregate the cheapest representative plan at each access level
 * across every creator. Used by `/pricing` so the marketing page
 * stays in sync with the live Plan rows.
 */
export async function getPublicPlansSummary(): Promise<PublicPlansSummary> {
  await connectToMongoDB();

  const { SubscriptionModel } = await import("@/lib/mongodb/models");
  const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

  const [activePlans, activeSubs, publishedCreators] = await Promise.all([
    PlanModel.find({ isActive: true }).sort({ priceMonthly: 1, createdAt: 1 }),
    SubscriptionModel.find({ status: { $in: [...ACTIVE_STATUSES] } }).select(
      "accessLevel"
    ),
    CreatorProfileModel.countDocuments({ profileStatus: "published" }),
  ]);

  // Anchor the tier list to creators whose profile is actually
  // published — drafts shouldn't influence public marketing copy.
  const publishedCreatorClerkIds = new Set(
    (await CreatorProfileModel.find({
      profileStatus: "published",
    }).select("clerkUserId")).map((c) => c.clerkUserId)
  );

  const subscribersByTier: Record<PlanAccessLevel, number> = {
    free: 0,
    basic: 0,
    premium: 0,
  };
  for (const sub of activeSubs) {
    const lvl = (sub.accessLevel as PlanAccessLevel) ?? "free";
    subscribersByTier[lvl] += 1;
  }

  const tiers: PublicPlanSummary[] = ACCESS_LEVELS.map((accessLevel) => {
    const tierPlans = activePlans.filter(
      (p) =>
        p.accessLevel === accessLevel &&
        publishedCreatorClerkIds.has(p.creatorClerkUserId)
    );
    const cheapest = tierPlans[0];
    const featureBag = new Map<string, number>();
    for (const plan of tierPlans) {
      for (const f of plan.features ?? []) {
        const trimmed = f.trim();
        if (!trimmed) continue;
        featureBag.set(trimmed, (featureBag.get(trimmed) ?? 0) + 1);
      }
    }
    const aggregatedFeatures = [...featureBag.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([f]) => f)
      .slice(0, 6);

    return {
      accessLevel,
      label: planLabel(accessLevel),
      startingPriceMonthly: cheapest ? cheapest.priceMonthly : null,
      currency: cheapest?.currency || "usd",
      planCount: tierPlans.length,
      subscribersCount: subscribersByTier[accessLevel],
      features:
        aggregatedFeatures.length > 0
          ? aggregatedFeatures
          : FALLBACK_FEATURES[accessLevel],
    };
  });

  const hasRealPlans = tiers.some(
    (t) => t.accessLevel !== "free" && t.startingPriceMonthly !== null
  );
  const stripeReady = activePlans.some(
    (p) => p.accessLevel !== "free" && p.stripePriceId?.trim()
  );

  // Touch publishedCreators count just to keep it in scope for future
  // expansion (number of creators offering each tier, etc.)
  void publishedCreators;

  return { tiers, hasRealPlans, stripeReady };
}

export async function getPublishedContentByCreatorSlug(creatorSlug: string) {
  await connectToMongoDB();
  const creator = await CreatorProfileModel.findOne({
    creatorSlug: slugify(creatorSlug),
    profileStatus: "published",
  });
  if (!creator) {
    return {
      creator: null,
      content: [] as PublicContent[],
      plans: [] as PublicCreatorPlan[],
    };
  }

  const [content, plans] = await Promise.all([
    ContentModel.find({
      creatorClerkUserId: creator.clerkUserId,
      status: "published",
    }).sort({ publishedAt: -1, createdAt: -1 }),
    listActivePlansForCreator(creator.clerkUserId),
  ]);

  return {
    creator: serializeCreator(creator),
    content: content.map((item) => serializeContent(item, creator)),
    plans,
  };
}
