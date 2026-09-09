import { isRecordId } from "@/lib/db/ids";
import { auth } from "@clerk/nextjs/server";

import {
  assertAccountIsActive,
  ensureCurrentUserProfile,
} from "@/lib/auth/profile-sync";
import { isAdminEmail } from "@/lib/auth/roles";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  ContentModel,
  CreatorProfileModel,
  SubscriptionModel,
  UserProfileModel,
  type ContentDocument,
  type CreatorProfileDocument,
} from "@/lib/mongodb/models";
import { deleteFromCloudflareR2 } from "@/lib/storage";
import { recalcCreatorContentCount } from "@/lib/mongodb/creator-counts";
import type {
  ContentResponse,
  ContentStatus,
  ContentType,
  FileSubtype,
  RequiredPlan,
} from "@/types/content";

const ACCESS_RANK: Record<RequiredPlan, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

/** Subscription rows that still grant paid content access (incl. Stripe grace). */
const PAID_ACCESS_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"] as const;

async function subscriberMaxAccessRankByCreator(subscriberClerkUserId: string): Promise<Map<string, number>> {
  const subs = await SubscriptionModel.find({
    subscriberClerkUserId,
    status: { $in: [...PAID_ACCESS_SUBSCRIPTION_STATUSES] },
  })
    .select({ creatorClerkUserId: 1, accessLevel: 1 })
    .lean();

  const map = new Map<string, number>();
  for (const sub of subs) {
    const cid = sub.creatorClerkUserId as string;
    const rank = ACCESS_RANK[(sub.accessLevel as RequiredPlan) ?? "free"] ?? 0;
    const prev = map.get(cid) ?? 0;
    if (rank > prev) map.set(cid, rank);
  }
  return map;
}

function computeLibraryListAccess(input: {
  requiredPlan: RequiredPlan;
  creatorClerkUserId: string;
  viewerClerkUserId?: string | null;
  viewerIsAdmin: boolean;
  subRanks: Map<string, number>;
}): boolean {
  const { requiredPlan, creatorClerkUserId, viewerClerkUserId, viewerIsAdmin, subRanks } = input;
  if (requiredPlan === "free") return true;
  if (!viewerClerkUserId) return false;
  if (viewerClerkUserId === creatorClerkUserId) return true;
  if (viewerIsAdmin) return true;
  const requiredRank = ACCESS_RANK[requiredPlan] ?? 0;
  const subRank = subRanks.get(creatorClerkUserId) ?? 0;
  return subRank >= requiredRank;
}

type CreatorContext = {
  clerkUserId: string;
  creatorProfile: CreatorProfileDocument;
};

/**
 * A file that the browser already streamed to Cloudflare R2 via
 * `POST /api/storage/upload`. The metadata save just records the key
 * + URL on the Content document.
 */
export type UploadedAsset = {
  key: string;
  url: string;
  sizeBytes?: number;
  fileName?: string;
};

export type ContentSavePayload = {
  contentType: ContentType;
  title: string;
  description: string;
  requiredPlan: RequiredPlan;
  status: ContentStatus;
  fileSubtype?: FileSubtype;
  externalVideoUrl?: string;
  videoDurationLabel?: string;
  articleBody?: string;
  articleSummary?: string;
  thumbnail?: UploadedAsset | null;
  videoFile?: UploadedAsset | null;
  file?: UploadedAsset | null;
};

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeContentTypeRaw(value: unknown): ContentType {
  const raw = cleanString(value).toLowerCase();
  if (raw === "article" || raw === "file") return raw;
  return "video";
}

function normalizePlanRaw(value: unknown): RequiredPlan {
  const raw = cleanString(value).toLowerCase();
  if (raw === "basic" || raw === "premium") return raw;
  return "free";
}

function normalizeStatusRaw(value: unknown): ContentStatus {
  const raw = cleanString(value).toLowerCase();
  if (raw === "published" || raw === "archived") return raw;
  return "draft";
}

function normalizeFileSubtypeRaw(value: unknown): FileSubtype {
  const raw = cleanString(value).toLowerCase();
  if (raw === "zip" || raw === "rar") return raw;
  return "pdf";
}

