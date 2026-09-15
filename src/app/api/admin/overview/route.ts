import { NextResponse } from "next/server";

import { adminErrorJson } from "@/lib/auth/admin-http";
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
    console.error("[admin:overview]", error);
    return adminErrorJson(error, "Failed to load overview.");
  }
}
