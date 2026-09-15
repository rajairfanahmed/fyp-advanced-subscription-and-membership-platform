import { isRecordId } from "@/lib/db/ids";
import { NextResponse, type NextRequest } from "next/server";

import { adminErrorJson } from "@/lib/auth/admin-http";
import {
  assertConfirmationPhrase,
  auditAdmin,
  confirmationPhraseOf,
  requireAdminMutation,
} from "@/lib/auth/require-admin";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { PaymentModel, SubscriptionModel } from "@/lib/mongodb/models";
import { createNotification } from "@/lib/mongodb/notifications";
import {
  getStripeClient,
  StripeNotConfiguredError,
} from "@/lib/stripe/client";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const ctx = await requireAdminMutation(req);
    await connectToMongoDB();

    const { paymentId } = await context.params;
    if (!isRecordId(paymentId)) {
      return NextResponse.json(
        { error: "Invalid payment id." },
        { status: 400 }
      );
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    assertConfirmationPhrase(
      confirmationPhraseOf(body),
      "REFUND",
      "Type REFUND to issue this refund."
    );

    const payment = await PaymentModel.findById(paymentId);
    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 }
      );
    }
    if (payment.status === "refunded") {
      return NextResponse.json(
        {
          ok: true,
          id: payment._id.toString(),
          status: payment.status,
          idempotent: true,
        },
        { status: 200 }
      );
    }
    if (payment.status !== "succeeded") {
      return NextResponse.json(
        { error: "Only successful payments can be refunded." },
        { status: 400 }
      );
    }
    if (!payment.stripePaymentIntentId && !payment.stripeChargeId) {
      return NextResponse.json(
        {
          error:
            "This payment has no Stripe reference, so it cannot be refunded automatically.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    await stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId || undefined,
        charge: payment.stripePaymentIntentId
          ? undefined
          : payment.stripeChargeId,
        reason: "requested_by_customer",
      },
      { idempotencyKey: `admin-refund-${payment._id.toString()}` }
    );

    payment.status = "refunded";
    await payment.save();

    if (payment.subscriptionId) {
      const sub = await SubscriptionModel.findById(payment.subscriptionId);
      if (sub && sub.status !== "canceled" && sub.status !== "expired") {
        if (sub.stripeSubscriptionId) {
          try {
            const { cancelStripeSubscriptionNow } = await import(
              "@/lib/stripe/subscription-ops"
            );
            await cancelStripeSubscriptionNow(sub.stripeSubscriptionId);
          } catch (error) {
            console.warn("[admin:payment:refund:cancel-stripe]", error);
          }
        }
        sub.status = "canceled";
        sub.canceledAt = new Date();
        sub.cancelAtPeriodEnd = false;
        await sub.save();
      }
    }

    try {
      await createNotification({
        recipientClerkUserId: payment.subscriberClerkUserId,
        category: "payment",
        title: "Refund issued",
        message: `Advanced Subscription & Membership Platform support refunded your payment of $${(
          payment.amountCents / 100
        ).toFixed(2)}. The related membership has been cancelled. The amount should appear back on your statement within a few business days.`,
        link: "/billing",
      });
    } catch (error) {
      console.warn("[admin:payment:refund:notify]", error);
    }

    await auditAdmin(ctx, req, {
      action: "payment.refund",
      targetType: "payment",
      targetId: payment._id.toString(),
      payload: { amountCents: payment.amountCents, currency: payment.currency },
    });

    return NextResponse.json(
      {
        ok: true,
        id: payment._id.toString(),
        status: payment.status,
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
    console.error("[admin:payment:refund]", error);
    return adminErrorJson(error, "Failed to refund payment.");
  }
}
