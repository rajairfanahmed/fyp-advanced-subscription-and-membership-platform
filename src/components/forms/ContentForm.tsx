"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bold,
  CheckCircle2,
  FileArchive,
  FileText,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  UploadCloud,
  Video,
} from "lucide-react";

import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { STORAGE_LIMITS, formatBytes } from "@/config/storage-limits";
import type { ContentResponse, ContentStatus, ContentType, FileSubtype, RequiredPlan } from "@/types/content";
import type { StorageUploadCategory } from "@/types/storage";

type UploadedAsset = {
  key: string;
  url: string;
  sizeBytes?: number;
  fileName?: string;
};

/**
 * Stream `file` directly to Cloudflare R2 via `POST /api/storage/upload`.
 *
 * The request body is the raw bytes of the file (NOT multipart/form-data),
 * so Next.js never has to call `req.formData()` and the upload no longer
 * fails with "Could not parse the upload" for large videos. Progress is
 * surfaced through the optional `onProgress` callback (0–99).
 */
const CATEGORY_MAX_SIZE: Partial<Record<StorageUploadCategory, number>> = {
  profileAvatar: STORAGE_LIMITS.imageMaxBytes,
  creatorAvatar: STORAGE_LIMITS.imageMaxBytes,
  creatorBanner: STORAGE_LIMITS.imageMaxBytes,
  videoThumbnail: STORAGE_LIMITS.imageMaxBytes,
  articleThumbnail: STORAGE_LIMITS.imageMaxBytes,
  fileCover: STORAGE_LIMITS.imageMaxBytes,
  videoFile: STORAGE_LIMITS.videoMaxBytes,
  downloadableFile: STORAGE_LIMITS.downloadableMaxBytes,
};

function uploadAssetToR2(input: {
  file: File;
  category: StorageUploadCategory;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadedAsset> {
  const { file, category, onProgress, signal } = input;
  const url =
    `/api/storage/upload?category=${encodeURIComponent(category)}` +
    `&fileName=${encodeURIComponent(file.name)}`;

  // Reject oversized files locally so we don't burn 5 minutes streaming
  // bytes only to have R2 reject them on the far side.
  const maxBytes = CATEGORY_MAX_SIZE[category];
  if (maxBytes && file.size > maxBytes) {
    return Promise.reject(
      new Error(
        `${file.name} is ${formatBytes(file.size)} which exceeds the ${formatBytes(maxBytes)} limit for ${category}.`
      )
    );
  }

  return new Promise<UploadedAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    xhr.responseType = "text";
    // Send the file's mime type so the server can record it on R2.
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    // Some browsers strip Content-Length on streaming PUTs; pass our
    // own header so the route can validate without ambiguity.
    xhr.setRequestHeader("X-File-Size", String(file.size));

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(Math.max(1, Math.min(pct, 99)));
        }
      };
      xhr.upload.onload = () => onProgress(99);
    }

    xhr.onload = () => {
      const raw = typeof xhr.responseText === "string" ? xhr.responseText : "";
      let body: { key?: string; publicUrl?: string | null; sizeBytes?: number; error?: string } = {};
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = { error: raw.slice(0, 240) };
        }
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.key && body.publicUrl) {
        resolve({
          key: body.key,
          url: body.publicUrl,
          sizeBytes: body.sizeBytes ?? file.size,
          fileName: file.name,
        });
        return;
      }
      // 0 status almost always means the request never reached the
      // server (extension blocked it, browser navigated away, network
      // unreachable). Surface a friendlier hint instead of HTTP 0.
      const baseMessage =
        body.error ||
        (xhr.status === 0
          ? "Upload connection was interrupted. Check your internet and retry — the file did not reach the server."
          : body.publicUrl === null
            ? "Cloudflare R2 public URL is not configured. Set CLOUDFLARE_R2_PUBLIC_URL."
            : `Upload failed (HTTP ${xhr.status}).`);
      reject(new Error(baseMessage));
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Network error while uploading. Pause any VPN / firewall and retry on a stable connection."
        )
      );
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out. Please retry on a faster connection."));
    xhr.onabort = () => reject(new Error("Upload was canceled."));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

type ToolbarAction =
  | "h1"
  | "h2"
  | "bold"
  | "italic"
  | "ul"
  | "ol"
  | "quote"
  | "link";

