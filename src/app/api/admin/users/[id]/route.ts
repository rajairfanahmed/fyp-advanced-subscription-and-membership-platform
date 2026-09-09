import { NextResponse, type NextRequest } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import {
  getAdminUserDetail,
  updateAdminUserStatus,
} from "@/lib/mongodb/admin-stats";

/**
 * GET /api/admin/users/[id]
 * Returns full user detail with subscriptions, payments, and rolled
 * up metrics. The `id` may be either the Mongo `_id` of the
 * UserProfile or the Clerk user id — both resolve.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminContext();
    const { id } = await context.params;
    const data = await getAdminUserDetail(id);
    if (!data) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:user:get]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Body: { accountStatus: "active" | "suspended" }
 *
 * Suspend or restore a user account. The auth/identity layer (Clerk)
 * isn't touched here — only our `UserProfile.accountStatus`. Suspended
 * users can still sign in, but checkout, subscribe, download, uploads,
 * and creator mutations reject the account until it is restored.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminContext();
    const { id } = await context.params;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const wantStatus = String(
      (body as { accountStatus?: unknown }).accountStatus ?? ""
    ).toLowerCase();

    if (wantStatus !== "active" && wantStatus !== "suspended") {
      return NextResponse.json(
        { error: "`accountStatus` must be 'active' or 'suspended'." },
        { status: 400 }
      );
    }

    const data = await updateAdminUserStatus({
      userIdOrClerkId: id,
      accountStatus: wantStatus,
    });
    if (!data) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update user.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:user:patch]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