function normalizeUploadedAsset(value: unknown): UploadedAsset | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const key = cleanString(v.key);
  const url = cleanString(v.url ?? v.publicUrl);
  if (!key || !url) return null;

  const sizeRaw = typeof v.sizeBytes === "number" ? v.sizeBytes : Number(v.sizeBytes);
  const fileName = cleanString(v.fileName ?? v.name);
  return {
    key,
    url,
    sizeBytes: Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : undefined,
    fileName: fileName || undefined,
  };
}

/**
 * Coerce an unknown JSON object (already parsed from `req.json()`)
 * into a strongly-typed save payload. Trims, length-caps, and gates
 * fields on the chosen `contentType` so a stale field from one tab
 * never bleeds into another (e.g. an article submission cannot
 * accidentally carry a `videoFile` blob from when the user was on the
 * Video tab).
 */
export function parseContentSavePayload(input: unknown): ContentSavePayload {
  const obj = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;

  const contentType = normalizeContentTypeRaw(obj.contentType);
  const requiredPlan = normalizePlanRaw(obj.requiredPlan);
  const status = normalizeStatusRaw(obj.status);
  const title = cleanString(obj.title).slice(0, 200);
  const description = cleanString(obj.description).slice(0, 1000);
  const fileSubtype = normalizeFileSubtypeRaw(obj.fileSubtype);
  const externalVideoUrl = cleanString(obj.externalVideoUrl).slice(0, 1000);

  const articleBody =
    contentType === "article" ? cleanString(obj.articleBody).slice(0, 20000) : "";
  const articleSummary =
    contentType === "article" ? cleanString(obj.articleSummary).slice(0, 600) : "";
  const videoDurationLabel =
    contentType === "video" ? cleanString(obj.videoDurationLabel).slice(0, 40) : "";

  const thumbnail = normalizeUploadedAsset(obj.thumbnail);
  const videoFile =
    contentType === "video" ? normalizeUploadedAsset(obj.videoFile) : null;
  const file =
    contentType === "file" ? normalizeUploadedAsset(obj.file) : null;

  return {
    contentType,
    title,
    description,
    requiredPlan,
    status,
    fileSubtype,
    externalVideoUrl,
    videoDurationLabel,
    articleBody,
    articleSummary,
    thumbnail,
    videoFile,
    file,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function createUniqueContentSlug(title: string, clerkUserId: string, existingId?: string) {
  const base = slugify(title) || "untitled-content";
  let candidate = base;
  let counter = 1;

  while (
    await ContentModel.exists({
      creatorClerkUserId: clerkUserId,
      slug: candidate,
      ...(existingId ? { _id: { $ne: existingId } } : {}),
    })
  ) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }

  return candidate;
}

async function safelyDeleteObject(key: string | undefined) {
  if (!key) return;
  try {
    await deleteFromCloudflareR2(key);
  } catch (error) {
    console.warn("[content:storage-delete]", error);
  }
}

async function requireCreatorContext(): Promise<CreatorContext> {
  const synced = await ensureCurrentUserProfile();
  if (!synced || synced.role !== "creator" || synced.isAdmin) {
    throw new Error("Only creator accounts can manage creator content.");
  }
  assertAccountIsActive(synced.profile);

  const creatorProfile = await CreatorProfileModel.findOne({ clerkUserId: synced.user.id });
  if (!creatorProfile) {
    throw new Error("Creator profile is missing. Open creator settings once, then try again.");
  }

  return { clerkUserId: synced.user.id, creatorProfile };
}

export async function serializeContent(content: ContentDocument): Promise<ContentResponse> {
  const creatorProfile = content.creatorProfileId
    ? await CreatorProfileModel.findById(content.creatorProfileId)
    : await CreatorProfileModel.findOne({ clerkUserId: content.creatorClerkUserId });

  return {
    id: content._id.toString(),
    creatorClerkUserId: content.creatorClerkUserId,
    creatorProfileId: content.creatorProfileId?.toString() ?? null,
    creatorName: creatorProfile?.creatorName ?? "Advanced Subscription & Membership Platform Creator",
    creatorSlug: creatorProfile?.creatorSlug ?? "creator",
    title: content.title,
    slug: content.slug,
    description: content.description,
    contentType: content.contentType,
    requiredPlan: content.requiredPlan,
    status: content.status,
    thumbnailUrl: content.thumbnailUrl,
    thumbnailKey: content.thumbnailKey,
    publishedAt: content.publishedAt ? content.publishedAt.toISOString() : null,
    viewsCount: content.viewsCount,
    downloadsCount: content.downloadsCount,
    videoUrl: content.videoUrl,
    videoKey: content.videoKey,
    videoDurationLabel: content.videoDurationLabel,
    videoProvider: content.videoProvider,
    externalVideoUrl: content.externalVideoUrl,
    articleBody: content.articleBody,
    articleSummary: content.articleSummary,
    fileSubtype: content.fileSubtype as FileSubtype | "",
    fileUrl: content.fileUrl,
    fileKey: content.fileKey,
    fileSizeLabel: content.fileSizeLabel,
    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString(),
  };
}

/** Blank paid media so list APIs cannot leak Basic/Premium URLs. */
function redactPaidMedia(serialized: ContentResponse): ContentResponse {
  return {
    ...serialized,
    videoUrl: "",
    videoKey: "",
    externalVideoUrl: "",
    fileUrl: "",
    fileKey: "",
    articleBody: "",
  };
}

/** Never hand the public R2 file URL to the library client. */
function hideDirectFileDownload(serialized: ContentResponse): ContentResponse {
  if (serialized.contentType !== "file") return serialized;
  return {
    ...serialized,
    fileUrl: "",
    fileKey: "",
  };
}

export async function listCurrentCreatorContent() {
  await connectToMongoDB();
  const context = await requireCreatorContext();
  const content = await ContentModel.find({ creatorClerkUserId: context.clerkUserId }).sort({ updatedAt: -1 });
  return Promise.all(content.map(serializeContent));
}

export async function listPublishedContent(options?: { viewerClerkUserId?: string | null }) {
  await connectToMongoDB();
  const content = await ContentModel.find({ status: "published" })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(80);

  const viewer = options?.viewerClerkUserId;
  let viewerIsAdmin = false;
  let subRanks = new Map<string, number>();
  if (viewer) {
    const profile = await UserProfileModel.findOne({ clerkUserId: viewer });
    if (profile?.email && isAdminEmail(profile.email)) {
      viewerIsAdmin = true;
    } else {
      subRanks = await subscriberMaxAccessRankByCreator(viewer);
    }
  }

  return Promise.all(
    content.map(async (doc) => {
      const serialized = await serializeContent(doc);
      const requiredPlan = doc.requiredPlan as RequiredPlan;
      const accessGranted = computeLibraryListAccess({
        requiredPlan,
        creatorClerkUserId: doc.creatorClerkUserId,
        viewerClerkUserId: viewer,
        viewerIsAdmin,
        subRanks,
      });
      return {
        ...(accessGranted
          ? hideDirectFileDownload(serialized)
          : redactPaidMedia(serialized)),
        accessGranted,
      };
    })
  );
}

export async function listPublishedContentByCreatorSlug(
  creatorSlug: string,
  options?: { viewerClerkUserId?: string | null }
) {
  await connectToMongoDB();
  const creatorProfile = await CreatorProfileModel.findOne({ creatorSlug: slugify(creatorSlug) });
  if (!creatorProfile) return [];

  const content = await ContentModel.find({
    creatorClerkUserId: creatorProfile.clerkUserId,
    status: "published",
  }).sort({ publishedAt: -1, createdAt: -1 });

  const viewer = options?.viewerClerkUserId;
  let viewerIsAdmin = false;
  let subRanks = new Map<string, number>();
  if (viewer) {
    const profile = await UserProfileModel.findOne({ clerkUserId: viewer });
    if (profile?.email && isAdminEmail(profile.email)) {
      viewerIsAdmin = true;
    } else {
      subRanks = await subscriberMaxAccessRankByCreator(viewer);
    }
  }

  return Promise.all(
    content.map(async (doc) => {
      const serialized = await serializeContent(doc);
      const requiredPlan = doc.requiredPlan as RequiredPlan;
      const accessGranted = computeLibraryListAccess({
        requiredPlan,
        creatorClerkUserId: doc.creatorClerkUserId,
        viewerClerkUserId: viewer,
        viewerIsAdmin,
        subRanks,
      });
      return {
        ...(accessGranted
          ? hideDirectFileDownload(serialized)
          : redactPaidMedia(serialized)),
        accessGranted,
      };
    })
  );
}

export async function getContentForCurrentCreator(contentId: string) {
  await connectToMongoDB();
  const context = await requireCreatorContext();
  const query = isRecordId(contentId)
    ? { _id: contentId, creatorClerkUserId: context.clerkUserId }
    : { slug: slugify(contentId), creatorClerkUserId: context.clerkUserId };
  const content = await ContentModel.findOne(query);
  return content ? serializeContent(content) : null;
}

export async function getPublishedContentByIdOrSlug(contentId: string) {
  await connectToMongoDB();
  const query: Record<string, unknown> = isRecordId(contentId)
    ? { _id: contentId, status: "published" }
    : { slug: slugify(contentId), status: "published" };
  const content = await ContentModel.findOne(query);
  return content ? serializeContent(content) : null;
}

export type GuardedContentResponse = ContentResponse & {
  /** True when the current viewer satisfies the content's `requiredPlan`. */
  accessGranted: boolean;
  /**
   * The Plan accessLevel the viewer would need to unlock the protected
   * urls. Mirrors `requiredPlan` for ergonomics on the client.
   */
  requiredAccessLevel: RequiredPlan;
};

/**
 * Public-facing fetch with a real access guard. Anyone can pull
 * metadata (title, description, thumbnail, summaries) for published
 * content, but `videoUrl`, `fileUrl`, `externalVideoUrl` and the full
 * `articleBody` are blanked out unless the viewer has either
 *   - the role of admin (ADMIN_EMAILS), or
 *   - is the creator who owns the content, or
 *   - holds a subscription with this creator in `active`, `trialing`, or
 *     `past_due` (grace) status at a tier that meets/exceeds `requiredPlan`.
 *
 * The free tier always passes for free content.
 */
export async function getGuardedPublishedContent(
  contentId: string
): Promise<GuardedContentResponse | null> {
  await connectToMongoDB();
  const query: Record<string, unknown> = isRecordId(contentId)
    ? { _id: contentId, status: "published" }
    : { slug: slugify(contentId), status: "published" };
  const content = await ContentModel.findOne(query);
  if (!content) return null;

  const serialized = await serializeContent(content);
  const requiredPlan = content.requiredPlan as RequiredPlan;
  const requiredRank = ACCESS_RANK[requiredPlan] ?? 0;

  let accessGranted = requiredPlan === "free";

  if (!accessGranted) {
    const { userId } = await auth();
    if (userId) {
      // Owners and admins always pass.
      if (userId === content.creatorClerkUserId) {
        accessGranted = true;
      } else {
        const profile = await UserProfileModel.findOne({ clerkUserId: userId });
        if (profile?.email && isAdminEmail(profile.email)) {
          accessGranted = true;
        } else {
          const sub = await SubscriptionModel.findOne({
            subscriberClerkUserId: userId,
            creatorClerkUserId: content.creatorClerkUserId,
            status: { $in: [...PAID_ACCESS_SUBSCRIPTION_STATUSES] },
          })
            .sort({ updatedAt: -1 })
            .lean();
          if (sub) {
            const subRank = ACCESS_RANK[sub.accessLevel as RequiredPlan] ?? 0;
            if (subRank >= requiredRank) accessGranted = true;
          }
        }
      }
    }
  }

  if (!accessGranted) {
    return {
      ...redactPaidMedia(serialized),
      accessGranted: false,
      requiredAccessLevel: requiredPlan,
    };
  }

  return {
    ...hideDirectFileDownload(serialized),
    accessGranted: true,
    requiredAccessLevel: requiredPlan,
  };
}

function assertSubtypeMatchesFile(fileSubtype: FileSubtype, fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || extension !== fileSubtype) {
    throw new Error(`Uploaded file must be a ${fileSubtype.toUpperCase()} file.`);
  }
}

