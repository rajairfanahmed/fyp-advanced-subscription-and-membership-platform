import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  getGuardedPublishedContent,
  recordContentDownload,
} from "@/lib/mongodb/content";
import { consumeDownload, type DownloadQuotaSnapshot } from "@/lib/mongodb/download-quota";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { isAdminEmail } from "@/lib/auth/roles";
import { UserProfileModel } from "@/lib/mongodb/models";
import { subscribeCurrentUserToFreeTier } from "@/lib/mongodb/subscriptions";
import { getObjectFromCloudflareR2 } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/content/[contentId]/download
 *
 * Auth required. Re-runs the access guard, enforces the per-tier
 * monthly download quota (Free=5 · Basic=30 · Premium=∞), increments
 * `Content.downloadsCount`, and streams the file with
 * `Content-Disposition: attachment` so PDFs download like ZIP/RAR
 * instead of opening in the browser (which would let the subscriber
 * save the same file many times after a single quota hit).
 *
 * Free-tier files without a Follow row auto-create the free membership
 * so the 5/month quota is actually counted.
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

    await connectToMongoDB();
    const profile = await UserProfileModel.findOne({ clerkUserId: userId });
    const isAdmin = Boolean(profile?.email && isAdminEmail(profile.email));
    if (profile?.accountStatus === "suspended" && !isAdmin) {
      return NextResponse.json(
        { error: "This account is suspended." },
        { status: 403 }
      );
    }

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

    const isOwner = userId === guarded.creatorClerkUserId;

    let quotaSnapshot: DownloadQuotaSnapshot | null = null;

    if (!isOwner && !isAdmin) {
      let consume = await consumeDownload({
        subscriberClerkUserId: userId,
        creatorClerkUserId: guarded.creatorClerkUserId,
      });
      quotaSnapshot = consume.quota;

      if (!consume.ok && consume.reason === "no_subscription") {
        try {
          await subscribeCurrentUserToFreeTier({
            creatorClerkUserId: guarded.creatorClerkUserId,
          });
          consume = await consumeDownload({
            subscriberClerkUserId: userId,
            creatorClerkUserId: guarded.creatorClerkUserId,
          });
          quotaSnapshot = consume.quota;
        } catch (error) {
          console.warn("[content:download:free-follow]", error);
        }
      }

      if (!consume.ok) {
        const creatorLabel = guarded.creatorName || "this creator";
        const upgradeMessage =
          consume.reason === "tier_blocked"
            ? `Your current plan does not include downloads. Subscribe to ${creatorLabel} on Basic or Premium to download files.`
            : consume.reason === "quota_exhausted"
              ? `You've used all ${consume.quota.monthlyLimit ?? 0} downloads available this month from ${creatorLabel}. Upgrade to Premium for unlimited downloads or wait until the cycle resets.`
              : `Follow ${creatorLabel} before downloading their files.`;

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
    if (!result || (!result.fileKey && !result.fileUrl)) {
      return NextResponse.json(
        { error: "Download is currently unavailable." },
        { status: 404 }
      );
    }

    const fileName = attachmentFileName(
      result.fileName,
      result.fileSubtype || guarded.fileSubtype,
      result.fileKey
    );

    let webStream: ReadableStream;
    let contentLength: number | undefined;

    if (result.fileKey) {
      const object = await getObjectFromCloudflareR2(result.fileKey);
      webStream = object.webStream;
      contentLength = object.contentLength;
    } else {
      const upstream = await fetch(result.fileUrl);
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { error: "Download is currently unavailable." },
          { status: 404 }
        );
      }
      webStream = upstream.body;
      const lengthHeader = upstream.headers.get("content-length");
      if (lengthHeader) {
        const parsed = Number.parseInt(lengthHeader, 10);
        if (Number.isFinite(parsed) && parsed > 0) contentLength = parsed;
      }
    }

    const headers = new Headers({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": contentDispositionAttachment(fileName),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (contentLength) {
      headers.set("Content-Length", String(contentLength));
    }
    applyQuotaHeaders(headers, quotaSnapshot);

    return new NextResponse(webStream, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "This account is suspended.") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[content:download]", error);
    return NextResponse.json(
      { error: "Unable to record download." },
      { status: 500 }
    );
  }
}

function applyQuotaHeaders(headers: Headers, quota: DownloadQuotaSnapshot | null) {
  if (!quota) return;
  headers.set(
    "X-Download-Quota-Remaining",
    quota.remaining === null ? "unlimited" : String(quota.remaining)
  );
  headers.set(
    "X-Download-Quota-Limit",
    quota.monthlyLimit === null ? "unlimited" : String(quota.monthlyLimit)
  );
  headers.set("X-Download-Quota-Access-Level", quota.accessLevel);
  headers.set("X-Download-Quota-Window-End", quota.windowEnd);
}

function attachmentFileName(
  title: string,
  fileSubtype: string,
  fileKey: string
) {
  const extFromKey = fileKey.split(".").pop()?.toLowerCase() || "";
  const subtype = fileSubtype.toLowerCase();
  const ext = ["pdf", "zip", "rar"].includes(subtype)
    ? subtype
    : ["pdf", "zip", "rar"].includes(extFromKey)
      ? extFromKey
      : "bin";
  const base =
    title
      .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 120) || "download";
  if (base.toLowerCase().endsWith(`.${ext}`)) return base;
  return `${base}.${ext}`;
}

function contentDispositionAttachment(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
