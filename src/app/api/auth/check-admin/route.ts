import { NextRequest, NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/auth/roles";

/**
 * Public endpoint that tells the client whether a given email is on
 * the admin allowlist (`ADMIN_EMAILS` server env). The sign-up form
 * uses this to skip the Subscriber/Creator role picker for admin
 * accounts — admin role is granted by email allowlist, not by Clerk
 * metadata, so forcing the picker would just confuse admins.
 *
 * Read-only and rate-limit-friendly: a single email -> boolean lookup
 * with no PII leakage (the request includes the email, the response
 * is a boolean). Listed in `isPublicRoute` via `/api/auth/(.*)`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ isAdmin: false });
  }
  return NextResponse.json({ isAdmin: isAdminEmail(email) });
}
