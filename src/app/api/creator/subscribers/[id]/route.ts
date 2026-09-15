import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import {
  manageCreatorOwnedSubscription,
  type CreatorOwnedSubscriptionAction,
} from "@/lib/mongodb/subscriptions";

const ACTIONS = new Set<CreatorOwnedSubscriptionAction>([
  "schedule_cancel",
  "keep_membership",
  "remove_follower",
]);

/**
 * POST /api/creator/subscribers/[id]
 * Creator-owned membership actions. Body: { action }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ACTIONS.has(action as CreatorOwnedSubscriptionAction)) {
    return NextResponse.json(
      { error: "Pass action: schedule_cancel, keep_membership, or remove_follower." },
      { status: 400 }
    );
  }

  try {
    const result = await manageCreatorOwnedSubscription(
      id,
      action as CreatorOwnedSubscriptionAction
    );
    if (!result) {
      return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, subscription: result }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update this membership.";
    if (
      message === "Only creator accounts can manage subscribers." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[creator:subscribers:action]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