function validateSavePayload(input: {
  payload: ContentSavePayload;
  hasExistingThumbnail?: boolean;
  isCreate: boolean;
}) {
  const { payload, hasExistingThumbnail, isCreate } = input;

  if (!payload.title) throw new Error("Title is required.");
  if (
    payload.status !== "draft" &&
    payload.status !== "published" &&
    payload.status !== "archived"
  ) {
    throw new Error("Invalid status.");
  }

  const needsThumbnail =
    payload.contentType === "video" || payload.contentType === "article";
  if (needsThumbnail && isCreate && !payload.thumbnail) {
    throw new Error("A thumbnail is required for video and article content.");
  }
  if (needsThumbnail && !isCreate && !payload.thumbnail && !hasExistingThumbnail) {
    throw new Error("A thumbnail is required for video and article content.");
  }

  if (payload.contentType === "article" && !payload.articleBody) {
    throw new Error("Article body is required.");
  }

  if (payload.contentType === "file") {
    if (isCreate && !payload.file) {
      throw new Error("A PDF, ZIP, or RAR file is required.");
    }
    if (payload.file) {
      const candidateName = payload.file.fileName || payload.file.key;
      assertSubtypeMatchesFile(payload.fileSubtype ?? "pdf", candidateName);
    }
  }

  if (
    payload.contentType === "video" &&
    payload.videoFile &&
    payload.externalVideoUrl
  ) {
    throw new Error("Use either uploaded video or external video URL, not both.");
  }
}

