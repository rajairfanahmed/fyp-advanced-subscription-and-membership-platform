import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  deleteCurrentUserNotification,
  markCurrentUserNotificationRead,
} from "@/lib/mongodb/notifications";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/notifications/[id]
 * Body: { isRead: boolean }  — defaults to true if omitted.
 */
export async function PATCH(req: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const isRead =
    typeof (body as { isRead?: unknown }).isRead === "boolean"
      ? Boolean((body as { isRead?: unknown }).isRead)
      : true;

  try {
    const updated = await markCurrentUserNotificationRead(id, isRead);
    if (!updated) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[notifications:patch]", error);
    return NextResponse.json(
      { error: "Failed to update notification." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/[id]
 */
export async function DELETE(_req: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const ok = await deleteCurrentUserNotification(id);
    if (!ok) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[notifications:delete]", error);
    return NextResponse.json(
      { error: "Failed to delete notification." },
      { status: 500 }
    );
  }
}
