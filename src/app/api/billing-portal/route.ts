import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { StripeNotConfiguredError } from "@/lib/stripe/client";
import { createBillingPortalSessionForCurrentUser } from "@/lib/stripe/portal";

/**
 * POST /api/billing-portal
 * Body: { returnUrl?: string }
 *
 * Creates a Stripe Billing Portal session for the signed-in user and
 * returns its URL so the client can redirect. The user must already
 * have a Stripe Customer (i.e. they completed checkout at least once).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { returnUrl?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const { url } = await createBillingPortalSessionForCurrentUser(
      typeof body.returnUrl === "string" ? body.returnUrl : undefined
    );
    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      console.error("[billing-portal]", error);
      return NextResponse.json(
        { error: "Billing portal is temporarily unavailable." },
        { status: 503 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to open billing portal.";
    if (message === "This account is suspended.") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[billing-portal]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
