import { NextResponse } from "next/server";

import { runDailyAnalyticsRollup } from "@/lib/mongodb/analytics-rollup";

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
async function authorize(request: Request): Promise<boolean> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[cron/analytics/daily-rollup] CRON_SECRET is not set — refusing the request in production."
      );
      return false;
    }
    console.warn(
      "[cron/analytics/daily-rollup] CRON_SECRET is not set — endpoint is currently unauthenticated in development. Set CRON_SECRET to gate it."
    );
    return true;
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ") && auth.slice(7).trim() === expected) {
    return true;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return querySecret === expected;
}

async function execute(request: Request) {
  if (!(await authorize(request))) {
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
