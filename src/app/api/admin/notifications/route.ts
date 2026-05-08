import { NextResponse } from "next/server";

import { requireAdminContext } from "@/lib/auth/require-admin";
import { getAdminNotifications } from "@/lib/mongodb/admin-stats";
import { broadcastNotification } from "@/lib/mongodb/notifications";
import type { AdminBroadcastInput } from "@/types/admin-stats";

export async function GET() {
  try {
    await requireAdminContext();
    const data = await getAdminNotifications();
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load notifications.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:notifications GET]", error);
    return NextResponse.json({ error: message }, { status });
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
    await requireAdminContext();
    const body = (await request.json().catch(() => ({}))) as Partial<AdminBroadcastInput>;

    const audience = body.audience;
    if (!audience || !ALLOWED_AUDIENCES.includes(audience)) {
      return NextResponse.json(
        { error: "Invalid audience." },
        { status: 400 }
      );
    }
    if (typeof body.subject !== "string" || typeof body.body !== "string") {
      return NextResponse.json(
        { error: "Subject and body are required." },
        { status: 400 }
      );
    }

    const result = await broadcastNotification({
      audience,
      subject: body.subject,
      body: body.body,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Broadcast failed.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:notifications POST]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
