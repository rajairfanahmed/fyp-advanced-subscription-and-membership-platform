import { Types } from "mongoose";
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
 * Admin override on a subscription. We also try to mirror the change
 * to Stripe when the row has a `stripeSubscriptionId`; if Stripe fails
 * (e.g. not configured locally) we still apply the local change so the
 * admin can keep operating during incidents.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminContext();
    await connectToMongoDB();

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
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
      sub.status = "canceled";
      sub.canceledAt = new Date();
      sub.cancelAtPeriodEnd = false;
      notificationTitle = "Subscription cancelled by admin";
      notificationMessage =
        "Your subscription has been cancelled by Nexora support. Contact us if this was unexpected.";

      if (sub.stripeSubscriptionId && isStripeConfigured()) {
        try {
          const stripe = getStripeClient();
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        } catch (error) {
          console.warn("[admin:sub:cancel:stripe]", error);
        }
      }
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
      sub.status = "active";
      sub.canceledAt = null;
      sub.cancelAtPeriodEnd = false;
      notificationTitle = "Subscription reactivated";
      notificationMessage =
        "Nexora support has reactivated your subscription. Welcome back.";
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
      // Extending implies the user keeps access; bring the row back to
      // active if it was past_due.
      if (sub.status === "past_due") {
        sub.status = "active";
      }
      notificationTitle = "Subscription extended";
      notificationMessage = `Nexora support extended your access by ${days} day${
        days === 1 ? "" : "s"
      }.`;
    } else if (action === "changeplan") {
      const planId = String(body.planId ?? "");
      if (!Types.ObjectId.isValid(planId)) {
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
      notificationTitle = "Plan updated";
      notificationMessage = `Nexora support changed your plan to ${plan.name}.`;
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
