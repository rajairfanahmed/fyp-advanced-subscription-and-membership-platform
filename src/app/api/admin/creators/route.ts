import { NextResponse, type NextRequest } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminCreators } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const data = await getAdminCreators();
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
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
    const message =
      error instanceof Error ? error.message : "Failed to load creators.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:creators]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
