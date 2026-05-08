import { NextResponse } from "next/server";

import { resolveClerkSessionUser } from "@/lib/auth/clerk-session-user";
import { getUserRole, isAdminEmail } from "@/lib/auth/roles";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { UserProfileModel } from "@/lib/mongodb/models";

/**
 * GET /api/auth/me
 *
 * Returns lightweight identity + authorization info for the current Clerk
 * session. Admin status is decided server-side from ADMIN_EMAILS so the
 * client never has to know the allowlist.
 *
 * Response shape:
 *   { user: null }                       — signed-out
 *   { user: { id, email, role, isAdmin, displayName, avatarUrl } }
 *
 * Reads displayName + avatarUrl from the persisted UserProfile when one
 * exists so that:
 *   - the global header reflects the avatar the user uploaded to
 *     Cloudflare R2 (not the stale Clerk imageUrl);
 *   - custom display name edits made on /account survive into the
 *     header without having to re-sync Clerk metadata.
 */
export async function GET() {
  try {
    const user = await resolveClerkSessionUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const role = getUserRole(user.publicMetadata, user.unsafeMetadata);
    const isAdmin = user.email ? isAdminEmail(user.email) : false;

    const firstName = user.firstName?.trim() ?? "";
    const lastName = user.lastName?.trim() ?? "";
    const fallbackDisplayName =
      [firstName, lastName].filter(Boolean).join(" ") ||
      (user.email ? user.email.split("@")[0] : "Member");

    let displayName = fallbackDisplayName;
    let avatarUrl = user.imageUrl ?? "";
    let effectiveRole = role;

    try {
      await connectToMongoDB();
      const profile = await UserProfileModel.findOne(
        { clerkUserId: user.id },
        { displayName: 1, avatarUrl: 1, role: 1 }
      ).lean();
      if (profile) {
        if (profile.displayName) displayName = profile.displayName;
        if (profile.avatarUrl) avatarUrl = profile.avatarUrl;
        if (profile.role === "creator" || profile.role === "subscriber") {
          effectiveRole = profile.role;
        }
      }
    } catch (err) {
      // Mongo failures here must NOT take down the global header —
      // we just fall back to Clerk-derived values.
      console.warn("[auth:me] profile lookup failed", err);
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          role: effectiveRole,
          isAdmin,
          displayName,
          avatarUrl,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
