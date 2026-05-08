import { NextResponse } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminPlans } from "@/lib/mongodb/admin-stats";

export async function GET() {
  try {
    await requireAdminContext();
    const data = await getAdminPlans();
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load plans.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:plans]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
