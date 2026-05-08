import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/set-role
 *
 * After Google OAuth signup, the client calls this endpoint to persist
 * the user's selected role (subscriber | creator) into Clerk metadata.
 *
 * Security:
 * - Only accepts "subscriber" or "creator" — never "admin".
 * - Admin is ALWAYS determined by the ADMIN_EMAILS allowlist.
 * - Requires an active Clerk session (userId).
 * - Uses Clerk server API to set publicMetadata (trusted, not user-editable).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as { role?: string };
    const role = body.role;

    // Only allow "subscriber" or "creator" — never "admin"
    if (role !== "subscriber" && role !== "creator") {
      return NextResponse.json(
        { error: "Invalid role. Must be subscriber or creator." },
        { status: 400 }
      );
    }

    // Use Clerk server SDK to set publicMetadata (trusted, server-only)
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role },
    });

    return NextResponse.json({ success: true, role });
  } catch (err) {
    console.error("[set-role] Error:", err);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    );
  }
}