export async function createCreatorContent(payload: ContentSavePayload) {
  await connectToMongoDB();
  const context = await requireCreatorContext();

  validateSavePayload({ payload, isCreate: true });

  const content = await ContentModel.create({
    creatorClerkUserId: context.clerkUserId,
    creatorProfileId: context.creatorProfile._id,
    title: payload.title,
    slug: await createUniqueContentSlug(payload.title, context.clerkUserId),
    description: payload.description,
    contentType: payload.contentType,
    requiredPlan: payload.requiredPlan,
    status: payload.status,
    thumbnailUrl: payload.thumbnail?.url ?? "",
    thumbnailKey: payload.thumbnail?.key ?? "",
    publishedAt: payload.status === "published" ? new Date() : null,
    videoUrl: payload.contentType === "video" ? payload.videoFile?.url ?? "" : "",
    videoKey: payload.contentType === "video" ? payload.videoFile?.key ?? "" : "",
    videoDurationLabel: payload.videoDurationLabel ?? "",
    videoProvider:
      payload.contentType === "video" && payload.externalVideoUrl
        ? "external"
        : "upload",
    externalVideoUrl:
      payload.contentType === "video" ? payload.externalVideoUrl ?? "" : "",
    articleBody: payload.contentType === "article" ? payload.articleBody ?? "" : "",
    articleSummary:
      payload.contentType === "article" ? payload.articleSummary ?? "" : "",
    fileSubtype: payload.contentType === "file" ? payload.fileSubtype ?? "pdf" : "",
    fileUrl: payload.contentType === "file" ? payload.file?.url ?? "" : "",
    fileKey: payload.contentType === "file" ? payload.file?.key ?? "" : "",
    fileSizeLabel:
      payload.contentType === "file" && payload.file?.sizeBytes
        ? formatFileSize(payload.file.sizeBytes)
        : "",
  });

  await CreatorProfileModel.findByIdAndUpdate(context.creatorProfile._id, {
    $inc: { contentCount: 1 },
  });

  return serializeContent(content);
}

