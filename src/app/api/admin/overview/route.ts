import { NextResponse } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminOverview } from "@/lib/mongodb/admin-stats";

export async function GET() {
  try {
    await requireAdminContext();
    const data = await getAdminOverview();
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load overview.";
    const status = message === "Not signed in." ? 401 : message === "Admin access required." ? 403 : 400;
    console.error("[admin:overview]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
