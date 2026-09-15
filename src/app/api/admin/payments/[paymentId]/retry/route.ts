import { isRecordId } from "@/lib/db/ids";
import { NextResponse, type NextRequest } from "next/server";

import { adminErrorJson } from "@/lib/auth/admin-http";
import { auditAdmin, requireAdminMutation } from "@/lib/auth/require-admin";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { PaymentModel } from "@/lib/mongodb/models";
import {
  getStripeClient,
  StripeNotConfiguredError,
} from "@/lib/stripe/client";

/**
 * POST /api/admin/payments/[paymentId]/retry
 *
 * Manually re-attempt a failed charge. Stripe handles dunning
 * automatically for subscription invoices, so we mostly call this to
 * shortcut waiting for the next dunning step. The webhook will flip
 * the row to `succeeded` (or back to `failed`) and refresh the
 * `Subscription.status` for us.
 */
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

    const payment = await PaymentModel.findById(paymentId);
    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 }
      );
    }
    if (payment.status !== "failed") {
      return NextResponse.json(
        { error: "Only failed payments can be retried." },
        { status: 400 }
      );
    }
    if (!payment.stripeInvoiceId && !payment.stripePaymentIntentId) {
      return NextResponse.json(
        {
          error:
            "This payment has no Stripe reference, so it cannot be retried automatically.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    if (payment.stripeInvoiceId) {
      // Subscription invoices: ask Stripe to re-attempt collection now.
      await stripe.invoices.pay(payment.stripeInvoiceId);
    } else if (payment.stripePaymentIntentId) {
      // One-off PaymentIntents: confirm again to retry the charge.
      await stripe.paymentIntents.confirm(payment.stripePaymentIntentId);
    }

    await auditAdmin(ctx, req, {
      action: "payment.retry",
      targetType: "payment",
      targetId: payment._id.toString(),
    });

    return NextResponse.json(
      {
        ok: true,
        id: payment._id.toString(),
        status: payment.status,
        message:
          "Retry requested. Stripe will deliver the result via webhook in a few seconds.",
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
    console.error("[admin:payment:retry]", error);
    return adminErrorJson(error, "Failed to retry payment.");
  }
}