export async function updateCreatorContent(
  contentId: string,
  payload: ContentSavePayload
) {
  await connectToMongoDB();
  const context = await requireCreatorContext();
  const content = await ContentModel.findOne({
    _id: contentId,
    creatorClerkUserId: context.clerkUserId,
  });
  if (!content) return null;

  validateSavePayload({
    payload,
    hasExistingThumbnail: Boolean(content.thumbnailUrl),
    isCreate: false,
  });

  const wasPublished = content.status === "published";
  const wasArchived = content.status === "archived";
  content.title = payload.title;
  content.slug = await createUniqueContentSlug(
    payload.title,
    context.clerkUserId,
    content._id.toString()
  );
  content.description = payload.description;
  content.contentType = payload.contentType;
  content.requiredPlan = payload.requiredPlan;
  content.status = payload.status;
  content.publishedAt =
    payload.status === "published"
      ? content.publishedAt || new Date()
      : payload.status === "archived"
        ? content.publishedAt
        : null;
  if (!wasPublished && payload.status === "published") {
    content.publishedAt = new Date();
  }

  if (payload.thumbnail) {
    await safelyDeleteObject(content.thumbnailKey);
    content.thumbnailUrl = payload.thumbnail.url;
    content.thumbnailKey = payload.thumbnail.key;
  }

  if (payload.contentType === "video") {
    if (payload.videoFile) {
      await safelyDeleteObject(content.videoKey);
      content.videoUrl = payload.videoFile.url;
      content.videoKey = payload.videoFile.key;
      content.externalVideoUrl = "";
      content.videoProvider = "upload";
    } else if (payload.externalVideoUrl) {
      content.externalVideoUrl = payload.externalVideoUrl;
      content.videoProvider = "external";
    }
    content.videoDurationLabel = payload.videoDurationLabel ?? "";
    content.articleBody = "";
    content.articleSummary = "";
    content.fileSubtype = "";
    content.fileUrl = "";
    content.fileKey = "";
    content.fileSizeLabel = "";
  }

  if (payload.contentType === "article") {
    if (content.videoKey) await safelyDeleteObject(content.videoKey);
    if (content.fileKey) await safelyDeleteObject(content.fileKey);
    content.articleBody = payload.articleBody ?? "";
    content.articleSummary = payload.articleSummary ?? "";
    content.videoUrl = "";
    content.videoKey = "";
    content.externalVideoUrl = "";
    content.videoProvider = "upload";
    content.fileSubtype = "";
    content.fileUrl = "";
    content.fileKey = "";
    content.fileSizeLabel = "";
  }

  if (payload.contentType === "file") {
    content.fileSubtype = payload.fileSubtype ?? "pdf";
    if (payload.file) {
      await safelyDeleteObject(content.fileKey);
      content.fileUrl = payload.file.url;
      content.fileKey = payload.file.key;
      content.fileSizeLabel = payload.file.sizeBytes
        ? formatFileSize(payload.file.sizeBytes)
        : "";
    }
    content.videoUrl = "";
    content.videoKey = "";
    content.externalVideoUrl = "";
    content.videoProvider = "upload";
    content.articleBody = "";
    content.articleSummary = "";
  }

  await content.save();

  // Self-heal CreatorProfile.contentCount whenever a content row crosses
  // the archived boundary. Recalc keeps the value correct even if a
  // historical save was missed.
  const isArchivedNow = payload.status === "archived";
  if (wasArchived !== isArchivedNow) {
    try {
      await recalcCreatorContentCount(context.clerkUserId);
    } catch (error) {
      console.warn("[content:recalc-content-count]", error);
    }
  }

  return serializeContent(content);
}

