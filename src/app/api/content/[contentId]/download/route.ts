import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { consumeDenyMessage } from "@/lib/account/status";
import {
  getGuardedPublishedContent,
  recordContentDownload,
} from "@/lib/mongodb/content";
import {
  consumeDownload,
  releaseDownload,
  type DownloadQuotaSnapshot,
} from "@/lib/mongodb/download-quota";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { isAdminEmail } from "@/lib/auth/roles";
import { UserProfileModel } from "@/lib/mongodb/models";
import { subscribeCurrentUserToFreeTier } from "@/lib/mongodb/subscriptions";
import { getObjectFromCloudflareR2, storageKeyFromPublicUrl } from "@/lib/storage";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { PRIVATE_NO_STORE } from "@/lib/http/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to download." },
      { status: 401, headers: PRIVATE_NO_STORE }
    );
  }

  const ip = clientIp(req);
  const perUser = rateLimit(`download:${userId}`, 20, 15 * 60 * 1000);
  const perIp = rateLimit(`download:${ip}`, 40, 15 * 60 * 1000);
  if (!perUser.ok || !perIp.ok) {
    const blocked = !perUser.ok ? perUser : perIp;
    return NextResponse.json(
      { error: "Too many download attempts. Please wait and try again." },
      { status: 429, headers: { ...PRIVATE_NO_STORE, ...rateLimitHeaders(blocked) } }
    );
  }

  let reservedQuota = false;

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
    if (guarded.contentType !== "file") {
      return NextResponse.json(
        { error: "This content is not a downloadable file." },
        { status: 400, headers: PRIVATE_NO_STORE }
      );
    }
    if (!guarded.accessGranted) {
      return NextResponse.json(
        {
          error:
            consumeDenyMessage(guarded.denyReason) ??
            "Subscribe to download this file.",
          requiredAccessLevel: guarded.requiredAccessLevel,
        },
        { status: 403, headers: PRIVATE_NO_STORE }
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
              : consume.reason === "access_revoked"
                ? `Your membership with ${creatorLabel} is no longer active. Update billing or subscribe again to download.`
                : `Follow ${creatorLabel} before downloading their files.`;

        return NextResponse.json(
          {
            error: upgradeMessage,
            requiredAccessLevel: guarded.requiredAccessLevel,
            quota: consume.quota,
          },
          { status: 403, headers: PRIVATE_NO_STORE }
        );
      }
      reservedQuota = true;
    }

    const result = await recordContentDownload(contentId);
    const objectKey =
      result?.fileKey ||
      (result?.fileUrl ? storageKeyFromPublicUrl(result.fileUrl) : "") ||
      "";
    if (!result || !objectKey) {
      if (reservedQuota) {
        await releaseDownload({
          subscriberClerkUserId: userId,
          creatorClerkUserId: guarded.creatorClerkUserId,
        }).catch(() => {});
      }
      return NextResponse.json(
        { error: "Download is currently unavailable." },
        { status: 404, headers: PRIVATE_NO_STORE }
      );
    }

    const fileName = attachmentFileName(
      result.fileName,
      result.fileSubtype || guarded.fileSubtype,
      objectKey
    );

    const object = await getObjectFromCloudflareR2(objectKey);
    const headers = new Headers({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": contentDispositionAttachment(fileName),
      ...PRIVATE_NO_STORE,
      "X-Content-Type-Options": "nosniff",
    });
    if (object.contentLength) {
      headers.set("Content-Length", String(object.contentLength));
    }
    applyQuotaHeaders(headers, quotaSnapshot);

    return new NextResponse(object.webStream, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "This account is suspended.") {
      return NextResponse.json({ error: message }, { status: 403, headers: PRIVATE_NO_STORE });
    }
    if (reservedQuota && userId) {
      try {
        const { contentId } = await params;
        const guarded = await getGuardedPublishedContent(contentId);
        if (guarded?.creatorClerkUserId) {
          await releaseDownload({
            subscriberClerkUserId: userId,
            creatorClerkUserId: guarded.creatorClerkUserId,
          });
        }
      } catch {
        // already failing
      }
    }
    console.error("[content:download]", error);
    return NextResponse.json(
      { error: "Unable to record download." },
      { status: 500, headers: PRIVATE_NO_STORE }
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
