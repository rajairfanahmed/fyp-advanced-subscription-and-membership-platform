import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  ensureCurrentUserProfile,
  getCurrentUserProfileResponse,
  updateCurrentUserProfile,
  updateCurrentUserProfileFromFormData,
} from "@/lib/auth/profile-sync";
import { createNotification } from "@/lib/mongodb/notifications";
import { NotificationModel } from "@/lib/mongodb/models";

async function sendAccountUpdateNotification(clerkUserId: string) {
  try {
    // Avoid spamming the inbox: only one "Profile updated" entry per
    // 60-second window. This makes back-to-back saves (e.g. tweaking
    // the avatar after the display name) look natural in the feed.
    const recent = await NotificationModel.findOne({
      recipientClerkUserId: clerkUserId,
      category: "account",
      title: "Profile updated",
      createdAt: { $gte: new Date(Date.now() - 60_000) },
    });
    if (recent) return;

    await createNotification({
      recipientClerkUserId: clerkUserId,
      category: "account",
      title: "Profile updated",
      message: "Your account settings were updated successfully.",
      link: "/account",
    });
  } catch (error) {
    console.warn("[profile:patch] failed to write account notification", error);
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const profile = await getCurrentUserProfileResponse();
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[profile:get]", error);
    return NextResponse.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await ensureCurrentUserProfile({ updateLastLogin: true });
    const profile = await getCurrentUserProfileResponse();
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[profile:sync]", error);
    return NextResponse.json({ error: "Unable to sync profile." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const profile = await updateCurrentUserProfileFromFormData(await req.formData());
      if (profile) await sendAccountUpdateNotification(userId);
      return NextResponse.json({ profile });
    }

    const body = await req.json();
    const profile = await updateCurrentUserProfile(body);
    if (profile) await sendAccountUpdateNotification(userId);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[profile:patch]", error);
    return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
