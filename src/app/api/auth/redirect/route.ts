import { NextResponse } from "next/server";

import { resolveClerkSessionUser } from "@/lib/auth/clerk-session-user";
import { ensureCurrentUserProfile } from "@/lib/auth/profile-sync";
import { getUserRedirectPath } from "@/lib/auth/roles";

/**
 * GET /api/auth/redirect
 *
 * After login, the client calls this to get the correct redirect URL
 * based on the user's role metadata and admin email allowlist.
 *
 * Uses Backend API fallback when `currentUser()` lags right after OAuth
 * so callers do not see a false 401 during session establishment.
 */
export async function GET() {
  try {
    const user = await resolveClerkSessionUser();

    if (!user) {
      return NextResponse.json(
        { redirect: "/login", authenticated: false },
        { status: 401 }
      );
    }

    const redirect = getUserRedirectPath(
      user.email,
      user.publicMetadata,
      user.unsafeMetadata
    );

    try {
      await ensureCurrentUserProfile({ updateLastLogin: true });
    } catch (err) {
      console.error("[auth:redirect] Profile sync failed:", err);
    }

    return NextResponse.json({ redirect, authenticated: true });
  } catch {
    return NextResponse.json({ redirect: "/library", authenticated: false });
  }
}
