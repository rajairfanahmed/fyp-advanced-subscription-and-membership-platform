import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  cancelCurrentUserSubscription,
  reactivateCurrentUserSubscription,
} from "@/lib/mongodb/subscriptions";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/subscriptions/[id]
 * Body: { cancel?: boolean; reactivate?: boolean }
 *
 * Lets the current subscriber cancel or (free-tier only) reactivate
 * their own subscription. Paid plans must reactivate via Stripe; the
 * helper enforces that and returns an error.
 */
export async function PATCH(req: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const wantCancel = Boolean((body as { cancel?: unknown }).cancel);
  const wantReactivate = Boolean((body as { reactivate?: unknown }).reactivate);

  if (wantCancel === wantReactivate) {
    return NextResponse.json(
      { error: "Pass exactly one of `cancel` or `reactivate`." },
      { status: 400 }
    );
  }

  try {
    const subscription = wantCancel
      ? await cancelCurrentUserSubscription(id)
      : await reactivateCurrentUserSubscription(id);

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ subscription }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update subscription.";
    if (message === "This account is suspended.") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[subscriptions:patch]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
