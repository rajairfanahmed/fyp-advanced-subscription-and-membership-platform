import { NextResponse } from "next/server";

import { runDailyAnalyticsRollup } from "@/lib/mongodb/analytics-rollup";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily analytics rollup endpoint, intended to be invoked by a cron
 * scheduler (Vercel Cron, GitHub Actions, etc.). Authenticated via a
 * `CRON_SECRET` env value — either as the `Authorization: Bearer ...`
 * header (Vercel Cron's convention) or `?secret=` for ad-hoc runs.
 *
 * Returns a small summary that can be alerted on if `creatorsFailed`
 * is non-zero.
 */
async function execute(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  let forDate: Date | undefined;
  if (dateParam) {
    const parsed = new Date(dateParam);
    if (!Number.isFinite(parsed.getTime())) {
      return NextResponse.json(
        { error: "Invalid `date` query parameter." },
        { status: 400 }
      );
    }
    forDate = parsed;
  }

  try {
    const result = await runDailyAnalyticsRollup(forDate);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/analytics/daily-rollup]", error);
    return NextResponse.json(
      { ok: false, error: "Rollup failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return execute(request);
}

export async function POST(request: Request) {
  return execute(request);
}
