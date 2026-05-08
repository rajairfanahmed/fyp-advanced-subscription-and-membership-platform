"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Archive,
  ArchiveRestore,
  FileArchive,
  FileText,
  MoreHorizontal,
  PlusCircle,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentResponse, ContentStatus, ContentType, RequiredPlan } from "@/types/content";

function typeLabel(item: ContentResponse) {
  if (item.contentType === "video") return "Video";
  if (item.contentType === "article") return "Article";
  return "File";
}

function subtypeLabel(item: ContentResponse) {
  return item.contentType === "file" && item.fileSubtype ? item.fileSubtype.toUpperCase() : "";
}

function engagementLabel(item: ContentResponse) {
  if (item.contentType === "file") return `${item.downloadsCount.toLocaleString()} downloads`;
  return `${item.viewsCount.toLocaleString()} views`;
}

function TypeIcon({ item }: { item: ContentResponse }) {
  if (item.contentType === "video") return <Video className="w-5 h-5" />;
  if (item.contentType === "file") return <FileArchive className="w-5 h-5" />;
  return <FileText className="w-5 h-5" />;
}

type StatusFilter = "all" | ContentStatus;
type TypeFilter = "all" | ContentType;
type TierFilter = "all" | RequiredPlan;

export default function ContentManagementPage() {
  const [content, setContent] = useState<ContentResponse[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const res = await fetch("/api/content?scope=creator", { cache: "no-store" });
        if (!res.ok) throw new Error("Content could not be loaded.");
        const data = (await res.json()) as { content: ContentResponse[] };
        if (!cancelled) setContent(data.content);
      } catch {
        if (!cancelled) setError("We could not load your creator content. Please refresh and try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadContent();
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape to close the open 3-dot menu so the user can dismiss it
  // without picking an action. Click-outside closing is handled
  // inside `ContentActionsMenu` via its own ref so we don't have
  // ref-timing issues across re-renders.
  useEffect(() => {
    if (!openMenuId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openMenuId]);

  const filteredContent = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return content.filter((item) => {
      if (needle && !item.title.toLowerCase().includes(needle)) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.contentType !== typeFilter) return false;
      if (tierFilter !== "all" && item.requiredPlan !== tierFilter) return false;
      return true;
    });
  }, [content, query, statusFilter, typeFilter, tierFilter]);

  const filterIsActive =
    statusFilter !== "all" || typeFilter !== "all" || tierFilter !== "all";

  function clearFilters() {
    setStatusFilter("all");
    setTypeFilter("all");
    setTierFilter("all");
  }

  async function callContentMutation(
    contentId: string,
    mode: "archive" | "unarchive" | "hard",
    options: {
      onSuccess: (data: { content?: ContentResponse }) => void;
      successMessage: string;
      errorContext: string;
    }
  ) {
    setBusyId(contentId);
    setOpenMenuId(null);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/content/${contentId}?mode=${mode}`, {
        method: "DELETE",
        credentials: "include",
      });
      // Always try to parse the JSON body so we can surface the
      // actual server error string instead of a generic message.
      let body: { content?: ContentResponse; deleted?: boolean; id?: string; error?: string } = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }
      if (!res.ok) {
        throw new Error(body.error || `${options.errorContext} (HTTP ${res.status}).`);
      }
      options.onSuccess(body);
      setMessage(options.successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${options.errorContext} Please try again.`);
    } finally {
      setBusyId(null);
    }
  }

  async function archiveContent(contentId: string) {
    await callContentMutation(contentId, "archive", {
      successMessage: "Content archived.",
      errorContext: "Content could not be archived.",
      onSuccess: (data) => {
        if (data.content) {
          setContent((items) => items.map((item) => (item.id === contentId ? data.content! : item)));
        }
      },
    });
  }

  async function unarchiveContent(contentId: string) {
    await callContentMutation(contentId, "unarchive", {
      successMessage: "Content moved back to drafts.",
      errorContext: "Content could not be restored.",
      onSuccess: (data) => {
        if (data.content) {
          setContent((items) => items.map((item) => (item.id === contentId ? data.content! : item)));
        }
      },
    });
  }

  async function hardDeleteContent(contentId: string) {
    setConfirmDeleteId(null);
    await callContentMutation(contentId, "hard", {
      successMessage: "Content permanently deleted.",
      errorContext: "Content could not be deleted.",
      onSuccess: () => {
        setContent((items) => items.filter((item) => item.id !== contentId));
      },
    });
  }

  return (
    <CreatorShell>
      <div className="space-y-12">
        <DashboardHeader
          eyebrow="Studio Assets"
          title="Content Management"
          subtitle="Create, organise, publish, and control access for videos, articles, and files from one control centre."
          action={
            <Button variant="primary" href="/creator/content/new" icon={<PlusCircle className="w-4 h-4 ml-1" />}>
              Add Content
            </Button>
          }
        />

        <MotionItem>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search content by title..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm font-medium"
                />
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest sm:ml-auto self-center">
                {filteredContent.length} of {content.length}
              </div>
              {filterIsActive && (
                <Button
                  variant="outline"
                  className="h-10 px-3 text-[10px]"
                  onClick={clearFilters}
                  icon={<X className="w-3.5 h-3.5 ml-1" />}
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="px-5 py-4 space-y-3 bg-slate-50/40">
              <FilterRow
                label="Status"
                options={[
                  { value: "all", label: "All" },
                  { value: "draft", label: "Draft" },
                  { value: "published", label: "Published" },
                  { value: "archived", label: "Archived" },
                ] as const}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
              />
              <FilterRow
                label="Type"
                options={[
                  { value: "all", label: "All" },
                  { value: "video", label: "Video" },
                  { value: "article", label: "Article" },
                  { value: "file", label: "File" },
                ] as const}
                value={typeFilter}
                onChange={(v) => setTypeFilter(v)}
              />
              <FilterRow
                label="Tier"
                options={[
                  { value: "all", label: "All" },
                  { value: "free", label: "Free" },
                  { value: "basic", label: "Basic" },
                  { value: "premium", label: "Premium" },
                ] as const}
                value={tierFilter}
                onChange={(v) => setTierFilter(v)}
              />
            </div>
          </div>
        </MotionItem>

        <MotionReveal>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
            {(error || message) && (
              <div
                className={cn(
                  "m-6 p-4 rounded-2xl text-sm font-bold border",
                  error
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                )}
              >
                {error || message}
              </div>
            )}
            {isLoading ? (
              <div className="p-10 text-sm font-bold text-slate-500">Loading content...</div>
            ) : filteredContent.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-lg font-black text-slate-700 mb-2">
                  {content.length === 0 ? "No creator content yet" : "No content matches the active filters."}
                </p>
                <p className="text-sm font-medium text-slate-500 mb-6">
                  {content.length === 0
                    ? "Create your first video, article, or file to populate this studio."
                    : "Adjust the filters above or clear them to see all of your content."}
                </p>
                {content.length === 0 ? (
                  <Button href="/creator/content/new" variant="primary">Create Content</Button>
                ) : (
                  <Button variant="outline" onClick={clearFilters} icon={<X className="w-3.5 h-3.5 ml-1" />}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-8">Asset Details</th>
                        <th className="p-8">Access Tier</th>
                        <th className="p-8">Status</th>
                        <th className="p-8">Engagement</th>
                        <th className="p-8 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredContent.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="p-8">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400 shadow-sm group-hover:bg-white transition-colors">
                                <TypeIcon item={item} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 mb-1 leading-snug">{item.title}</p>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-80">
                                  {typeLabel(item)} {subtypeLabel(item) && <span className="opacity-60">({subtypeLabel(item)})</span>}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-8">
                            <Badge variant={item.requiredPlan === "premium" ? "sky" : "emerald"} className="uppercase tracking-widest text-[9px] border-transparent">{item.requiredPlan}</Badge>
                          </td>
                          <td className="p-8">
                            <Badge
                              variant={item.status === "published" ? "default" : "locked"}
                              className={cn(
                                "uppercase tracking-widest text-[9px] border-transparent font-black",
                                item.status === "published" ? "bg-emerald-50 text-emerald-700" : item.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {item.status}
                            </Badge>
                          </td>
                          <td className="p-8 font-black text-[10px] uppercase tracking-widest text-slate-400 opacity-80">
                            {engagementLabel(item)}
                          </td>
                          <td className="p-8 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <Button variant="outline" size="sm" href={`/creator/content/${item.id}/edit`} className="h-9 px-4 text-xs bg-white rounded-xl">Edit</Button>
                              <ContentActionsMenu
                                item={item}
                                isOpen={openMenuId === item.id}
                                onOpen={() => setOpenMenuId(item.id)}
                                onClose={() => setOpenMenuId(null)}
                                onArchive={() => archiveContent(item.id)}
                                onUnarchive={() => unarchiveContent(item.id)}
                                onDelete={() => setConfirmDeleteId(item.id)}
                                disabled={busyId === item.id}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                  {filteredContent.map((item) => (
                    <div key={item.id} className="p-6 space-y-6">
                      <div className="flex gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400 shadow-sm">
                          <TypeIcon item={item} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 mb-1 leading-snug">{item.title}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{typeLabel(item)} {subtypeLabel(item)}</span>
                            <span className="text-slate-200">.</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{engagementLabel(item)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                        <div className="flex gap-2">
                          <Badge variant={item.requiredPlan === "premium" ? "sky" : "emerald"} className="text-[9px] py-0.5 uppercase tracking-widest">{item.requiredPlan}</Badge>
                          <Badge variant={item.status === "published" ? "default" : "locked"} className={cn("text-[9px] py-0.5 uppercase tracking-widest font-black", item.status === "published" ? "bg-emerald-50 text-emerald-700" : item.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" href={`/creator/content/${item.id}/edit`} className="h-9 px-4 text-xs bg-white rounded-xl">Edit</Button>
                          <ContentActionsMenu
                            item={item}
                            isOpen={openMenuId === item.id}
                            onOpen={() => setOpenMenuId(item.id)}
                            onClose={() => setOpenMenuId(null)}
                            onArchive={() => archiveContent(item.id)}
                            onUnarchive={() => unarchiveContent(item.id)}
                            onDelete={() => setConfirmDeleteId(item.id)}
                            disabled={busyId === item.id}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </MotionReveal>
      </div>

      {confirmDeleteId && (
        <DeleteConfirmDialog
          item={content.find((c) => c.id === confirmDeleteId) ?? null}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => hardDeleteContent(confirmDeleteId)}
        />
      )}
    </CreatorShell>
  );
}

function FilterRow<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: TValue; label: string }>;
  value: TValue;
  onChange: (next: TValue) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] w-16 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "h-8 px-3.5 rounded-full border text-[11px] font-bold transition-colors",
                active
                  ? "bg-teal-600 border-teal-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContentActionsMenu({
  item,
  isOpen,
  onOpen,
  onClose,
  onArchive,
  onUnarchive,
  onDelete,
  disabled,
}: {
  item: ContentResponse;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside-click. We listen on the `click` (NOT `mousedown`)
  // event so the menu item's own onClick handler always fires first —
  // mousedown-based outside-listeners were sometimes pre-empting the
  // action click in nested table contexts which is why archive /
  // restore / delete looked "dead". The 1ms timeout ensures the
  // listener isn't registered during the very same event tick that
  // opened the menu (which would close it immediately on bubble).
  useEffect(() => {
    if (!isOpen) return;
    let attached = false;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      attached = true;
    }, 0);
    return () => {
      clearTimeout(timer);
      if (attached) document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Action handlers run BEFORE we close the menu so React doesn't
  // unmount the button mid-click. Closing happens inside the parent
  // mutation function via setOpenMenuId(null).
  const fireArchive = () => {
    if (disabled) return;
    onArchive();
  };
  const fireUnarchive = () => {
    if (disabled) return;
    onUnarchive();
  };
  const fireDelete = () => {
    if (disabled) return;
    onDelete();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          if (isOpen) onClose();
          else onOpen();
        }}
        disabled={disabled}
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-xl border transition-all",
          isOpen
            ? "border-teal-300 text-teal-700 bg-teal-50"
            : "border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 p-2"
        >
          {item.status === "archived" ? (
            <button
              type="button"
              role="menuitem"
              onClick={fireUnarchive}
              disabled={disabled}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ArchiveRestore className="w-4 h-4 text-emerald-600" />
              Restore to drafts
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={fireArchive}
              disabled={disabled}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Archive className="w-4 h-4 text-amber-600" />
              Archive
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={fireDelete}
            disabled={disabled}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            Delete permanently
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteConfirmDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: ContentResponse | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-8">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
          <Trash2 className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-xl font-black font-display text-slate-950 mb-2">Delete this content?</h2>
        <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
          You&apos;re about to permanently delete <span className="font-black text-slate-900">&ldquo;{item.title}&rdquo;</span> and its files. This cannot be undone.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} className="sm:w-auto">
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 sm:w-auto"
            icon={<Trash2 className="w-4 h-4 ml-1" />}
          >
            Delete forever
          </Button>
        </div>
      </div>
    </div>
  );
}
