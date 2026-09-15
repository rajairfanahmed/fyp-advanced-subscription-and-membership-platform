import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { consumeDenyMessage } from "@/lib/account/status";
import {
  getGuardedPublishedContent,
  getPublishedMediaKeys,
} from "@/lib/mongodb/content";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { isAdminEmail } from "@/lib/auth/roles";
import { UserProfileModel } from "@/lib/mongodb/models";
import { PRIVATE_NO_STORE } from "@/lib/http/cache";
import { getObjectFromCloudflareR2, storageKeyFromPublicUrl } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSafeExternalVideoUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "youtu.be" ||
      host === "www.youtu.be" ||
      host.endsWith(".youtube.com") ||
      host === "vimeo.com" ||
      host === "www.vimeo.com" ||
      host.endsWith(".vimeo.com") ||
      host === "player.vimeo.com"
    );
  } catch {
    return false;
  }
}

/**
 * GET /api/content/[contentId]/playback
 *
 * Authenticated, access-checked video bytes (Range-aware) or JSON for
 * an allowlisted external host. Object URLs are never returned in content JSON.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to watch." },
      { status: 401, headers: PRIVATE_NO_STORE }
    );
  }

  try {
    const { contentId } = await params;
    await connectToMongoDB();
    const profile = await UserProfileModel.findOne({ clerkUserId: userId });
    const isAdmin = Boolean(profile?.email && isAdminEmail(profile.email));
    if (profile?.accountStatus === "suspended" && !isAdmin) {
      return NextResponse.json(
        { error: "This account is suspended." },
        { status: 403, headers: PRIVATE_NO_STORE }
      );
    }

    const guarded = await getGuardedPublishedContent(contentId);
    if (!guarded) {
      return NextResponse.json(
        { error: "Content not found." },
        { status: 404, headers: PRIVATE_NO_STORE }
      );
    }
    if (guarded.contentType !== "video") {
      return NextResponse.json(
        { error: "This content is not a video." },
        { status: 400, headers: PRIVATE_NO_STORE }
      );
    }
    if (!guarded.accessGranted) {
      return NextResponse.json(
        {
          error:
            consumeDenyMessage(guarded.denyReason) ??
            "Subscribe to watch this video.",
          requiredAccessLevel: guarded.requiredAccessLevel,
        },
        { status: 403, headers: PRIVATE_NO_STORE }
      );
    }

    const media = await getPublishedMediaKeys(contentId);
    if (!media) {
      return NextResponse.json(
        { error: "Content not found." },
        { status: 404, headers: PRIVATE_NO_STORE }
      );
    }

    if (media.videoProvider === "external" || media.externalVideoUrl) {
      if (!isSafeExternalVideoUrl(media.externalVideoUrl)) {
        return NextResponse.json(
          { error: "Playback is currently unavailable." },
          { status: 404, headers: PRIVATE_NO_STORE }
        );
      }
      return NextResponse.json(
        { kind: "external", url: media.externalVideoUrl },
        { status: 200, headers: PRIVATE_NO_STORE }
      );
    }

    const key =
      media.videoKey ||
      storageKeyFromPublicUrl(media.videoUrl) ||
      "";
    if (!key) {
      return NextResponse.json(
        { error: "Playback is currently unavailable." },
        { status: 404, headers: PRIVATE_NO_STORE }
      );
    }

    const range = req.headers.get("range");
    const object = await getObjectFromCloudflareR2(key, { range });
    const headers = new Headers({
      ...PRIVATE_NO_STORE,
      "Content-Type": object.contentType || "video/mp4",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });
    if (object.contentLength) {
      headers.set("Content-Length", String(object.contentLength));
    }
    if (object.contentRange) {
      headers.set("Content-Range", object.contentRange);
    }

    return new NextResponse(object.webStream, {
      status: object.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "This account is suspended.") {
      return NextResponse.json({ error: message }, { status: 403, headers: PRIVATE_NO_STORE });
    }
    console.error("[content:playback]", error);
    return NextResponse.json(
      { error: "Unable to start playback." },
      { status: 500, headers: PRIVATE_NO_STORE }
    );
  }
}
