import { NextResponse } from "next/server";

import { runRenewalReminderSweep } from "@/lib/mongodb/renewal-reminders";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function execute(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runRenewalReminderSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/renewal-reminders]", error);
    return NextResponse.json(
      { ok: false, error: "Renewal reminder sweep failed." },
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
