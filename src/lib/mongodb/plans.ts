import { isRecordId } from "@/lib/db/ids";

import {
  assertAccountIsActive,
  ensureCurrentUserProfile,
} from "@/lib/auth/profile-sync";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  CreatorProfileModel,
  PlanModel,
  SubscriptionModel,
  type CreatorProfileDocument,
  type PlanDocument,
} from "@/lib/mongodb/models";
import { DEFAULT_CREATOR_PLANS } from "@/config/default-plans";
import {
  backfillCreatorPlanStripePrices,
  syncPlanToStripeBestEffort,
} from "@/lib/stripe/plan-sync";
import type {
  PlanAccessLevel,
  PlanCreateInput,
  PlanResponse,
  PlanUpdateInput,
} from "@/types/plan";

type CreatorContext = {
  clerkUserId: string;
  creatorProfile: CreatorProfileDocument;
};

const FEATURE_LIMIT = 24;
const FEATURE_TEXT_LIMIT = 200;

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeAccessLevel(value: unknown): PlanAccessLevel {
  if (value === "premium") return "premium";
  if (value === "basic") return "basic";
  return "free";
}

function normalizeFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, FEATURE_TEXT_LIMIT) : ""))
    .filter(Boolean)
    .slice(0, FEATURE_LIMIT);
}

const PAID_PRICE_MIN = 1;
const PAID_PRICE_MAX = 9999;

function clampPrice(value: unknown, accessLevel: PlanAccessLevel): number {
  if (accessLevel === "free") return 0;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new Error("Enter a valid monthly price.");
  }
  if (num < PAID_PRICE_MIN) {
    throw new Error("Paid plans must be at least $1.00 per month.");
  }
  if (num > PAID_PRICE_MAX) {
    throw new Error("Monthly price cannot exceed $9,999.00.");
  }
  return Math.round(num * 100) / 100;
}

async function requireCreatorContext(): Promise<CreatorContext> {
  const synced = await ensureCurrentUserProfile();
  if (!synced || synced.role !== "creator" || synced.isAdmin) {
    throw new Error("Only creator accounts can manage subscription plans.");
  }
  assertAccountIsActive(synced.profile);

  const creatorProfile = await CreatorProfileModel.findOne({ clerkUserId: synced.user.id });
  if (!creatorProfile) {
    throw new Error("Creator profile is missing. Open creator settings once, then try again.");
  }

  return { clerkUserId: synced.user.id, creatorProfile };
}

async function createUniqueSlug(baseValue: string, clerkUserId: string, existingId?: string) {
  const base = slugify(baseValue) || "plan";
  let candidate = base;
  let counter = 1;

  while (
    await PlanModel.exists({
      creatorClerkUserId: clerkUserId,
      slug: candidate,
      ...(existingId ? { _id: { $ne: existingId } } : {}),
    })
  ) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }

  return candidate;
}

export function serializePlan(plan: PlanDocument): PlanResponse {
  return {
    id: plan._id.toString(),
    creatorClerkUserId: plan.creatorClerkUserId,
    creatorProfileId: plan.creatorProfileId ? plan.creatorProfileId.toString() : null,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    currency: plan.currency,
    billingCycle: "monthly",
    accessLevel: plan.accessLevel as PlanAccessLevel,
    features: Array.isArray(plan.features) ? [...plan.features] : [],
    isActive: plan.isActive,
    isDefault: plan.isDefault,
    sortOrder: plan.sortOrder,
    stripePriceId: plan.stripePriceId ?? "",
    stripeProductId: plan.stripeProductId ?? "",
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/**
 * Old default feature copy that we used to seed before the download
 * quotas were finalised. We auto-replace these with the current
 * `DEFAULT_CREATOR_PLANS[*].features` so creators / subscribers see
 * accurate feature lists without anyone having to re-edit each plan
 * by hand.
 */
const STALE_DEFAULT_FEATURES: Record<string, ReadonlyArray<string>> = {
  free: ["Public content previews.", "Free articles.", "Starter video previews."],
  basic: ["Basic video library.", "Articles.", "PDF downloads.", "ZIP downloads."],
  premium: [
    "Full video library.",
    "Premium downloads.",
    "Templates.",
    "Private resources.",
    "Priority creator updates.",
  ],
};

function arraysShallowEqual(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].trim() !== b[i].trim()) return false;
  }
  return true;
}

