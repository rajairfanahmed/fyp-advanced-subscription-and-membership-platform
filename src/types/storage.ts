export type StorageUploadCategory =
  | "profileAvatar"
  | "creatorAvatar"
  | "creatorBanner"
  | "videoThumbnail"
  | "articleThumbnail"
  | "fileCover"
  | "videoFile"
  | "downloadableFile";

export type AllowedFileRule = {
  category: StorageUploadCategory;
  mimeTypes: readonly string[];
  extensions: readonly string[];
  maxSizeBytes?: number;
};

export type StorageUploadInput = {
  category: StorageUploadCategory;
  clerkUserId: string;
  fileName: string;
  contentType: string;
  body: Buffer | Uint8Array | string;
  sizeBytes?: number;
};

export type StorageUploadResult = {
  key: string;
  publicUrl: string | null;
  bucketName: string;
  contentType: string;
  sizeBytes?: number;
};

export type StorageValidationResult =
  | { ok: true; extension: string; contentType: string }
  | { ok: false; reason: string };
