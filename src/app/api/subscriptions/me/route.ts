import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { listCurrentUserSubscriptions } from "@/lib/mongodb/subscriptions";

/**
 * GET /api/subscriptions/me
 * Returns every Subscription row owned by the current subscriber,
 * newest first (active + canceled).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const subscriptions = await listCurrentUserSubscriptions();
    return NextResponse.json(
      { subscriptions },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[subscriptions:list-mine]", error);
    return NextResponse.json(
      { error: "Failed to load subscriptions." },
      { status: 500 }
    );
  }
}
