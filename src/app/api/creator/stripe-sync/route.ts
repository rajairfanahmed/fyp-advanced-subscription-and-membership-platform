import { NextResponse } from "next/server";

import {
  ACCOUNT_SUSPENDED_MESSAGE,
  assertAccountIsActive,
  ensureCurrentUserProfile,
} from "@/lib/auth/profile-sync";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { isStripeConfigured, StripeNotConfiguredError } from "@/lib/stripe/client";
import { backfillCreatorPlanStripePrices } from "@/lib/stripe/plan-sync";

/**
 * POST /api/creator/stripe-sync
 *
 * Auth-only creator endpoint that re-runs the Stripe Product/Price
 * sync for every paid plan owned by the caller. Used as the manual
 * "Reconnect to Stripe" button on /creator/plans, and as a recovery
 * path when an auto-sync was skipped (Stripe outage, plan created
 * before the sync code shipped, etc.).
 */
export async function POST() {
  const synced = await ensureCurrentUserProfile();
  if (!synced) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (synced.role !== "creator" || synced.isAdmin) {
    return NextResponse.json(
      { error: "Only creator accounts can sync plans to Stripe." },
      { status: 403 }
    );
  }
  try {
    assertAccountIsActive(synced.profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : ACCOUNT_SUSPENDED_MESSAGE;
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    await connectToMongoDB();
    const result = await backfillCreatorPlanStripePrices(synced.user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return NextResponse.json(
        { error: "Stripe is not configured on the server." },
        { status: 503 }
      );
    }
    console.error("[creator:stripe-sync]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe sync failed." },
      { status: 500 }
    );
  }
}
