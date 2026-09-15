import { NextResponse, type NextRequest } from "next/server";

import { parseAdminListQuery } from "@/lib/auth/admin-list-query";
import { adminErrorJson } from "@/lib/auth/admin-http";
import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminContent } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const list = parseAdminListQuery(req.nextUrl.searchParams);
    const data = await getAdminContent(list);
    if (list.csv) {
      const csv = toCsv(
        [
          "ID",
          "Title",
          "Type",
          "Subtype",
          "Access Level",
          "Status",
          "Creator",
          "Creator Slug",
          "Views",
          "Downloads",
          "Created",
        ],
        data.content.map((c) => ({
          ID: c.id,
          Title: c.title,
          Type: c.contentType,
          Subtype: c.fileSubtype,
          "Access Level": c.accessLevel,
          Status: c.status,
          Creator: c.creatorName,
          "Creator Slug": c.creatorSlug,
          Views: c.viewsCount,
          Downloads: c.downloadsCount,
          Created: c.createdAt,
        }))
      );
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`content-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin:content]", error);
    return adminErrorJson(error, "Failed to load content.");
  }
}