function applyMarkdownAction(
  textarea: HTMLTextAreaElement,
  action: ToolbarAction
): { value: string; selectionStart: number; selectionEnd: number } {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);

  // Find the bounds of the lines that contain the selection — the
  // line-level transforms (#, -, >) operate per line so we expand
  // outward from the cursor first.
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const lineEndIdx = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, lineEndIdx);

  let replacement = "";
  let nextStart = start;
  let nextEnd = end;

  const lineWrap = (prefix: string) => {
    const lines = block.split("\n").map((l) => (l ? `${prefix}${l}` : prefix.trim()));
    replacement = lines.join("\n");
    return { from: lineStart, to: lineEndIdx, after: replacement };
  };

  let mutation: { from: number; to: number; after: string } | null = null;

  switch (action) {
    case "h1":
      mutation = lineWrap("# ");
      break;
    case "h2":
      mutation = lineWrap("## ");
      break;
    case "ul":
      mutation = lineWrap("- ");
      break;
    case "ol": {
      const lines = block.split("\n").map((l, i) => (l ? `${i + 1}. ${l}` : `${i + 1}.`));
      replacement = lines.join("\n");
      mutation = { from: lineStart, to: lineEndIdx, after: replacement };
      break;
    }
    case "quote":
      mutation = lineWrap("> ");
      break;
    case "bold": {
      const wrapped = `**${selected || "bold text"}**`;
      mutation = { from: start, to: end, after: wrapped };
      nextStart = start + 2;
      nextEnd = nextStart + (selected || "bold text").length;
      break;
    }
    case "italic": {
      const wrapped = `*${selected || "italic text"}*`;
      mutation = { from: start, to: end, after: wrapped };
      nextStart = start + 1;
      nextEnd = nextStart + (selected || "italic text").length;
      break;
    }
    case "link": {
      const url = window.prompt("Link URL", "https://");
      if (!url) {
        return { value, selectionStart: start, selectionEnd: end };
      }
      const label = selected || "link text";
      const wrapped = `[${label}](${url})`;
      mutation = { from: start, to: end, after: wrapped };
      nextStart = start + 1;
      nextEnd = nextStart + label.length;
      break;
    }
  }

  if (!mutation) {
    return { value, selectionStart: start, selectionEnd: end };
  }

  const nextValue =
    value.slice(0, mutation.from) + mutation.after + value.slice(mutation.to);
  const isLineLevel =
    action === "h1" ||
    action === "h2" ||
    action === "ul" ||
    action === "ol" ||
    action === "quote";
  if (isLineLevel) {
    nextStart = mutation.from;
    nextEnd = mutation.from + mutation.after.length;
  }
  return { value: nextValue, selectionStart: nextStart, selectionEnd: nextEnd };
}

type ContentMode = "Video" | "Article" | "File";

type ContentFormProps = {
  mode: "create" | "edit";
  initialContent?: ContentResponse | null;
  /**
   * Pre-fetched workspace defaults from the server. When provided we
   * use them as the initial state so the form opens with the right
   * tier/visibility on the very first paint (no flash of "basic /
   * draft" → "premium / published"). Read by `/creator/content/new`.
   */
  workspaceDefaults?: CreatorWorkspaceDefaultsResponse | null;
};

type CreatorWorkspaceDefaultsResponse = {
  defaultRequiredPlan: RequiredPlan;
  defaultStatus: "draft" | "published";
};

function uiModeToContentType(mode: ContentMode): ContentType {
  if (mode === "Article") return "article";
  if (mode === "File") return "file";
  return "video";
}

function contentTypeToUiMode(contentType?: ContentType): ContentMode {
  if (contentType === "article") return "Article";
  if (contentType === "file") return "File";
  return "Video";
}

