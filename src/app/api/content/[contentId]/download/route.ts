import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  getGuardedPublishedContent,
  recordContentDownload,
} from "@/lib/mongodb/content";
import { consumeDownload } from "@/lib/mongodb/download-quota";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { isAdminEmail } from "@/lib/auth/roles";
import { UserProfileModel } from "@/lib/mongodb/models";

/**
 * POST /api/content/[contentId]/download
 *
 * Auth required. Re-runs the access guard (so a user who recently
 * cancelled can't download via direct call), enforces the per-tier
 * monthly download quota (Free=0 · Basic=30 · Premium=∞), increments
 * `Content.downloadsCount`, and returns the resolved file URL plus
 * the up-to-date quota snapshot. Returns 403 when the caller lacks
 * the required plan or has exhausted their quota; the body still
 * tells the client the required tier so it can offer an upgrade CTA.
 *
 * Owners and admins always pass — neither pays for downloads.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to download." }, { status: 401 });
  }

  try {
    const { contentId } = await params;

    const guarded = await getGuardedPublishedContent(contentId);
    if (!guarded) {
      return NextResponse.json(
        { error: "Content not found." },
        { status: 404 }
      );
    }
    if (guarded.contentType !== "file") {
      return NextResponse.json(
        { error: "This content is not a downloadable file." },
        { status: 400 }
      );
    }
    if (!guarded.accessGranted) {
      return NextResponse.json(
        {
          error: "Subscribe to download this file.",
          requiredAccessLevel: guarded.requiredAccessLevel,
        },
        { status: 403 }
      );
    }

    // Owner and admin bypasses must skip quota — they aren't real
    // subscribers and don't have a Subscription row.
    await connectToMongoDB();
    const isOwner = userId === guarded.creatorClerkUserId;
    let isAdmin = false;
    if (!isOwner) {
      const profile = await UserProfileModel.findOne({ clerkUserId: userId });
      isAdmin = Boolean(profile?.email && isAdminEmail(profile.email));
    }

    let quotaSnapshot:
      | Awaited<ReturnType<typeof consumeDownload>>["quota"]
      | null = null;

    if (!isOwner && !isAdmin) {
      const consume = await consumeDownload({
        subscriberClerkUserId: userId,
        creatorClerkUserId: guarded.creatorClerkUserId,
      });
      quotaSnapshot = consume.quota;

      if (!consume.ok) {
        const upgradeMessage =
          consume.reason === "tier_blocked"
            ? "Your current plan does not include downloads. Upgrade to Basic or Premium to download files."
            : consume.reason === "quota_exhausted"
              ? `You've used all ${consume.quota.monthlyLimit ?? 0} downloads available this month. Upgrade to Premium for unlimited downloads or wait until the cycle resets.`
              : "Subscribe to this creator before downloading their files.";

        return NextResponse.json(
          {
            error: upgradeMessage,
            requiredAccessLevel: guarded.requiredAccessLevel,
            quota: consume.quota,
          },
          { status: 403 }
        );
      }
    }

    const result = await recordContentDownload(contentId);
    if (!result || !result.fileUrl) {
      return NextResponse.json(
        { error: "Download is currently unavailable." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ...result, quota: quotaSnapshot },
      { status: 200 }
    );
  } catch (error) {
    console.error("[content:download]", error);
    return NextResponse.json(
      { error: "Unable to record download." },
      { status: 500 }
    );
  }
}
