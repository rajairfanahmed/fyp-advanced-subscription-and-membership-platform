import { Types } from "mongoose";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { PaymentModel } from "@/lib/mongodb/models";
import { createNotification } from "@/lib/mongodb/notifications";
import {
  getStripeClient,
  StripeNotConfiguredError,
} from "@/lib/stripe/client";

/**
 * POST /api/admin/payments/[paymentId]/refund
 *
 * Refund a successful charge through Stripe. We require a real
 * `stripePaymentIntentId` (or `stripeChargeId`) on the row; manually
 * created payments cannot be refunded automatically. On success we
 * mark the row as `refunded` and notify the subscriber.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    await requireAdminContext();
    await connectToMongoDB();

    const { paymentId } = await context.params;
    if (!Types.ObjectId.isValid(paymentId)) {
      return NextResponse.json(
        { error: "Invalid payment id." },
        { status: 400 }
      );
    }

    const payment = await PaymentModel.findById(paymentId);
    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 }
      );
    }
    if (payment.status === "refunded") {
      return NextResponse.json(
        { error: "Payment is already refunded." },
        { status: 400 }
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
    await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId || undefined,
      charge: payment.stripePaymentIntentId
        ? undefined
        : payment.stripeChargeId,
      reason: "requested_by_customer",
    });

    payment.status = "refunded";
    await payment.save();

    try {
      await createNotification({
        recipientClerkUserId: payment.subscriberClerkUserId,
        category: "payment",
        title: "Refund issued",
        message: `Nexora support refunded your payment of $${(
          payment.amountCents / 100
        ).toFixed(2)}. The amount should appear back on your statement within a few business days.`,
        link: "/billing",
      });
    } catch (error) {
      console.warn("[admin:payment:refund:notify]", error);
    }

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
    const message =
      error instanceof Error ? error.message : "Failed to refund payment.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:payment:refund]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
