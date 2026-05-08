import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { getCreatorSubscribers } from "@/lib/mongodb/creator-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

/**
 * GET /api/creator/subscribers
 * Lists all subscribers for the currently signed-in creator. Pass
 * `?format=csv` to download a spreadsheet-ready file instead of JSON.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const result = await getCreatorSubscribers();
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
      const headers = [
        "Subscription ID",
        "Subscriber",
        "Email",
        "Plan",
        "Access Level",
        "Status",
        "Renewal",
        "Engagement",
        "Started At",
      ];
      const rows = result.subscribers.map((row) => ({
        "Subscription ID": row.subscriptionId,
        Subscriber: row.name,
        Email: row.email,
        Plan: row.plan,
        "Access Level": row.accessLevel,
        Status: row.status,
        Renewal: row.renewalLabel,
        Engagement: row.engagement,
        "Started At": row.startedAt,
      }));
      const csv = toCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`subscribers-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load subscribers.";
    console.error("[creator:subscribers]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
