import { isRecordId } from "@/lib/db/ids";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  PlanModel,
  SubscriptionModel,
} from "@/lib/mongodb/models";
import { recalcCreatorSubscriberCount } from "@/lib/mongodb/creator-counts";
import { createNotification } from "@/lib/mongodb/notifications";
import {
  getStripeClient,
  isStripeConfigured,
  StripeNotConfiguredError,
} from "@/lib/stripe/client";
import type { PlanAccessLevel } from "@/types/plan";

type Body = {
  action?: string;
  // For action === "extend"
  extendDays?: number;
  // For action === "changePlan"
  planId?: string;
};

/**
 * PATCH /api/admin/subscriptions/[id]
 * Body: one of
 *   { action: "cancel" }
 *   { action: "reactivate" }
 *   { action: "extend", extendDays: number (1..365) }
 *   { action: "changePlan", planId: string }
 *
 * Admin override on a subscription. Stripe-backed rows fail closed:
 * if Stripe cannot cancel or resume, the local row is left unchanged.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminContext();
    await connectToMongoDB();

    const { id } = await context.params;
    if (!isRecordId(id)) {
      return NextResponse.json(
        { error: "Invalid subscription id." },
        { status: 400 }
      );
    }

    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    const action = String(body.action ?? "").toLowerCase();
    const sub = await SubscriptionModel.findById(id);
    if (!sub) {
      return NextResponse.json(
        { error: "Subscription not found." },
        { status: 404 }
      );
    }

    let notificationTitle = "";
    let notificationMessage = "";

    if (action === "cancel") {
      if (sub.stripeSubscriptionId) {
        if (!isStripeConfigured()) {
          return NextResponse.json(
            { error: "Stripe is not configured. Local cancel was not saved." },
            { status: 502 }
          );
        }
        try {
          const stripe = getStripeClient();
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        } catch (error) {
          console.error("[admin:sub:cancel:stripe]", error);
          return NextResponse.json(
            {
              error:
                "Local cancel was not saved because Stripe could not cancel this subscription. Try again.",
            },
            { status: 502 }
          );
        }
      }
      sub.status = "canceled";
      sub.canceledAt = new Date();
      sub.cancelAtPeriodEnd = false;
      notificationTitle = "Subscription cancelled by admin";
      notificationMessage =
        "Your subscription has been cancelled by Advanced Subscription & Membership Platform support. Contact us if this was unexpected.";
    } else if (action === "reactivate") {
      if (sub.accessLevel !== "free" && !sub.stripeSubscriptionId) {
        return NextResponse.json(
          {
            error:
              "Paid subscriptions can only be reactivated through Stripe checkout.",
          },
          { status: 400 }
        );
      }
      if (sub.stripeSubscriptionId) {
        if (!isStripeConfigured()) {
          return NextResponse.json(
            { error: "Stripe is not configured. Local reactivate was not saved." },
            { status: 502 }
          );
        }
        try {
          const { resumeStripeSubscription } = await import(
            "@/lib/stripe/subscription-ops"
          );
          await resumeStripeSubscription(sub.stripeSubscriptionId);
        } catch (error) {
          const resumeMessage =
            error instanceof Error ? error.message : "";
          if (resumeMessage === "STRIPE_SUBSCRIPTION_ENDED") {
            return NextResponse.json(
              {
                error:
                  "This paid subscription has fully ended. The subscriber must check out again.",
              },
              { status: 400 }
            );
          }
          if (resumeMessage === "STRIPE_SUBSCRIPTION_NOT_RESUMABLE") {
            return NextResponse.json(
              {
                error:
                  "Stripe cannot resume this subscription. The subscriber must check out again.",
              },
              { status: 400 }
            );
          }
          console.error("[admin:sub:reactivate:stripe]", error);
          return NextResponse.json(
            {
              error:
                "Local access was not restored because Stripe could not resume this subscription. Try again.",
            },
            { status: 502 }
          );
        }
      }
      sub.status = "active";
      sub.canceledAt = null;
      sub.cancelAtPeriodEnd = false;
      notificationTitle = "Subscription reactivated";
      notificationMessage =
        "Advanced Subscription & Membership Platform support has reactivated your subscription. Welcome back.";
    } else if (action === "extend") {
      const days = Number(body.extendDays);
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        return NextResponse.json(
          { error: "`extendDays` must be between 1 and 365." },
          { status: 400 }
        );
      }
      const base = sub.currentPeriodEnd ?? new Date();
      const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      sub.currentPeriodEnd = next;
      if (sub.status === "past_due") {
        sub.status = "active";
      }
      if (sub.stripeSubscriptionId && isStripeConfigured()) {
        try {
          const { extendStripeSubscriptionPeriod } = await import(
            "@/lib/stripe/subscription-ops"
          );
          await extendStripeSubscriptionPeriod(sub.stripeSubscriptionId, next);
        } catch (error) {
          console.error("[admin:sub:extend:stripe]", error);
          return NextResponse.json(
            {
              error:
                "Local period was not saved because Stripe could not extend the billing cycle. Try again.",
            },
            { status: 502 }
          );
        }
      }
      notificationTitle = "Subscription extended";
      notificationMessage = `Advanced Subscription & Membership Platform support extended your access by ${days} day${
        days === 1 ? "" : "s"
      }.`;
    } else if (action === "changeplan") {
      const planId = String(body.planId ?? "");
      if (!isRecordId(planId)) {
        return NextResponse.json(
          { error: "`planId` is required and must be valid." },
          { status: 400 }
        );
      }
      const plan = await PlanModel.findById(planId);
      if (!plan) {
        return NextResponse.json(
          { error: "Plan not found." },
          { status: 404 }
        );
      }
      if (plan.creatorClerkUserId !== sub.creatorClerkUserId) {
        return NextResponse.json(
          { error: "Plan does not belong to the same creator." },
          { status: 400 }
        );
      }
      sub.planId = plan._id;
      sub.accessLevel = plan.accessLevel as PlanAccessLevel;
      sub.priceMonthly = plan.priceMonthly;
      sub.currency = plan.currency || sub.currency;

      if (plan.accessLevel === "free") {
        if (sub.stripeSubscriptionId && isStripeConfigured()) {
          try {
            const { cancelStripeSubscriptionNow } = await import(
              "@/lib/stripe/subscription-ops"
            );
            await cancelStripeSubscriptionNow(sub.stripeSubscriptionId);
          } catch (error) {
            console.warn("[admin:sub:changePlan:cancel-stripe]", error);
          }
        }
        sub.stripeSubscriptionId = "";
        sub.priceMonthly = 0;
      } else if (sub.stripeSubscriptionId && plan.stripePriceId && isStripeConfigured()) {
        try {
          const { updateStripeSubscriptionPrice } = await import(
            "@/lib/stripe/subscription-ops"
          );
          await updateStripeSubscriptionPrice({
            stripeSubscriptionId: sub.stripeSubscriptionId,
            stripePriceId: plan.stripePriceId,
            metadata: {
              subscriberClerkUserId: sub.subscriberClerkUserId,
              creatorClerkUserId: sub.creatorClerkUserId,
              planId: plan._id.toString(),
              accessLevel: plan.accessLevel,
            },
          });
        } catch (error) {
          console.error("[admin:sub:changePlan:stripe]", error);
          return NextResponse.json(
            {
              error:
                "Stripe did not accept the plan change. Local access was not updated.",
            },
            { status: 502 }
          );
        }
      }

      notificationTitle = "Plan updated";
      notificationMessage = `Advanced Subscription & Membership Platform support changed your plan to ${plan.name}.`;
    } else {
      return NextResponse.json(
        {
          error:
            "`action` must be 'cancel', 'reactivate', 'extend', or 'changePlan'.",
        },
        { status: 400 }
      );
    }

    await sub.save();

    try {
      await recalcCreatorSubscriberCount(sub.creatorClerkUserId);
    } catch (error) {
      console.warn("[admin:sub:recalc-count]", error);
    }

    if (notificationTitle) {
      try {
        await createNotification({
          recipientClerkUserId: sub.subscriberClerkUserId,
          category: "account",
          title: notificationTitle,
          message: notificationMessage,
          link: "/subscription",
        });
      } catch (error) {
        console.warn("[admin:sub:notify]", error);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        id: sub._id.toString(),
        status: sub.status,
        accessLevel: sub.accessLevel,
        currentPeriodEnd: sub.currentPeriodEnd
          ? sub.currentPeriodEnd.toISOString()
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json(
        { error: "Stripe is not configured on this server." },
        { status: 503 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to update subscription.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:sub:patch]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
