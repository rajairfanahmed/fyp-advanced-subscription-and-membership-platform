import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  deactivateCreatorPlan,
  deleteCreatorPlan,
  updateCreatorPlan,
} from "@/lib/mongodb/plans";

/**
 * PATCH  /api/plans/[planId]  → partial update (name, description, price,
 *                               features, isActive) for the signed-in creator.
 * DELETE /api/plans/[planId]  → soft-deactivate only (never hard delete).
 *                               Past subscriptions must be able to reference
 *                               historical plan rows in a later task.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { planId } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const plan = await updateCreatorPlan(planId, body ?? {});
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }
    return NextResponse.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update plan.";
    if (
      message === "Only creator accounts can manage subscription plans." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[plans:patch]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/plans/[planId]
 *   - default behavior: soft-deactivate (`isActive=false`)
 *   - `?hard=true`: hard-delete the row, allowed only for non-default
 *     custom plans that have never been used by a subscriber. The
 *     creator UI uses this to clean up plans created by mistake.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { planId } = await params;
    const url = new URL(req.url);
    const hard = url.searchParams.get("hard") === "true";

    if (hard) {
      const result = await deleteCreatorPlan(planId);
      return NextResponse.json(result);
    }

    const plan = await deactivateCreatorPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }
    return NextResponse.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete plan.";
    if (
      message === "Only creator accounts can manage subscription plans." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[plans:delete]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
