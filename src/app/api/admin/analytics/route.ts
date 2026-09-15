import { NextResponse, type NextRequest } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminAnalytics } from "@/lib/mongodb/admin-stats";
import { csvHeaders, csvTimestamp, toCsv } from "@/lib/csv";
import type { AdminAnalyticsRange } from "@/types/admin-stats";

const VALID_RANGES = new Set<AdminAnalyticsRange>(["1m", "3m", "6m", "12m"]);

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();

    const rangeRaw = req.nextUrl.searchParams.get("range") ?? "6m";
    const range: AdminAnalyticsRange = VALID_RANGES.has(
      rangeRaw as AdminAnalyticsRange
    )
      ? (rangeRaw as AdminAnalyticsRange)
      : "6m";

    const data = await getAdminAnalytics(range);
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
      const sections: string[] = [];
      sections.push(
        toCsv(
          ["Metric", "Value"],
          [
            { Metric: "Range", Value: range },
            {
              Metric: "Gross MRR (USD)",
              Value: (data.metrics.grossMrrCents / 100).toFixed(2),
            },
            {
              Metric: "Collected 30d (USD)",
              Value: (data.metrics.collected30dCents / 100).toFixed(2),
            },
            {
              Metric: "Platform take 30d (USD)",
              Value: (data.metrics.platformTakeCents / 100).toFixed(2),
            },
            {
              Metric: "Platform fee (bps)",
              Value: data.metrics.platformFeeBps,
            },
            {
              Metric: "Active Subscribers",
              Value: data.metrics.activeSubscribers,
            },
            { Metric: "Total Views", Value: data.metrics.totalViews },
            {
              Metric: "Premium Conversion %",
              Value: data.metrics.premiumConversionPercent.toFixed(1),
            },
            {
              Metric: "Churn Rate %",
              Value: data.churnRatePercent.toFixed(1),
            },
            {
              Metric: "Failed Payment Ratio %",
              Value: data.failedPaymentRatioPercent.toFixed(1),
            },
          ]
        )
      );
      sections.push(
        toCsv(
          ["Month", "Revenue (USD)"],
          data.trend.map((p) => ({
            Month: p.label,
            "Revenue (USD)": (p.valueCents / 100).toFixed(2),
          }))
        )
      );
      sections.push(
        toCsv(
          ["Month", "New Subscriptions"],
          data.acquisition.map((p) => ({
            Month: p.label,
            "New Subscriptions": p.count,
          }))
        )
      );
      sections.push(
        toCsv(
          ["Rank", "Title", "Creator", "Stat"],
          data.topContent.map((c, i) => ({
            Rank: i + 1,
            Title: c.title,
            Creator: c.creatorName,
            Stat: c.primaryStat,
          }))
        )
      );

      // Two-blank-line separator between sections so Excel renders
      // them as visually distinct tables in a single sheet.
      const csv = sections.join("\r\n\r\n");
      return new NextResponse(csv, {
        status: 200,
        headers: csvHeaders(`platform-analytics-${range}-${csvTimestamp()}.csv`),
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const { message, status } =
      (await import("@/lib/auth/require-admin")).adminApiError(
        error,
        "Failed to load analytics."
      );
    console.error("[admin:analytics]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
