import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";
import type { Readable } from "stream";

import type {
  AllowedFileRule,
  StorageUploadCategory,
  StorageUploadInput,
  StorageUploadResult,
  StorageValidationResult,
} from "@/types/storage";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string | null;
};

let cachedClient: S3Client | null = null;
let cachedConfig: R2Config | null = null;

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"] as const;

// Per-asset upload size ceilings. Cloudflare R2's single PutObject can
// take up to 5 GB, but for browser uploads we keep things conservative
// so the round-trip never has to be cancelled and so the upstream API
// doesn't sit on huge in-flight bodies.
const MEGABYTE = 1024 * 1024;
const IMAGE_MAX_BYTES = 8 * MEGABYTE; // avatars, banners, thumbnails, covers
const VIDEO_MAX_BYTES = 500 * MEGABYTE; // creator videos
const DOWNLOADABLE_MAX_BYTES = 200 * MEGABYTE; // PDFs, ZIPs, RARs

export const STORAGE_LIMITS = {
  imageMaxBytes: IMAGE_MAX_BYTES,
  videoMaxBytes: VIDEO_MAX_BYTES,
  downloadableMaxBytes: DOWNLOADABLE_MAX_BYTES,
} as const;

export const STORAGE_FILE_RULES: Record<StorageUploadCategory, AllowedFileRule> = {
  profileAvatar: {
    category: "profileAvatar",
    mimeTypes: IMAGE_MIME_TYPES,
    extensions: IMAGE_EXTENSIONS,
    maxSizeBytes: IMAGE_MAX_BYTES,
  },
  creatorAvatar: {
    category: "creatorAvatar",
    mimeTypes: IMAGE_MIME_TYPES,
    extensions: IMAGE_EXTENSIONS,
    maxSizeBytes: IMAGE_MAX_BYTES,
  },
  creatorBanner: {
    category: "creatorBanner",
    mimeTypes: IMAGE_MIME_TYPES,
    extensions: IMAGE_EXTENSIONS,
    maxSizeBytes: IMAGE_MAX_BYTES,
  },
  videoThumbnail: {
    category: "videoThumbnail",
    mimeTypes: IMAGE_MIME_TYPES,
    extensions: IMAGE_EXTENSIONS,
    maxSizeBytes: IMAGE_MAX_BYTES,
  },
  articleThumbnail: {
    category: "articleThumbnail",
    mimeTypes: IMAGE_MIME_TYPES,
    extensions: IMAGE_EXTENSIONS,
    maxSizeBytes: IMAGE_MAX_BYTES,
  },
  fileCover: {
    category: "fileCover",
    mimeTypes: IMAGE_MIME_TYPES,
    extensions: IMAGE_EXTENSIONS,
    maxSizeBytes: IMAGE_MAX_BYTES,
  },
  videoFile: {
    category: "videoFile",
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    extensions: [".mp4", ".mov", ".webm"],
    maxSizeBytes: VIDEO_MAX_BYTES,
  },
  downloadableFile: {
    category: "downloadableFile",
    // Browsers report ZIP and RAR archives under a wide range of mime
    // strings depending on the OS, the file's origin and whether the
    // user uploaded the archive itself or a version that was renamed.
    // We accept every common variant we've seen in the wild plus the
    // generic `application/octet-stream` fallback. Extension-based
    // validation (.pdf / .zip / .rar) still gates the file so this is
    // safe.
    mimeTypes: [
      "application/pdf",
      // ZIP variants
      "application/zip",
      "application/x-zip",
      "application/x-zip-compressed",
      "application/x-compressed",
      "multipart/x-zip",
      // RAR variants
      "application/vnd.rar",
      "application/x-rar",
      "application/x-rar-compressed",
      "application/rar",
      // Universal fallback
      "application/octet-stream",
    ],
    extensions: [".pdf", ".zip", ".rar"],
    maxSizeBytes: DOWNLOADABLE_MAX_BYTES,
  },
};

