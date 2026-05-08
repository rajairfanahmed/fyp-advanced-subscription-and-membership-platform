export type ContentType = "video" | "article" | "file";
export type RequiredPlan = "free" | "basic" | "premium";
export type ContentStatus = "draft" | "published" | "archived";
export type FileSubtype = "pdf" | "zip" | "rar";
export type VideoProvider = "upload" | "external";

export type ContentResponse = {
  id: string;
  creatorClerkUserId: string;
  creatorProfileId: string | null;
  creatorName: string;
  creatorSlug: string;
  title: string;
  slug: string;
  description: string;
  contentType: ContentType;
  requiredPlan: RequiredPlan;
  status: ContentStatus;
  thumbnailUrl: string;
  thumbnailKey: string;
  publishedAt: string | null;
  viewsCount: number;
  downloadsCount: number;
  videoUrl: string;
  videoKey: string;
  videoDurationLabel: string;
  videoProvider: VideoProvider;
  externalVideoUrl: string;
  articleBody: string;
  articleSummary: string;
  fileSubtype: FileSubtype | "";
  fileUrl: string;
  fileKey: string;
  fileSizeLabel: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Set by `GET /api/content` (library list) and `GET /api/content/[id]`.
   * When false, paid media/body is withheld and the client should show an upgrade prompt.
   */
  accessGranted?: boolean;
  requiredAccessLevel?: RequiredPlan;
};

export type ContentListResponse = {
  content: ContentResponse[];
};