export async function archiveCreatorContent(contentId: string) {
  await connectToMongoDB();
  const context = await requireCreatorContext();
  const before = await ContentModel.findOne({
    _id: contentId,
    creatorClerkUserId: context.clerkUserId,
  });
  if (!before) return null;

  const wasNonArchived = before.status !== "archived";

  const content = await ContentModel.findOneAndUpdate(
    { _id: contentId, creatorClerkUserId: context.clerkUserId },
    { $set: { status: "archived" } },
    { returnDocument: "after" }
  );

  if (content && wasNonArchived) {
    try {
      await recalcCreatorContentCount(context.clerkUserId);
    } catch (error) {
      console.warn("[content:recalc-content-count-archive]", error);
    }
  }

  return content ? serializeContent(content) : null;
}

/**
 * Restore an archived row back to draft status. Used by the 3-dot
 * "Unarchive" action in the creator content table. We always come
 * back as `draft` (never `published`) so the creator gets one last
 * confirmation before the content reappears in the public library.
 */
export async function unarchiveCreatorContent(contentId: string) {
  await connectToMongoDB();
  const context = await requireCreatorContext();
  const before = await ContentModel.findOne({
    _id: contentId,
    creatorClerkUserId: context.clerkUserId,
  });
  if (!before) return null;

  const wasArchived = before.status === "archived";

  const content = await ContentModel.findOneAndUpdate(
    { _id: contentId, creatorClerkUserId: context.clerkUserId },
    { $set: { status: "draft" } },
    { returnDocument: "after" }
  );

  if (content && wasArchived) {
    try {
      await recalcCreatorContentCount(context.clerkUserId);
    } catch (error) {
      console.warn("[content:recalc-content-count-unarchive]", error);
    }
  }

  return content ? serializeContent(content) : null;
}

