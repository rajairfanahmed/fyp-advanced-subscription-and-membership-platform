import { NextResponse, type NextRequest } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminSubscriptions } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const data = await getAdminSubscriptions();
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
      const csv = toCsv(
        [
          "ID",
          "Subscriber",
          "Email",
          "Creator",
          "Creator Slug",
          "Plan",
          "Access Level",
          "Status",
          "Started",
          "Renewal",
          "Price Monthly",
        ],
        data.subscriptions.map((s) => ({
          ID: s.id,
          Subscriber: s.subscriberName,
          Email: s.subscriberEmail,
          Creator: s.creatorName,
          "Creator Slug": s.creatorSlug,
          Plan: s.plan,
          "Access Level": s.accessLevel,
          Status: s.status,
          Started: s.startedAt,
          Renewal: s.renewalLabel,
          "Price Monthly": s.priceMonthly.toFixed(2),
        }))
      );
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`subscriptions-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load subscriptions.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:subscriptions]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
