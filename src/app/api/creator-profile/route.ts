import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  getCurrentCreatorProfileResponse,
  updateCurrentCreatorProfile,
  updateCurrentCreatorProfileFromFormData,
} from "@/lib/auth/profile-sync";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const profile = await getCurrentCreatorProfileResponse();
    if (!profile) {
      return NextResponse.json({ error: "Creator profile not available." }, { status: 403 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[creator-profile:get]", error);
    return NextResponse.json({ error: "Unable to load creator profile." }, { status: 500 });
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
      const profile = await updateCurrentCreatorProfileFromFormData(await req.formData());
      if (!profile) {
        return NextResponse.json({ error: "Only creators can update creator profiles." }, { status: 403 });
      }

      return NextResponse.json({ profile });
    }

    const body = await req.json();
    const profile = await updateCurrentCreatorProfile(body);
    if (!profile) {
      return NextResponse.json({ error: "Only creators can update creator profiles." }, { status: 403 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[creator-profile:patch]", error);
    return NextResponse.json({ error: "Unable to update creator profile." }, { status: 500 });
  }
}
