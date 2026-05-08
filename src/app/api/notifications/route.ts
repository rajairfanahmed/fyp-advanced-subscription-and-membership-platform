import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  listCurrentUserNotifications,
  markAllCurrentUserNotificationsRead,
} from "@/lib/mongodb/notifications";

/**
 * GET /api/notifications
 * Returns the current user's inbox + counts.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const result = await listCurrentUserNotifications();
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[notifications:list]", error);
    return NextResponse.json(
      { error: "Failed to load notifications." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Marks every notification for the current user as read.
 */
export async function PATCH() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const { updatedCount } = await markAllCurrentUserNotificationsRead();
    return NextResponse.json({ updatedCount }, { status: 200 });
  } catch (error) {
    console.error("[notifications:mark-all-read]", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read." },
      { status: 500 }
    );
  }
}