/**
 * Permanently remove a content row (and its R2 assets) for the
 * authenticated creator. The owner check on the query guarantees a
 * creator can only nuke rows they own; admins use a separate route.
 *
 * Returns the deleted content's id so the caller can update the
 * client-side list, or `null` if no row matched.
 */
export async function deleteCreatorContent(contentId: string): Promise<{ id: string } | null> {
  await connectToMongoDB();
  const context = await requireCreatorContext();
  const content = await ContentModel.findOneAndDelete({
    _id: contentId,
    creatorClerkUserId: context.clerkUserId,
  });
  if (!content) return null;

  await Promise.all([
    safelyDeleteObject(content.thumbnailKey),
    safelyDeleteObject(content.videoKey),
    safelyDeleteObject(content.fileKey),
  ]);

  try {
    await recalcCreatorContentCount(context.clerkUserId);
  } catch (error) {
    console.warn("[content:recalc-content-count-delete]", error);
  }

  return { id: content._id.toString() };
}

/**
 * Increment Content.viewsCount and CreatorProfile.totalViews. Called
 * by `POST /api/content/[id]/view` when a published item is opened.
 * The endpoint is open to anyone (signed in or not) so we don't tie a
 * view to a Clerk user; consumer-side throttling is left to the
 * caller (e.g. the library page only fires once per mount).
 */
export async function recordContentView(contentId: string): Promise<{
  ok: true;
  viewsCount: number;
} | null> {
  await connectToMongoDB();
  const query: Record<string, unknown> = isRecordId(contentId)
    ? { _id: contentId, status: "published" }
    : { slug: slugify(contentId), status: "published" };

  const content = await ContentModel.findOneAndUpdate(
    query,
    { $inc: { viewsCount: 1 } },
    { returnDocument: "after" }
  );
  if (!content) return null;

  try {
    await CreatorProfileModel.updateOne(
      { clerkUserId: content.creatorClerkUserId },
      { $inc: { totalViews: 1 } }
    );
  } catch (error) {
    console.warn("[content:view:totalViews]", error);
  }

  return { ok: true, viewsCount: content.viewsCount };
}

/**
 * Increment Content.downloadsCount. Caller MUST have already passed
 * the access guard (the route enforces that). Returns storage keys so
 * the download route can stream the file as an attachment. If the
 * file is empty (locked or missing), returns `null`.
 */
export async function recordContentDownload(
  contentId: string
): Promise<{
  ok: true;
  downloadsCount: number;
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileSubtype: string;
} | null> {
  await connectToMongoDB();
  const query: Record<string, unknown> = isRecordId(contentId)
    ? { _id: contentId, status: "published", contentType: "file" }
    : { slug: slugify(contentId), status: "published", contentType: "file" };

  const content = await ContentModel.findOneAndUpdate(
    query,
    { $inc: { downloadsCount: 1 } },
    { returnDocument: "after" }
  );
  if (!content) return null;
  if (!content.fileKey && !content.fileUrl) return null;

  return {
    ok: true,
    downloadsCount: content.downloadsCount,
    fileUrl: content.fileUrl,
    fileKey: content.fileKey,
    fileName: content.title,
    fileSubtype: content.fileSubtype || "",
  };
}

/**
 * Append a watch-completion event for analytics. We store the running
 * sum + count so the per-content average is `sum / count` without
 * carrying per-event rows. `percent` is clamped to [0, 100].
 */
export async function recordWatchCompletionEvent(input: {
  contentId: string;
  percent: number;
}): Promise<{ ok: true; averagePercent: number } | null> {
  await connectToMongoDB();
  const percent = Math.max(0, Math.min(100, Number(input.percent) || 0));

  const query: Record<string, unknown> = isRecordId(input.contentId)
    ? { _id: input.contentId, status: "published", contentType: "video" }
    : { slug: slugify(input.contentId), status: "published", contentType: "video" };

  const content = await ContentModel.findOneAndUpdate(
    query,
    {
      $inc: {
        watchPercentSum: percent,
        watchEventsCount: 1,
      },
    },
    { returnDocument: "after" }
  );
  if (!content) return null;

  const count = content.watchEventsCount || 0;
  const average = count > 0 ? Math.round((content.watchPercentSum || 0) / count) : 0;
  return { ok: true, averagePercent: average };
}