/**
 * If the creator has no plans yet, insert the three default tiers
 * (Free / Basic / Premium). Safe to call repeatedly — it short-circuits
 * once any plan exists for this creator. Paid tiers are immediately
 * synced to Stripe (best-effort) so the creator profile shows real
 * "Subscribe" buttons instead of "Coming soon" right after sign-up.
 *
 * Also self-heals out-of-date default feature copy: when an existing
 * default plan still has the v1 marketing strings (no download-quota
 * numbers), we replace them with the current `DEFAULT_CREATOR_PLANS`
 * features so the pricing page always shows the live "5 / 30 /
 * unlimited" wording without manual edits.
 */
export async function ensureDefaultPlansForCreator(context: CreatorContext) {
  const existingPlans = await PlanModel.find({
    creatorClerkUserId: context.clerkUserId,
  });

  if (existingPlans.length > 0) {
    // Self-heal stale default feature copy on default plans.
    for (const plan of existingPlans) {
      if (!plan.isDefault) continue;
      const stale = STALE_DEFAULT_FEATURES[plan.accessLevel];
      const updated = DEFAULT_CREATOR_PLANS.find(
        (p) => p.accessLevel === plan.accessLevel
      );
      if (!stale || !updated) continue;
      const planFeatures: string[] = Array.isArray(plan.features)
        ? plan.features.map((f) => String(f))
        : [];
      if (arraysShallowEqual(planFeatures, stale)) {
        plan.features = [...updated.features];
        await plan.save();
      }
    }
    return;
  }

  const inserted = await PlanModel.insertMany(
    DEFAULT_CREATOR_PLANS.map((plan) => ({
      creatorClerkUserId: context.clerkUserId,
      creatorProfileId: context.creatorProfile._id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      priceMonthly: plan.priceMonthly,
      currency: "usd",
      billingCycle: "monthly",
      accessLevel: plan.accessLevel,
      features: [...plan.features],
      isActive: true,
      isDefault: true,
      sortOrder: plan.sortOrder,
    })),
    { ordered: false }
  );

  for (const plan of inserted) {
    if (plan.accessLevel !== "free") {
      void syncPlanToStripeBestEffort(plan);
    }
  }
}

export async function listCurrentCreatorPlans(): Promise<PlanResponse[]> {
  await connectToMongoDB();
  const context = await requireCreatorContext();
  await ensureDefaultPlansForCreator(context);

  const plans = await PlanModel.find({ creatorClerkUserId: context.clerkUserId }).sort({
    sortOrder: 1,
    createdAt: 1,
  });

  // Self-heal Stripe linkage in the background. Any active paid plan
  // missing `stripePriceId` here is the result of (a) a Stripe outage
  // during create, or (b) the plan being seeded before the auto-sync
  // code shipped. We don't await — the creator's plan UI never blocks
  // on Stripe responsiveness.
  const needsSync = plans.some(
    (p) =>
      p.isActive &&
      p.accessLevel !== "free" &&
      p.priceMonthly > 0 &&
      !p.stripePriceId
  );
  if (needsSync) {
    void backfillCreatorPlanStripePrices(context.clerkUserId);
  }

  return plans.map(serializePlan);
}

