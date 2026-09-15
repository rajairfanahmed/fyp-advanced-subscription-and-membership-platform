import { NextResponse, type NextRequest } from "next/server";

import {
  applyAdminAccountStatus,
  deleteAdminUser,
} from "@/lib/account/admin-lifecycle";
import { adminErrorJson } from "@/lib/auth/admin-http";
import {
  assertConfirmationPhrase,
  auditAdmin,
  confirmationPhraseOf,
  requireAdminContext,
  requireAdminMutation,
} from "@/lib/auth/require-admin";
import { getAdminUserDetail } from "@/lib/mongodb/admin-stats";

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
    console.error("[admin:user:get]", error);
    return adminErrorJson(error, "Failed to load user.");
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAdminMutation(req);
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

    const data = await getAdminUserDetail(id);
    if (!data) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (wantStatus === "suspended") {
      assertConfirmationPhrase(
        confirmationPhraseOf(body),
        data.user.email,
        "Type the account email to suspend."
      );
    }

    const updated = await applyAdminAccountStatus({
      ctx,
      userIdOrClerkId: id,
      accountStatus: wantStatus,
    });
    await auditAdmin(ctx, req, {
      action: wantStatus === "suspended" ? "user.suspend" : "user.restore",
      targetType: "user",
      targetId: updated.user.clerkUserId,
      payload: { email: updated.user.email, accountStatus: wantStatus },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[admin:user:patch]", error);
    return adminErrorJson(error, "Failed to update user.");
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAdminMutation(req);
    const { id } = await context.params;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const data = await getAdminUserDetail(id);
    if (!data) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    assertConfirmationPhrase(
      confirmationPhraseOf(body),
      data.user.email,
      "Type the account email to delete."
    );

    const result = await deleteAdminUser({ ctx, userIdOrClerkId: id });
    await auditAdmin(ctx, req, {
      action: "user.delete",
      targetType: "user",
      targetId: result.clerkUserId,
      payload: { email: result.email, report: result.report },
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[admin:user:delete]", error);
    return adminErrorJson(error, "Failed to delete user.");
  }
}
