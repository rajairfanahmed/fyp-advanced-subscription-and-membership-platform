import type { HydratedDocument } from "mongoose";
import type Stripe from "stripe";

import {
  PlanModel,
  type PlanDocument,
} from "@/lib/mongodb/models";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";

type PlanDoc = HydratedDocument<PlanDocument>;

/**
 * Idempotent Stripe sync for a single Plan document.
 *
 * Workflow:
 *   1. Free plans never need a Stripe Price → no-op.
 *   2. Ensure a Stripe Product (using `metadata.plan_id` as natural key).
 *   3. Ensure a Stripe Price that matches the plan's current monthly amount.
 *      Stripe Prices are immutable — a price change creates a new Price
 *      and archives the old one so we never bill at a stale amount.
 *   4. Persist `stripeProductId` and `stripePriceId` back onto the plan
 *      document so checkout / webhook can use them.
 *
 * Failures are surfaced to the caller. Public helpers like
 * `syncPlanToStripeBestEffort` swallow them so a Stripe outage never
 * blocks plan create/update in the creator workspace.
 */

function planAmountCents(plan: PlanDoc | PlanDocument): number {
  const usd = Number(plan.priceMonthly);
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.round(usd * 100);
}

async function ensureStripeProduct(
  stripe: Stripe,
  plan: PlanDoc
): Promise<Stripe.Product> {
  const planId = plan._id.toString();

  if (plan.stripeProductId) {
    try {
      const existing = await stripe.products.retrieve(plan.stripeProductId);
      if (!existing.deleted) {
        const needsName = existing.name !== plan.name;
        const needsDesc =
          (plan.description || "") !== (existing.description ?? "");
        if (needsName || needsDesc) {
          await stripe.products.update(plan.stripeProductId, {
            name: plan.name,
            description: plan.description || undefined,
          });
        }
        return existing;
      }
    } catch (error) {
      console.warn("[stripe:plan-sync] product retrieve failed, recreating", {
        planId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const search = await stripe.products
    .search({
      query: `metadata['plan_id']:'${planId.replace(/'/g, "\\'")}'`,
      limit: 1,
    })
    .catch(() => null);
  const found = search?.data?.[0];
  if (found && !found.deleted) return found;

  return stripe.products.create({
    name: plan.name,
    description: plan.description || undefined,
    metadata: {
      plan_id: planId,
      creator_clerk_user_id: plan.creatorClerkUserId,
      access_level: plan.accessLevel,
    },
  });
}

async function ensureStripePrice(
  stripe: Stripe,
  plan: PlanDoc,
  product: Stripe.Product
): Promise<Stripe.Price> {
  const targetUnitAmount = planAmountCents(plan);
  const targetCurrency = (plan.currency || "usd").toLowerCase();

  if (plan.stripePriceId) {
    try {
      const existing = await stripe.prices.retrieve(plan.stripePriceId);
      const sameAmount = existing.unit_amount === targetUnitAmount;
      const sameCurrency = existing.currency === targetCurrency;
      const sameRecurrence = existing.recurring?.interval === "month";
      if (existing.active && sameAmount && sameCurrency && sameRecurrence) {
        return existing;
      }
      // Stripe Prices are immutable: if the amount/currency changed we
      // archive the stale price and fall through to create a new one.
      if (existing.active) {
        await stripe.prices
          .update(plan.stripePriceId, { active: false })
          .catch((error) => {
            console.warn("[stripe:plan-sync] failed to archive old price", {
              priceId: plan.stripePriceId,
              error: error instanceof Error ? error.message : error,
            });
          });
      }
    } catch (error) {
      console.warn("[stripe:plan-sync] price retrieve failed, recreating", {
        priceId: plan.stripePriceId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  return stripe.prices.create({
    product: product.id,
    unit_amount: targetUnitAmount,
    currency: targetCurrency,
    recurring: { interval: "month" },
    metadata: {
      plan_id: plan._id.toString(),
      access_level: plan.accessLevel,
    },
  });
}

/**
 * Sync a single plan to Stripe and persist the resulting ids on the
 * Mongo document. Throws if Stripe is unreachable; callers wanting
 * best-effort behaviour should use `syncPlanToStripeBestEffort`.
 */
export async function syncPlanToStripe(
  plan: PlanDoc
): Promise<PlanDoc> {
  if (plan.accessLevel === "free" || planAmountCents(plan) === 0) {
    if (plan.stripePriceId || plan.stripeProductId) {
      plan.stripePriceId = "";
      plan.stripeProductId = "";
      await plan.save();
    }
    return plan;
  }

  if (!isStripeConfigured()) {
    return plan;
  }

  const stripe = getStripeClient();
  const product = await ensureStripeProduct(stripe, plan);
  const price = await ensureStripePrice(stripe, plan, product);

  const productChanged = plan.stripeProductId !== product.id;
  const priceChanged = plan.stripePriceId !== price.id;
  if (productChanged) plan.stripeProductId = product.id;
  if (priceChanged) plan.stripePriceId = price.id;
  if (productChanged || priceChanged) {
    await plan.save();
  }

  return plan;
}

/**
 * Best-effort wrapper used by creator-facing routes (POST /api/plans,
 * PATCH /api/plans/[planId]). A Stripe outage must never block a
 * creator from saving plan metadata — we just skip the sync and the
 * checkout self-heal layer will retry next time someone subscribes.
 */
export async function syncPlanToStripeBestEffort(
  plan: PlanDoc
): Promise<void> {
  try {
    await syncPlanToStripe(plan);
  } catch (error) {
    console.warn("[stripe:plan-sync] best-effort sync failed", {
      planId: plan._id.toString(),
      error: error instanceof Error ? error.message : error,
    });
  }
}

/**
 * Walk every paid plan owned by `creatorClerkUserId` and ensure each
 * one has a current Stripe Product + Price. Used as a self-heal step
 * inside checkout when a single plan is missing its `stripePriceId`,
 * and exposed via `/api/creator/stripe-sync` for manual repair.
 */
export async function backfillCreatorPlanStripePrices(
  creatorClerkUserId: string
): Promise<{ synced: number; skipped: number; failed: number }> {
  const plans = await PlanModel.find({
    creatorClerkUserId,
    isActive: true,
    accessLevel: { $in: ["basic", "premium"] },
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const plan of plans) {
    if (planAmountCents(plan) === 0) {
      skipped += 1;
      continue;
    }
    try {
      await syncPlanToStripe(plan);
      synced += 1;
    } catch (error) {
      failed += 1;
      console.warn("[stripe:plan-sync] backfill failed", {
        planId: plan._id.toString(),
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  return { synced, skipped, failed };
}
