import { NextResponse, type NextRequest } from "next/server";

import { parseAdminListQuery } from "@/lib/auth/admin-list-query";
import { adminErrorJson } from "@/lib/auth/admin-http";
import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminUsers } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

const ROLES = new Set(["all", "subscriber", "creator", "admin"]);

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const list = parseAdminListQuery(req.nextUrl.searchParams);
    const roleRaw = (req.nextUrl.searchParams.get("role") || "all").toLowerCase();
    const role = ROLES.has(roleRaw)
      ? (roleRaw as "all" | "subscriber" | "creator" | "admin")
      : "all";
    const data = await getAdminUsers(list, role);

    if (list.csv) {
      const csv = toCsv(
        ["ID", "Clerk ID", "Name", "Email", "Role", "Highest Plan", "Status", "Joined"],
        data.users.map((u) => ({
          ID: u.id,
          "Clerk ID": u.clerkUserId,
          Name: u.name,
          Email: u.email,
          Role: u.role,
          "Highest Plan": u.highestPlanLabel,
          Status: u.status,
          Joined: u.joinedAt,
        }))
      );
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`users-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin:users]", error);
    return adminErrorJson(error, "Failed to load users.");
  }
}
