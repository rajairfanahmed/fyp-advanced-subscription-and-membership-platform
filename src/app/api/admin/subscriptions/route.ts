import { NextResponse, type NextRequest } from "next/server";

import { parseAdminListQuery } from "@/lib/auth/admin-list-query";
import { adminErrorJson } from "@/lib/auth/admin-http";
import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminSubscriptions } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const list = parseAdminListQuery(req.nextUrl.searchParams);
    const data = await getAdminSubscriptions(list);
    if (list.csv) {
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
    console.error("[admin:subscriptions]", error);
    return adminErrorJson(error, "Failed to load subscriptions.");
  }
}
