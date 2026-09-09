import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  createCreatorPlan,
  listCurrentCreatorPlans,
} from "@/lib/mongodb/plans";

/**
 * GET  /api/plans   → list the signed-in creator's plans (auto-creates defaults).
 * POST /api/plans   → create a new custom plan for the signed-in creator.
 *
 * Both endpoints require an authenticated Clerk session AND the creator role
 * (enforced inside `listCurrentCreatorPlans` / `createCreatorPlan`).
 * Subscribers and admin emails receive 403 for the role deny.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const plans = await listCurrentCreatorPlans();
    return NextResponse.json({ plans });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load plans.";
    if (
      message === "Only creator accounts can manage subscription plans." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[plans:get]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const plan = await createCreatorPlan(body ?? {});
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create plan.";
    if (
      message === "Only creator accounts can manage subscription plans." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[plans:post]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
