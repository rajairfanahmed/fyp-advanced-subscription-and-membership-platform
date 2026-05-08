import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { getCreatorRevenue } from "@/lib/mongodb/creator-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

/**
 * GET /api/creator/revenue
 * Returns MRR, ARPU, churn, recent payments, MRR trend, and a 7-day
 * renewal forecast for the currently signed-in creator. Pass
 * `?format=csv` to download the recent payments table as CSV.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const revenue = await getCreatorRevenue();
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
      const headers = [
        "Payment ID",
        "Subscriber",
        "Status",
        "Amount",
        "Currency",
        "Description",
        "Paid At",
      ];
      const rows = revenue.recentPayments.map((p) => ({
        "Payment ID": p.id,
        Subscriber: p.subscriberClerkUserId,
        Status: p.status,
        Amount: (p.amountCents / 100).toFixed(2),
        Currency: p.currency.toUpperCase(),
        Description: p.description,
        "Paid At": p.paidAt ?? "",
      }));
      const csv = toCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`revenue-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(revenue, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load revenue.";
    console.error("[creator:revenue]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
