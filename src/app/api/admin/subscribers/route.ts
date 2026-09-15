import { NextResponse, type NextRequest } from "next/server";

import { parseAdminListQuery } from "@/lib/auth/admin-list-query";
import { adminErrorJson } from "@/lib/auth/admin-http";
import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminSubscribers } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const list = parseAdminListQuery(req.nextUrl.searchParams);
    const data = await getAdminSubscribers(list);
    if (list.csv) {
      const csv = toCsv(
        [
          "Subscription ID",
          "Subscriber Clerk ID",
          "Name",
          "Email",
          "Creator",
          "Creator Slug",
          "Plan",
          "Access Level",
          "Status",
          "Renewal",
          "Engagement",
          "Started",
        ],
        data.subscribers.map((s) => ({
          "Subscription ID": s.subscriptionId,
          "Subscriber Clerk ID": s.subscriberClerkUserId,
          Name: s.name,
          Email: s.email,
          Creator: s.creatorName,
          "Creator Slug": s.creatorSlug,
          Plan: s.plan,
          "Access Level": s.accessLevel,
          Status: s.status,
          Renewal: s.renewalLabel,
          Engagement: s.engagement,
          Started: s.startedAt,
        }))
      );
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`admin-subscribers-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin:subscribers]", error);
    return adminErrorJson(error, "Failed to load subscribers.");
  }
}
