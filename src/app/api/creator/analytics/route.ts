import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { getCreatorAnalytics } from "@/lib/mongodb/creator-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";

/**
 * GET /api/creator/analytics
 * Returns content performance, format split, top content, and
 * conversion stats for the currently signed-in creator. Pass
 * `?format=csv` to download a flat report covering the headline
 * metrics, format split, and top content list.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const analytics = await getCreatorAnalytics();
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
      const headers = ["Section", "Metric", "Value"];
      const rows = [
        {
          Section: "Headline",
          Metric: "Total Content Views",
          Value: analytics.metrics.totalContentViews,
        },
        {
          Section: "Headline",
          Metric: "Total Downloads",
          Value: analytics.metrics.totalDownloads,
        },
        {
          Section: "Headline",
          Metric: "File Download Rate %",
          Value: analytics.metrics.fileDownloadRatePercent,
        },
        {
          Section: "Headline",
          Metric: "Premium Conversion %",
          Value: analytics.metrics.premiumConversionPercent,
        },
        {
          Section: "Headline",
          Metric: "Avg Watch Completion %",
          Value:
            analytics.metrics.averageWatchCompletionPercent === null
              ? ""
              : analytics.metrics.averageWatchCompletionPercent,
        },
        {
          Section: "Format Split",
          Metric: "Videos %",
          Value: analytics.formatSplit.videos,
        },
        {
          Section: "Format Split",
          Metric: "Files %",
          Value: analytics.formatSplit.files,
        },
        {
          Section: "Format Split",
          Metric: "Articles %",
          Value: analytics.formatSplit.articles,
        },
        ...analytics.topContent.map((item) => ({
          Section: "Top Content",
          Metric: item.title,
          Value: item.primaryStat,
        })),
      ];
      const csv = toCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`analytics-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(analytics, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load analytics.";
    console.error("[creator:analytics]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