function titleCase(value: string) {
  if (value === "published") return "Public";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeUiStatus(status?: ContentStatus): "draft" | "published" {
  return status === "published" ? "published" : "draft";
}

function UploadField({
  label,
  helper,
  accept,
  file,
  onChange,
}: {
  label: string;
  helper: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-white px-5 py-5 cursor-pointer hover:border-teal-500 hover:bg-teal-50/40 transition-colors">
      <input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
          <UploadCloud className="w-5 h-5 text-teal-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">{file ? file.name : label}</p>
          <p className="text-xs font-bold text-slate-500 mt-1">{helper}</p>
        </div>
      </div>
    </label>
  );
}

export function ContentForm({ mode: formMode, initialContent, workspaceDefaults }: ContentFormProps) {
  const router = useRouter();
  // Resolve the initial access tier + visibility in priority order:
  //   1. existing content row (edit mode)
  //   2. server-prefetched workspace defaults (real-time on every
  //      page-load — they reflect whatever the creator just saved
  //      in /creator/settings)
  //   3. hard-coded fallback (basic / draft)
  const initialRequiredPlan: RequiredPlan =
    initialContent?.requiredPlan ?? workspaceDefaults?.defaultRequiredPlan ?? "basic";
  const initialStatus: "draft" | "published" = initialContent
    ? normalizeUiStatus(initialContent.status)
    : workspaceDefaults?.defaultStatus ?? "draft";

  const [mode, setMode] = useState<ContentMode>(contentTypeToUiMode(initialContent?.contentType));
  const [title, setTitle] = useState(initialContent?.title ?? "");
  const [description, setDescription] = useState(initialContent?.description ?? "");
  const [articleSummary, setArticleSummary] = useState(initialContent?.articleSummary ?? "");
  const [articleBody, setArticleBody] = useState(initialContent?.articleBody ?? "");
  const [requiredPlan, setRequiredPlan] = useState<RequiredPlan>(initialRequiredPlan);
  const [status, setStatus] = useState<"draft" | "published">(initialStatus);
  // If the server already pushed workspace defaults we don't need a
  // second client-side fetch — skip the round-trip to keep the form
  // snappy and avoid the brief "basic / draft → premium / published"
  // flicker the user reported.
  const [defaultsApplied, setDefaultsApplied] = useState(
    formMode === "edit" || Boolean(workspaceDefaults)
  );
  const [fileSubtype, setFileSubtype] = useState<FileSubtype>((initialContent?.fileSubtype as FileSubtype) || "pdf");
  const [videoDurationLabel, setVideoDurationLabel] = useState(initialContent?.videoDurationLabel ?? "");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [downloadableFile, setDownloadableFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const articleBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!initialContent) return;
    setMode(contentTypeToUiMode(initialContent.contentType));
    setTitle(initialContent.title);
    setDescription(initialContent.description);
    setArticleSummary(initialContent.articleSummary);
    setArticleBody(initialContent.articleBody);
    setRequiredPlan(initialContent.requiredPlan);
    setStatus(normalizeUiStatus(initialContent.status));
    setFileSubtype((initialContent.fileSubtype as FileSubtype) || "pdf");
    setVideoDurationLabel(initialContent.videoDurationLabel);
  }, [initialContent]);

  // Pre-fill the access tier + visibility from the creator's saved
  // workspace defaults the first time the new-content form mounts. Edit
  // mode never touches these values — they're always loaded from the
  // existing content row.
  useEffect(() => {
    if (formMode !== "create" || defaultsApplied) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/creator-profile", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setDefaultsApplied(true);
          return;
        }
        const data = (await res.json()) as {
          profile?: { workspaceDefaults?: CreatorWorkspaceDefaultsResponse };
        };
        if (cancelled) return;
        const wd = data.profile?.workspaceDefaults;
        if (wd) {
          if (wd.defaultRequiredPlan === "free" || wd.defaultRequiredPlan === "basic" || wd.defaultRequiredPlan === "premium") {
            setRequiredPlan(wd.defaultRequiredPlan);
          }
          if (wd.defaultStatus === "draft" || wd.defaultStatus === "published") {
            setStatus(wd.defaultStatus);
          }
        }
        setDefaultsApplied(true);
      } catch {
        if (!cancelled) setDefaultsApplied(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formMode, defaultsApplied]);

  /**
   * Switching the content type while editing/creating must not carry
   * stale uploads from the previous mode. Otherwise a video chosen on
   * the Video tab would silently ride along on an Article submission.
   */
  function handleModeChange(next: ContentMode) {
    if (next === mode) return;
    setMode(next);
    setError("");
    setMessage("");
    setUploadProgress(0);
    if (next !== "Video") {
      setVideoFile(null);
      setVideoDurationLabel("");
    }
    if (next !== "File") {
      setDownloadableFile(null);
    }
    if (next !== "Article") {
      // Keep the body/summary in state so the user can switch back without
      // losing draft text — only purge if there is none yet.
    }
  }

  /**
   * Auto-detect a YouTube-style "MM:SS" or "HH:MM:SS" label from the
   * picked video the moment it lands in the input. The creator never
   * has to type a duration manually anymore.
   */
  function handleVideoFileChange(next: File | null) {
    setVideoFile(next);
    setVideoDurationLabel("");
    if (!next) return;

    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(next);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const total = Math.floor(video.duration || 0);
      if (Number.isFinite(total) && total > 0) {
        const hh = Math.floor(total / 3600);
        const mm = Math.floor((total % 3600) / 60);
        const ss = total % 60;
        const formatted =
          hh > 0
            ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
            : `${mm}:${String(ss).padStart(2, "0")}`;
        setVideoDurationLabel(formatted);
      }
      cleanup();
    };
    video.onerror = cleanup;
    video.src = objectUrl;
  }

  function validateBeforeSubmit(): string | null {
    if (!title.trim()) return "Please add a title before saving.";
    if (mode === "Video" && formMode === "create" && !videoFile) {
      return "Please choose a video file to upload.";
    }
    if (mode === "Article" && !articleBody.trim()) {
      return "Article body is required.";
    }
    if (mode === "File" && formMode === "create" && !downloadableFile) {
      return "Please choose a PDF, ZIP or RAR file to upload.";
    }
    if (mode === "File" && downloadableFile) {
      const ext = downloadableFile.name.split(".").pop()?.toLowerCase();
      if (ext !== fileSubtype) {
        return `The selected file type (.${ext ?? "?"}) does not match the chosen "${fileSubtype.toUpperCase()}" sub-type.`;
      }
    }
    if ((mode === "Video" || mode === "Article") && formMode === "create" && !thumbnailFile) {
      return "A thumbnail image is required for video and article content.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      setMessage("");
      // Make the rejection visible — without this users in the wild
      // (especially on long forms) miss the inline banner above and
      // think the Create button silently failed.
      requestAnimationFrame(() => {
        statusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");
    setUploadProgress(0);

    const contentType = uiModeToContentType(mode);

    try {
      // ---------------------------------------------------------------
      // Phase 1 — stream each chosen file straight to Cloudflare R2.
      //
      // We do this BEFORE talking to /api/content so the metadata save
      // is a tiny JSON request that can never time out or trip the
      // multipart parser. The progress bar covers the largest file in
      // the submission (video > downloadable > thumbnail).
      // ---------------------------------------------------------------
      let thumbnailAsset: UploadedAsset | null = null;
      let videoAsset: UploadedAsset | null = null;
      let fileAsset: UploadedAsset | null = null;

      const thumbnailCategory: StorageUploadCategory =
        contentType === "file"
          ? "fileCover"
          : contentType === "article"
            ? "articleThumbnail"
            : "videoThumbnail";

      if (thumbnailFile) {
        thumbnailAsset = await uploadAssetToR2({
          file: thumbnailFile,
          category: thumbnailCategory,
          onProgress: (pct) => {
            // Thumbnails are small; keep the bar in the early band so
            // the bigger asset upload that follows can take it the rest
            // of the way without going backwards.
            if (videoFile || downloadableFile) {
              setUploadProgress(Math.min(15, Math.max(2, Math.round(pct / 7))));
            } else {
              setUploadProgress(Math.max(5, pct));
            }
          },
        });
      }

      if (contentType === "video" && videoFile) {
        setUploadProgress((prev) => Math.max(prev, 5));
        videoAsset = await uploadAssetToR2({
          file: videoFile,
          category: "videoFile",
          onProgress: (pct) => setUploadProgress(Math.max(5, pct)),
        });
      }

      if (contentType === "file" && downloadableFile) {
        setUploadProgress((prev) => Math.max(prev, 5));
        fileAsset = await uploadAssetToR2({
          file: downloadableFile,
          category: "downloadableFile",
          onProgress: (pct) => setUploadProgress(Math.max(5, pct)),
        });
      }

      // ---------------------------------------------------------------
      // Phase 2 — save the small JSON metadata blob.
      // ---------------------------------------------------------------
      const payload: Record<string, unknown> = {
        contentType,
        title: title.trim(),
        description,
        requiredPlan,
        status,
        externalVideoUrl: "",
      };

      if (contentType === "video") {
        payload.videoDurationLabel = videoDurationLabel;
        if (videoAsset) payload.videoFile = videoAsset;
      }
      if (contentType === "article") {
        payload.articleSummary = articleSummary;
        payload.articleBody = articleBody;
      }
      if (contentType === "file") {
        payload.fileSubtype = fileSubtype;
        if (fileAsset) payload.file = fileAsset;
      }
      if (thumbnailAsset) payload.thumbnail = thumbnailAsset;

      const url =
        formMode === "edit" && initialContent
          ? `/api/content/${initialContent.id}`
          : "/api/content";
      const method = formMode === "edit" ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      let data: { content?: ContentResponse; error?: string } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          data = { error: raw.slice(0, 240) };
        }
      }

      if (!response.ok) {
        throw new Error(data.error || `Save failed (HTTP ${response.status}).`);
      }
      if (data.error) throw new Error(data.error);

      setUploadProgress(100);
      setMessage(
        formMode === "edit"
          ? "Content saved successfully."
          : "Content created successfully."
      );
      if (formMode === "create") {
        router.push("/creator/content");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Content could not be saved. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyToolbar(action: ToolbarAction) {
    const textarea = articleBodyRef.current;
    if (!textarea) return;
    const result = applyMarkdownAction(textarea, action);
    setArticleBody(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  const articleWordCount = articleBody.trim()
    ? articleBody.trim().split(/\s+/).length
    : 0;
  const articleReadMinutes = Math.max(
    1,
    Math.round(articleWordCount / 220)
  );

  const existingThumbnail = initialContent?.thumbnailUrl;
  const fieldClass = "w-full px-5 py-4 bg-white border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all font-bold text-slate-950 placeholder:text-slate-500";
  const labelClass = "text-[11px] font-black text-slate-700 uppercase tracking-[0.2em]";
  const helperClass = "text-xs font-bold text-slate-600";

  return (
    <CreatorShell>
      <form className="space-y-12 pb-10" onSubmit={handleSubmit}>
        {formMode === "create" ? (
          <DashboardHeader
            eyebrow="Content Studio"
            title="Create New Content"
            subtitle="Select your content type and fill in the details below to publish to your subscribers."
            action={
              <Link href="/creator/content" className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-teal-600 transition-colors group">
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Content
              </Link>
            }
          />
        ) : (
          <MotionItem>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex items-center gap-4">
                <Link href="/creator/content" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[var(--color-ink)] hover:border-slate-300 transition-all shadow-sm">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-black font-display text-[var(--color-ink)] tracking-tight mb-1">
                    Edit Content
                  </h1>
                  <p className="text-sm font-medium text-slate-500">Editing &quot;{title || "Untitled Content"}&quot;</p>
                </div>
              </div>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </MotionItem>
        )}

        {(error || message) && (
          <div
            ref={statusRef}
            role="status"
            aria-live="polite"
            className={`rounded-2xl border p-4 text-sm font-bold ${error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}
          >
            {error || message}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                <h2 className="text-xl font-black font-display text-slate-900 mb-6">Select Content Type</h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { label: "Video" as const, icon: Video, helper: "Video Upload" },
                    { label: "Article" as const, icon: FileText, helper: "Blog Style Post" },
                    { label: "File" as const, icon: FileArchive, helper: "PDF, ZIP, RAR" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleModeChange(item.label)}
                      className={cn("p-6 rounded-[2rem] border transition-all text-left group relative overflow-hidden", mode === item.label ? "border-teal-500 bg-teal-50/30 ring-1 ring-teal-500" : "border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50")}
                    >
                      <item.icon className={cn("w-6 h-6 mb-4 transition-colors", mode === item.label ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600")} />
                      <h3 className={cn("font-bold mb-1", mode === item.label ? "text-slate-900" : "text-slate-600")}>{item.label}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.helper}</p>
                    </button>
                  ))}
                </div>
              </div>
            </MotionReveal>

            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h2 className="text-xl font-black font-display text-slate-900 mb-8">Content Details</h2>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className={labelClass}>Content Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Masterclass: Advanced Techniques"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className={labelClass}>Description</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief summary for subscriber cards and previews..."
                      className={`${fieldClass} resize-none font-medium`}
                      data-lenis-prevent
                    />
                  </div>

                  {mode === "File" && (
                    <div className="space-y-3">
                      <label className={labelClass}>File Sub-Type</label>
                      <select
                        value={fileSubtype}
                        onChange={(e) => setFileSubtype(e.target.value as FileSubtype)}
                        className={`${fieldClass} appearance-none`}
                      >
                        <option value="pdf">PDF Document</option>
                        <option value="zip">ZIP Archive</option>
                        <option value="rar">RAR Archive</option>
                      </select>
                    </div>
                  )}

                  {(mode === "Video" || mode === "Article" || mode === "File") && (
                    <div className="space-y-3">
                      <label className={labelClass}>
                        {mode === "File" ? "Cover Image" : "Thumbnail"} {formMode === "create" && mode !== "File" ? "(Required)" : ""}
                      </label>
                      <UploadField
                        label={mode === "File" ? "Click to upload or drag file cover here" : `Click to upload or drag ${mode.toLowerCase()} thumbnail here`}
                        helper={`JPG, JPEG, PNG, WEBP, AVIF · max ${formatBytes(STORAGE_LIMITS.imageMaxBytes)}.`}
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        file={thumbnailFile}
                        onChange={setThumbnailFile}
                      />
                      {existingThumbnail && !thumbnailFile && (
                        <p className={helperClass}>Existing thumbnail will be preserved if you do not upload a replacement.</p>
                      )}
                    </div>
                  )}

                  {mode === "Video" && (
                    <>
                      <div className="space-y-3">
                        <label className={labelClass}>Video File</label>
                        <UploadField
                          label="Click to upload or drag video file here"
                          helper={`MP4, MOV, WEBM · max ${formatBytes(STORAGE_LIMITS.videoMaxBytes)} · duration is detected automatically (YouTube-style).`}
                          accept="video/mp4,video/quicktime,video/webm"
                          file={videoFile}
                          onChange={handleVideoFileChange}
                        />
                        {videoDurationLabel && (
                          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
                            Detected duration · {videoDurationLabel}
                          </p>
                        )}
                        {initialContent?.videoUrl && !videoFile && (
                          <p className={helperClass}>
                            Existing video file will be preserved.
                            {initialContent.videoDurationLabel
                              ? ` Saved duration: ${initialContent.videoDurationLabel}.`
                              : ""}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {mode === "Article" && (
                    <>
                      <div className="space-y-3">
                        <label className={labelClass}>Article Summary</label>
                        <textarea
                          rows={2}
                          value={articleSummary}
                          onChange={(e) => setArticleSummary(e.target.value)}
                          placeholder="One- or two-sentence hook that shows above the read button."
                          className={`${fieldClass} resize-none font-medium`}
                          maxLength={300}
                          data-lenis-prevent
                        />
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          <span>Used as the preview snippet on cards</span>
                          <span>{articleSummary.length}/300</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className={labelClass}>Article Body</label>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
                          <div className="bg-slate-50/60 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-1">
                            {(
                              [
                                { id: "h1", label: "Heading 1", icon: Heading1 },
                                { id: "h2", label: "Heading 2", icon: Heading2 },
                                { id: "bold", label: "Bold", icon: Bold },
                                { id: "italic", label: "Italic", icon: Italic },
                                { id: "ul", label: "Bulleted list", icon: List },
                                { id: "ol", label: "Numbered list", icon: ListOrdered },
                                { id: "quote", label: "Quote", icon: Quote },
                                { id: "link", label: "Link", icon: LinkIcon },
                              ] as const
                            ).map((tool) => (
                              <button
                                key={tool.id}
                                type="button"
                                aria-label={tool.label}
                                title={tool.label}
                                onClick={() => applyToolbar(tool.id as ToolbarAction)}
                                className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                              >
                                <tool.icon className="w-4 h-4" />
                              </button>
                            ))}
                            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Markdown
                            </span>
                          </div>
                          <textarea
                            ref={articleBodyRef}
                            value={articleBody}
                            onChange={(e) => setArticleBody(e.target.value)}
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            placeholder={`# A great headline\n\nOpen with a strong hook so subscribers want to keep reading.\n\n## Section heading\n\n- Tell a clear story.\n- Use lists, **bold**, *italic*, and > quotes for emphasis.\n- Add [links](https://example.com) when you want to credit a source.`}
                            className="block w-full px-6 py-6 bg-white focus:outline-none font-medium text-slate-950 placeholder:text-slate-400 leading-relaxed resize-y h-[420px] min-h-[280px] max-h-[640px] overflow-y-auto overscroll-contain"
                            style={{ scrollbarWidth: "thin" }}
                            data-lenis-prevent
                            spellCheck
                          />
                          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <span>
                              {articleWordCount.toLocaleString()} words ·{" "}
                              {articleReadMinutes} min read
                            </span>
                            <span className="hidden sm:inline">
                              Tip: Use the toolbar to insert headings, lists, and links.
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {mode === "File" && (
                    <div className="space-y-3">
                      <label className={labelClass}>File Attachment</label>
                      <UploadField
                        label={`Click to upload or drag ${fileSubtype.toUpperCase()} file here`}
                        helper={`PDF, ZIP, or RAR · max ${formatBytes(STORAGE_LIMITS.downloadableMaxBytes)}.`}
                        accept=".pdf,.zip,.rar,application/pdf,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed"
                        file={downloadableFile}
                        onChange={setDownloadableFile}
                      />
                      {initialContent?.fileUrl && !downloadableFile && <p className={helperClass}>Existing file will be preserved.</p>}
                    </div>
                  )}
                </div>
              </div>
            </MotionReveal>
          </div>

          <div className="lg:col-span-1 space-y-10">
            <MotionReveal className="sticky top-24 space-y-10">
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black font-display text-slate-900 mb-8">Access Control</h3>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className={labelClass}>Visibility</label>
                    <select
                      value={requiredPlan}
                      onChange={(e) => setRequiredPlan(e.target.value as RequiredPlan)}
                      className={`${fieldClass} appearance-none`}
                    >
                      <option value="free">Free (Public)</option>
                      <option value="basic">Basic Plan</option>
                      <option value="premium">Premium Plan</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className={labelClass}>Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "draft" | "published")}
                      className={`${fieldClass} appearance-none`}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Public</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.25em] mb-6 block">Subscriber Preview</h3>
                <div className="rounded-[2rem] border border-slate-100 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] group">
                  <div className="aspect-video bg-slate-50 flex items-center justify-center relative overflow-hidden">
                    {thumbnailFile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={URL.createObjectURL(thumbnailFile)} alt="" className="w-full h-full object-cover" />
                    ) : existingThumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={existingThumbnail} alt="" className="w-full h-full object-cover" />
                    ) : mode === "Video" ? (
                      <Video className="w-8 h-8 text-slate-200" />
                    ) : mode === "File" ? (
                      <FileArchive className="w-8 h-8 text-slate-200" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-200" />
                    )}
                    {requiredPlan !== "free" && (
                      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black text-white tracking-widest uppercase shadow-xl">
                        {requiredPlan}
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-white">
                    <h4 className="font-black text-slate-900 mb-2 line-clamp-1">{title || "Untitled Content"}</h4>
                    <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                      <span className="uppercase tracking-[0.1em] text-teal-600">
                        {mode === "File" ? fileSubtype.toUpperCase() : mode}
                      </span>
                      <span className="opacity-30">.</span>
                      <span>{titleCase(status)}</span>
                    </p>
                  </div>
                </div>
                <div className="pt-8 mt-4 border-t border-slate-50 space-y-4">
                  {isSubmitting && (videoFile || downloadableFile) ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-700">
                        <span>
                          {uploadProgress < 99
                            ? `Uploading… ${uploadProgress}%`
                            : uploadProgress < 100
                              ? "Processing…"
                              : (
                                <span className="flex items-center gap-1.5 text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Upload complete
                                </span>
                              )}
                        </span>
                        <span className="text-slate-400">
                          {videoFile?.name || downloadableFile?.name}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-200 ease-out",
                            uploadProgress >= 100 ? "bg-emerald-500" : "bg-teal-500"
                          )}
                          style={{ width: `${Math.max(uploadProgress, 4)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="flex gap-3">
                    <Button type="submit" variant="primary" className="w-full h-14 rounded-2xl" disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : formMode === "edit" ? "Save Changes" : "Create Content"}
                    </Button>
                  </div>
                </div>
              </div>

            </MotionReveal>
          </div>
        </div>
      </form>
    </CreatorShell>
  );
}