export async function createCreatorPlan(input: PlanCreateInput): Promise<PlanResponse> {
  await connectToMongoDB();
  const context = await requireCreatorContext();
  await ensureDefaultPlansForCreator(context);

  const name = cleanText(input.name).slice(0, 80);
  if (!name) throw new Error("Plan name is required.");

  const accessLevel = normalizeAccessLevel(input.accessLevel);
  const priceMonthly = clampPrice(input.priceMonthly, accessLevel);
  const description = cleanText(input.description).slice(0, 600);
  const features = normalizeFeatures(input.features);
  const slug = await createUniqueSlug(name, context.clerkUserId);
  const sortOrder =
    (await PlanModel.countDocuments({ creatorClerkUserId: context.clerkUserId })) + 1;

  const plan = await PlanModel.create({
    creatorClerkUserId: context.clerkUserId,
    creatorProfileId: context.creatorProfile._id,
    name,
    slug,
    description,
    priceMonthly,
    currency: "usd",
    billingCycle: "monthly",
    accessLevel,
    features,
    isActive: input.isActive === false ? false : true,
    isDefault: false,
    sortOrder,
  });

  if (plan.accessLevel !== "free" && plan.priceMonthly > 0) {
    await syncPlanToStripeBestEffort(plan);
  }

  return serializePlan(plan);
}

export async function updateCreatorPlan(
  planId: string,
  input: PlanUpdateInput
): Promise<PlanResponse | null> {
  await connectToMongoDB();
  const context = await requireCreatorContext();

  if (!isRecordId(planId)) return null;

  const plan = await PlanModel.findOne({
    _id: planId,
    creatorClerkUserId: context.clerkUserId,
  });
  if (!plan) return null;

  if (input.name !== undefined) {
    const name = cleanText(input.name).slice(0, 80);
    if (!name) throw new Error("Plan name is required.");
    plan.name = name;
  }

  if (input.description !== undefined) {
    plan.description = cleanText(input.description).slice(0, 600);
  }

  if (input.priceMonthly !== undefined) {
    plan.priceMonthly = clampPrice(input.priceMonthly, plan.accessLevel as PlanAccessLevel);
  }

  if (input.features !== undefined) {
    plan.features = normalizeFeatures(input.features);
  }

  if (input.isActive !== undefined) {
    const nextActive = Boolean(input.isActive);
    if (!nextActive && plan.accessLevel === "free") {
      const otherActiveFree = await PlanModel.exists({
        creatorClerkUserId: context.clerkUserId,
        accessLevel: "free",
        isActive: true,
        _id: { $ne: plan._id },
      });
      if (!otherActiveFree) {
        throw new Error("At least one Free plan must remain active.");
      }
    }
    plan.isActive = nextActive;
  }

  await plan.save();

  // Re-sync to Stripe whenever a paid plan's price/name/description
  // could have changed. Stripe Prices are immutable, so the sync helper
  // archives the old price and creates a new one when amounts differ.
  if (plan.accessLevel !== "free" && plan.priceMonthly > 0 && plan.isActive) {
    await syncPlanToStripeBestEffort(plan);
  }

  return serializePlan(plan);
}

/**
 * Soft delete only — never removes the document. Subscription history
 * (added in a later task) must be able to reference past plans, so we
 * just flip `isActive` to false and let the creator hide it from the UI.
 */
export async function deactivateCreatorPlan(planId: string): Promise<PlanResponse | null> {
  return updateCreatorPlan(planId, { isActive: false });
}

/**
 * Hard delete — only allowed for non-default custom plans that have
 * never been used by a subscriber. This is what the "Delete plan"
 * button on `/creator/plans` calls when a creator wants to clean up
 * a plan they created by mistake. Default Free/Basic/Premium tiers
 * are protected and have to be deactivated instead.
 */
export async function deleteCreatorPlan(
  planId: string
): Promise<{ deleted: true; planId: string }> {
  await connectToMongoDB();
  const context = await requireCreatorContext();

  if (!isRecordId(planId)) {
    throw new Error("Plan not found.");
  }

  const plan = await PlanModel.findOne({
    _id: planId,
    creatorClerkUserId: context.clerkUserId,
  });
  if (!plan) {
    throw new Error("Plan not found.");
  }

  if (plan.isDefault) {
    throw new Error(
      "The default Free, Basic and Premium tiers cannot be deleted. Deactivate them instead."
    );
  }

  const inUse = await SubscriptionModel.exists({ planId: plan._id });
  if (inUse) {
    throw new Error(
      "This plan has subscribers attached and cannot be deleted. Deactivate it instead."
    );
  }

  await PlanModel.deleteOne({ _id: plan._id });
  return { deleted: true, planId: plan._id.toString() };
}
