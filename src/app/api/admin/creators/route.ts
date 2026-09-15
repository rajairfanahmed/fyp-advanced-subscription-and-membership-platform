import { NextResponse, type NextRequest } from "next/server";

import { parseAdminListQuery } from "@/lib/auth/admin-list-query";
import { adminErrorJson } from "@/lib/auth/admin-http";
import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminCreators } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const list = parseAdminListQuery(req.nextUrl.searchParams);
    const data = await getAdminCreators(list);
    if (list.csv) {
      const csv = toCsv(
        [
          "ID",
          "Clerk ID",
          "Slug",
          "Name",
          "Email",
          "Subscribers",
          "Paid Subscribers",
          "Content",
          "MRR",
          "Status",
          "Created",
        ],
        data.creators.map((c) => ({
          ID: c.id,
          "Clerk ID": c.clerkUserId,
          Slug: c.creatorSlug,
          Name: c.creatorName,
          Email: c.email,
          Subscribers: c.subscribersCount,
          "Paid Subscribers": c.paidSubscribersCount,
          Content: c.contentCount,
          MRR: (c.mrrCents / 100).toFixed(2),
          Status: c.status,
          Created: c.createdAt,
        }))
      );
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`creators-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin:creators]", error);
    return adminErrorJson(error, "Failed to load creators.");
  }
}
