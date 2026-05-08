import { NextResponse, type NextRequest } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminUsers } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const data = await getAdminUsers();
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
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
    const message =
      error instanceof Error ? error.message : "Failed to load users.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:users]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
