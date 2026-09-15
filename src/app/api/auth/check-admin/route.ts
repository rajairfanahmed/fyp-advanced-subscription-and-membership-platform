import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/auth/roles";
import { resolveClerkSessionUser } from "@/lib/auth/clerk-session-user";

/**
 * GET /api/auth/check-admin
 *
 * Session-only. Returns whether the *authenticated caller* is on ADMIN_EMAILS.
 * Query-string emails are ignored — this must never be an allowlist oracle.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await resolveClerkSessionUser();
    const email = user?.email ?? "";
    return NextResponse.json(
      { isAdmin: Boolean(email && isAdminEmail(email)) },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
