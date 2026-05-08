import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createCheckoutSessionForPlan } from "@/lib/stripe/checkout";
import { StripeNotConfiguredError } from "@/lib/stripe/client";

/**
 * POST /api/checkout
 * Body: { planId: string; successUrl?: string; cancelUrl?: string }
 *
 * Creates a Stripe Checkout Session for a paid creator plan and
 * returns its hosted URL. The client is expected to redirect the
 * browser to that URL.
 *
 * Free plans should still go through `POST /api/subscriptions` —
 * this route rejects them with a 400.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { planId?: string; successUrl?: string; cancelUrl?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!planId) {
    return NextResponse.json(
      { error: "planId is required." },
      { status: 400 }
    );
  }

  try {
    const { url } = await createCheckoutSessionForPlan({
      planId,
      successUrl:
        typeof body.successUrl === "string" ? body.successUrl : undefined,
      cancelUrl:
        typeof body.cancelUrl === "string" ? body.cancelUrl : undefined,
    });
    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      console.error("[checkout]", error);
      return NextResponse.json(
        { error: "Checkout is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to start checkout.";
    console.error("[checkout]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
