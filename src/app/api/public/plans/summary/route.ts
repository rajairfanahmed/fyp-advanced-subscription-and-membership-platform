import { NextResponse } from "next/server";

import { getPublicPlansSummary } from "@/lib/mongodb/public-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getPublicPlansSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[GET /api/public/plans/summary]", error);
    return NextResponse.json(
      {
        tiers: [],
        hasRealPlans: false,
        stripeReady: false,
        error: "Plans summary is temporarily unavailable.",
      },
      { status: 200 }
    );
  }
}
