import { NextResponse, type NextRequest } from "next/server";

import { parseAdminListQuery } from "@/lib/auth/admin-list-query";
import { adminErrorJson } from "@/lib/auth/admin-http";
import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminPlans } from "@/lib/mongodb/admin-stats";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const list = parseAdminListQuery(req.nextUrl.searchParams);
    const data = await getAdminPlans(list);
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin:plans]", error);
    return adminErrorJson(error, "Failed to load plans.");
  }
}