const CATEGORY_PREFIX: Record<StorageUploadCategory, string> = {
  profileAvatar: "avatars/profiles",
  creatorAvatar: "avatars/creators",
  creatorBanner: "banners/creators",
  videoThumbnail: "thumbnails/videos",
  articleThumbnail: "thumbnails/articles",
  fileCover: "covers/files",
  videoFile: "content/videos",
  downloadableFile: "content/downloads",
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing. Add Cloudflare R2 credentials to .env.local before using storage uploads.`);
  }
  return value;
}

function getR2Config(): R2Config {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    accountId: requiredEnv("CLOUDFLARE_R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    bucketName: requiredEnv("CLOUDFLARE_R2_BUCKET_NAME"),
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim().replace(/\/+$/, "") || null,
  };

  return cachedConfig;
}

export function getCloudflareR2Client() {
  if (cachedClient) return cachedClient;

  const config = getR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

function normalizeContentType(contentType: string) {
  return contentType.trim().toLowerCase().split(";")[0];
}

function getSafeExtension(fileName: string) {
  return path.extname(fileName).trim().toLowerCase();
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validateStorageFile(input: {
  category: StorageUploadCategory;
  fileName: string;
  contentType: string;
  sizeBytes?: number;
}): StorageValidationResult {
  const rule = STORAGE_FILE_RULES[input.category];
  if (!rule) {
    return { ok: false, reason: "Unsupported upload category." };
  }

  const contentType = normalizeContentType(input.contentType);
  const extension = getSafeExtension(input.fileName);

  if (!rule.mimeTypes.includes(contentType)) {
    return { ok: false, reason: `${input.category} does not allow ${contentType || "unknown content type"}.` };
  }

  if (!rule.extensions.includes(extension)) {
    return { ok: false, reason: `${input.category} does not allow ${extension || "files without an extension"}.` };
  }

  if (rule.maxSizeBytes && input.sizeBytes && input.sizeBytes > rule.maxSizeBytes) {
    return { ok: false, reason: `${input.category} exceeds the allowed file size.` };
  }

  return { ok: true, extension, contentType };
}

export function createStorageObjectKey(input: {
  category: StorageUploadCategory;
  clerkUserId: string;
  fileName: string;
}) {
  const prefix = CATEGORY_PREFIX[input.category];
  const userSegment = sanitizeSegment(input.clerkUserId);
  const extension = getSafeExtension(input.fileName);
  const dateSegment = new Date().toISOString().slice(0, 10);
  const objectId = randomUUID();

  return `${prefix}/${userSegment}/${dateSegment}/${objectId}${extension}`;
}

function createPublicUrl(key: string) {
  const config = getR2Config();
  return config.publicUrl ? `${config.publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}` : null;
}

export async function uploadToCloudflareR2(input: StorageUploadInput): Promise<StorageUploadResult> {
  if (!input.clerkUserId.trim()) {
    throw new Error("clerkUserId is required to create a scoped storage object key.");
  }

  const validation = validateStorageFile(input);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const config = getR2Config();
  const key = createStorageObjectKey(input);

  // Compute the body length up-front so we can hand the AWS SDK a
  // concrete `ContentLength`. R2 occasionally rejects chunked-transfer
  // PutObjects (no `Content-Length`), so always passing a fixed length
  // avoids "the request signature we calculated does not match" /
  // 400 errors on otherwise-valid uploads.
  let bodyLength: number | undefined;
  if (typeof input.body === "string") {
    bodyLength = Buffer.byteLength(input.body);
  } else if (input.body instanceof Buffer) {
    bodyLength = input.body.length;
  } else if (input.body instanceof Uint8Array) {
    bodyLength = input.body.byteLength;
  } else if (typeof input.sizeBytes === "number" && input.sizeBytes > 0) {
    bodyLength = input.sizeBytes;
  }

  await getCloudflareR2Client().send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: input.body,
      ContentType: validation.contentType,
      ...(bodyLength !== undefined ? { ContentLength: bodyLength } : {}),
    })
  );

  return {
    key,
    publicUrl: createPublicUrl(key),
    bucketName: config.bucketName,
    contentType: validation.contentType,
    sizeBytes: bodyLength ?? input.sizeBytes,
  };
}

/**
 * Streams the request body straight to Cloudflare R2 without buffering
 * the whole payload in memory. We use this from
 * `POST /api/storage/upload` for video files, downloadable files and
 * thumbnails so that:
 *
 *   1. Next.js never has to parse a multipart/form-data body — that
 *      parser is what surfaces "Failed to parse body as FormData" /
 *      "Could not parse the upload" on large videos.
 *   2. The Node process never holds the whole file in memory; the
 *      bytes flow Browser → Next.js → R2 chunk by chunk.
 *
 * `sizeBytes` is required and forwarded to S3 via `ContentLength` so
 * R2 can validate the body length and avoid chunked-transfer
 * surprises on the upstream PutObject.
 */
export async function uploadStreamToCloudflareR2(input: {
  category: StorageUploadCategory;
  clerkUserId: string;
  fileName: string;
  contentType: string;
  body: Readable | Buffer | Uint8Array;
  sizeBytes: number;
}): Promise<StorageUploadResult> {
  if (!input.clerkUserId.trim()) {
    throw new Error("clerkUserId is required to create a scoped storage object key.");
  }

  const validation = validateStorageFile({
    category: input.category,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  if (!input.sizeBytes || input.sizeBytes <= 0) {
    throw new Error("Upload size is required for streaming uploads.");
  }

  const config = getR2Config();
  const key = createStorageObjectKey(input);

  await getCloudflareR2Client().send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: input.body,
      ContentType: validation.contentType,
      ContentLength: input.sizeBytes,
    })
  );

  return {
    key,
    publicUrl: createPublicUrl(key),
    bucketName: config.bucketName,
    contentType: validation.contentType,
    sizeBytes: input.sizeBytes,
  };
}

export async function deleteFromCloudflareR2(key: string) {
  if (!key || key.includes("..") || key.startsWith("/")) {
    throw new Error("A valid storage object key is required for deletion.");
  }

  const config = getR2Config();
  await getCloudflareR2Client().send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );

  return { key, deleted: true };
}
