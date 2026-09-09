import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { confirmCheckoutSessionForUser } from "@/lib/stripe/webhook";
import { StripeNotConfiguredError } from "@/lib/stripe/client";

/**
 * GET /api/checkout/session?session_id=
 *
 * Used by the subscription success page to confirm Stripe checkout
 * even if the webhook is delayed. Idempotent with the webhook handler.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required." },
      { status: 400 }
    );
  }

  try {
    const result = await confirmCheckoutSessionForUser({
      sessionId,
      clerkUserId: userId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json(
        { error: "Checkout confirmation is temporarily unavailable." },
        { status: 503 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Unable to confirm checkout.";
    console.error("[checkout:session]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
