import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { connectToMongoDB } from "@/lib/mongodb/connect";
import { UserProfileModel } from "@/lib/mongodb/models";
import { isAdminEmail } from "@/lib/auth/roles";
import { STORAGE_FILE_RULES, uploadToCloudflareR2 } from "@/lib/storage";
import type { StorageUploadCategory } from "@/types/storage";

/**
 * Raw-body upload endpoint. The browser sends the file bytes as the
 * request body (NOT multipart/form-data) and we hand them straight to
 * Cloudflare R2 via a single PutObject.
 *
 * We deliberately read the body into a `Buffer` instead of streaming
 * `Readable.fromWeb(req.body)` directly to S3. Streaming the Web
 * ReadableStream sometimes fails with cryptic "Cannot read properties
 * of undefined" errors against R2 when the AWS SDK switches to
 * chunked transfer encoding mid-flight, especially on Windows + Node
 * combinations where backpressure isn't propagated cleanly. Buffering
 * up to our `maxSizeBytes` ceiling (500 MB for video, 200 MB for
 * downloadable files) is well within the App Router 4 GB body cap and
 * makes the upload deterministic.
 *
 * Required:
 *   - `?category=videoFile|videoThumbnail|articleThumbnail|fileCover|downloadableFile`
 *   - `?fileName=<original filename, used for extension validation>`
 *   - `Content-Type` header set to the file's mime type
 *   - `X-File-Size` header (or `Content-Length`) with byte count
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED_CONTENT_CATEGORIES: ReadonlyArray<StorageUploadCategory> = [
  "videoThumbnail",
  "articleThumbnail",
  "fileCover",
  "videoFile",
  "downloadableFile",
];

function badRequest(error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Only creators (or admins acting as creators) may upload content
  // assets. Direct MongoDB lookup avoids an extra Clerk round-trip
  // (Clerk's `currentUser()` is what surfaced as the "internal
  // connectivity issue" overlay during long uploads).
  try {
    await connectToMongoDB();
  } catch (error) {
    console.error("[storage:upload] mongo connect failed", error);
    return NextResponse.json(
      { error: "Database is unreachable. Please retry in a moment." },
      { status: 503 }
    );
  }

  const profile = await UserProfileModel.findOne(
    { clerkUserId: userId },
    { role: 1, email: 1 }
  ).lean();

  const isAdmin = profile?.email ? isAdminEmail(profile.email) : false;
  if (!profile || (profile.role !== "creator" && !isAdmin)) {
    return NextResponse.json(
      {
        error:
          "Only creator accounts can upload content assets. If you just signed up, refresh the page and try again.",
      },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const categoryRaw = url.searchParams.get("category");
  const fileNameRaw = url.searchParams.get("fileName");
  const contentTypeHeader = (req.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();

  const sizeHeader =
    req.headers.get("x-file-size") || req.headers.get("content-length") || "0";
  const sizeBytes = Number.parseInt(sizeHeader, 10);

  if (!categoryRaw || !ALLOWED_CONTENT_CATEGORIES.includes(categoryRaw as StorageUploadCategory)) {
    return badRequest("Invalid or missing category.", { categoryRaw });
  }
  const category = categoryRaw as StorageUploadCategory;

  const fileName = (fileNameRaw || "").trim();
  if (!fileName) {
    return badRequest("Missing fileName.");
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return badRequest("Missing or invalid file size.", { sizeHeader });
  }

  const rule = STORAGE_FILE_RULES[category];
  if (rule.maxSizeBytes && sizeBytes > rule.maxSizeBytes) {
    return NextResponse.json(
      {
        error: `${category} is too large (${Math.round(sizeBytes / (1024 * 1024))} MB). Max allowed is ${Math.round(rule.maxSizeBytes / (1024 * 1024))} MB.`,
      },
      { status: 413 }
    );
  }

  if (!req.body) {
    return badRequest("Empty request body.");
  }

  // Make sure the R2 environment is fully configured. We surface a
  // dedicated error message instead of letting `requiredEnv` blow up
  // inside the SDK call — that previously came back as a generic 400
  // and made the failure look like a network hiccup.
  const r2Env = {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim(),
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim(),
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim(),
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim(),
  };
  if (!r2Env.accountId || !r2Env.accessKeyId || !r2Env.secretAccessKey || !r2Env.bucketName) {
    console.error("[storage:upload] R2 credentials missing", {
      hasAccountId: Boolean(r2Env.accountId),
      hasAccessKeyId: Boolean(r2Env.accessKeyId),
      hasSecretAccessKey: Boolean(r2Env.secretAccessKey),
      hasBucketName: Boolean(r2Env.bucketName),
    });
    return NextResponse.json(
      {
        error:
          "Cloudflare R2 storage is not fully configured on the server. Set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, and CLOUDFLARE_R2_BUCKET_NAME in .env.local and restart the dev server.",
      },
      { status: 500 }
    );
  }

  let bodyBuffer: Buffer;
  try {
    // Buffer the whole upload before talking to R2. This makes
    // `PutObject` deterministic — we always send a fixed-length
    // Content-Length and never get truncated by chunked-transfer
    // edge cases that streaming via `Readable.fromWeb` was hitting.
    const arrayBuffer = await req.arrayBuffer();
    bodyBuffer = Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("[storage:upload] failed reading request body", {
      err: error instanceof Error ? error.message : String(error),
      sizeBytes,
      contentType: contentTypeHeader,
    });
    return badRequest(
      "Could not read the upload body. The connection may have dropped — please retry.",
    );
  }

  if (bodyBuffer.length === 0) {
    return badRequest("Upload body was empty.");
  }

  // Sanity check: the bytes the server actually received must match
  // the size the client claimed. Mismatch usually means the request
  // was truncated (firewall, antivirus, browser extension, or VPN).
  if (Math.abs(bodyBuffer.length - sizeBytes) > 8 * 1024) {
    console.warn("[storage:upload] size mismatch", {
      claimed: sizeBytes,
      actual: bodyBuffer.length,
    });
  }

  try {
    const result = await uploadToCloudflareR2({
      category,
      clerkUserId: userId,
      fileName,
      contentType: contentTypeHeader,
      body: bodyBuffer,
      sizeBytes: bodyBuffer.length,
    });

    if (!result.publicUrl) {
      return NextResponse.json(
        {
          error:
            "Cloudflare R2 public URL is not configured. Set CLOUDFLARE_R2_PUBLIC_URL in .env.local and restart the dev server.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      key: result.key,
      publicUrl: result.publicUrl,
      sizeBytes: result.sizeBytes ?? bodyBuffer.length,
      contentType: result.contentType,
    });
  } catch (error) {
    // Fully detailed log so we can pinpoint R2 failures (signature,
    // bucket missing, mime mismatch, etc.) instead of guessing.
    const errAny = error as { name?: string; message?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
    console.error("[storage:upload] r2 PutObject failed", {
      name: errAny?.name,
      code: errAny?.Code,
      httpStatus: errAny?.$metadata?.httpStatusCode,
      message: errAny?.message,
      category,
      fileName,
      contentType: contentTypeHeader,
      sizeBytes: bodyBuffer.length,
    });

    const message =
      error instanceof Error && error.message
        ? `Upload failed: ${error.message}`
        : "Upload failed. Please retry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
