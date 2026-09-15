import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { CREATOR_UNAVAILABLE_MESSAGE } from "@/lib/account/status";
import { ACCOUNT_SUSPENDED_MESSAGE } from "@/lib/auth/profile-sync";
import { subscribeCurrentUserToFreeTier } from "@/lib/mongodb/subscriptions";

/**
 * POST /api/subscriptions
 * Body: { creatorClerkUserId?: string; creatorSlug?: string }
 *
 * Free-tier subscribe. The current subscriber gets an active free
 * Subscription row tying them to the supplied creator. Paid plans go
 * through Stripe Checkout (`POST /api/checkout`).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const subscription = await subscribeCurrentUserToFreeTier(
      body as { creatorClerkUserId?: unknown; creatorSlug?: unknown }
    );
    return NextResponse.json({ subscription }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to subscribe.";
    if (
      message === "Only subscriber accounts can subscribe to creators." ||
      message === ACCOUNT_SUSPENDED_MESSAGE ||
      message === CREATOR_UNAVAILABLE_MESSAGE
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[subscriptions:create-free]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
