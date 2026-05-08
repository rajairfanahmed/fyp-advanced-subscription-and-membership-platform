import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getCreatorOverview } from "@/lib/mongodb/creator-stats";

/**
 * GET /api/creator/overview
 * Aggregates dashboard metrics, top content, and recent activity for
 * the currently signed-in creator.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const overview = await getCreatorOverview();
    return NextResponse.json(overview, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load overview.";
    console.error("[creator:overview]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
