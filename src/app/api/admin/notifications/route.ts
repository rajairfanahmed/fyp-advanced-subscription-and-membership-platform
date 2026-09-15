import { NextResponse, type NextRequest } from "next/server";

import { parseAdminListQuery } from "@/lib/auth/admin-list-query";
import { adminErrorJson } from "@/lib/auth/admin-http";
import {
  assertConfirmationPhrase,
  auditAdmin,
  confirmationPhraseOf,
  requireAdminContext,
  requireAdminMutation,
} from "@/lib/auth/require-admin";
import { getAdminNotifications } from "@/lib/mongodb/admin-stats";
import { broadcastNotification } from "@/lib/mongodb/notifications";
import type { AdminBroadcastInput } from "@/types/admin-stats";

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const list = parseAdminListQuery(req.nextUrl.searchParams);
    const data = await getAdminNotifications(list);
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[admin:notifications GET]", error);
    return adminErrorJson(error, "Failed to load notifications.");
  }
}

const ALLOWED_AUDIENCES: AdminBroadcastInput["audience"][] = [
  "all",
  "subscribers",
  "creators",
  "admins",
];

export async function POST(request: Request) {
  try {
    const ctx = await requireAdminMutation(request);
    const body = (await request.json().catch(() => ({}))) as Partial<AdminBroadcastInput> & {
      confirmationPhrase?: string;
    };

    const audience = body.audience;
    if (!audience || !ALLOWED_AUDIENCES.includes(audience)) {
      return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
    }
    if (typeof body.subject !== "string" || typeof body.body !== "string") {
      return NextResponse.json(
        { error: "Subject and body are required." },
        { status: 400 }
      );
    }

    const dryRun = Boolean(body.dryRun);
    if (!dryRun) {
      assertConfirmationPhrase(
        confirmationPhraseOf(body),
        "BROADCAST",
        "Type BROADCAST to send this message."
      );
    }

    const result = await broadcastNotification({
      audience,
      subject: body.subject,
      body: body.body,
      dryRun,
    });
    await auditAdmin(ctx, request, {
      action: dryRun ? "broadcast.dry_run" : "broadcast.send",
      targetType: "notification",
      payload: { audience, recipientsCount: result.recipientsCount, dryRun },
    });
    return NextResponse.json(result, { status: dryRun ? 200 : 201 });
  } catch (error) {
    console.error("[admin:notifications POST]", error);
    return adminErrorJson(error, "Broadcast failed.");
  }
}
