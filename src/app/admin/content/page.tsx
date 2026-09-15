"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Search,
  Filter,
  Video,
  FileText,
  FileArchive,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { AdminPager } from "@/components/admin/AdminPager";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { cn } from "@/lib/utils";
import type {
  AdminContentResponse,
  AdminContentRow,
} from "@/types/admin-stats";

const TYPE_FILTERS: Array<{
  id: "all" | "video" | "article" | "file";
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "video", label: "Video" },
  { id: "article", label: "Article" },
  { id: "file", label: "File" },
];

function contentIcon(type: AdminContentRow["contentType"]) {
  if (type === "video") return <Video className="w-5 h-5" />;
  if (type === "article") return <FileText className="w-5 h-5" />;
  return <FileArchive className="w-5 h-5" />;
}

function typeLabel(type: AdminContentRow["contentType"], subtype: string) {
  if (type === "video") return "Video";
  if (type === "article") return "Article";
  if (subtype) return subtype.toUpperCase();
  return "File";
}

function statusTone(status: AdminContentRow["status"]) {
  if (status === "published")
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "draft") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

export default function AdminContentPage() {
  const [data, setData] = useState<AdminContentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] =
    useState<(typeof TYPE_FILTERS)[number]["id"]>("all");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const loadContent = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        q: debouncedQuery,
      });
      const res = await fetch(`/api/admin/content?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to load content.");
      }
      const json = (await res.json()) as AdminContentResponse;
      setData(json);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load content."
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedQuery]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  async function handleAction(
    contentId: string,
    action: "approve" | "archive" | "draft"
  ) {
    if (actionPending) return;
    setActionPending(contentId);
    setActionError("");
    try {
      const res = await fetch(
        `/api/admin/content/${encodeURIComponent(contentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to update content.");
      }
      await loadContent();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update content."
      );
    } finally {
      setActionPending(null);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.content.filter((row) => {
      const matchesQuery =
        !needle ||
        row.title.toLowerCase().includes(needle) ||
        row.creatorName.toLowerCase().includes(needle);
      const matchesType = typeFilter === "all" || row.contentType === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [data, query, typeFilter]);

  const metrics = data?.metrics;

  const formatNumber = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Asset Management"
          title="Content Library"
          subtitle="Review videos, articles, PDF, ZIP, and RAR files, and the plan each item requires."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<Video className="w-4 h-4 ml-1" />}
              href="/api/admin/content?format=csv"
              title="Download a CSV of all content"
            >
              Export CSV
            </Button>
          }
        />

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
            {errorMessage}
          </div>
        )}
        {actionError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
            {actionError}
          </div>
        )}

        <MotionItem>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-5">
                <Video className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Total Published</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : formatNumber(metrics?.totalPublished ?? 0)}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mb-5">
                <FileArchive className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Resources (Files)</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : formatNumber(metrics?.totalResources ?? 0)}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Total Views</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : formatNumber(metrics?.totalViews ?? 0)}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Drafts</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : formatNumber(metrics?.pendingReview ?? 0)}
              </p>
            </div>
          </div>
        </MotionItem>

        <MotionItem>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title or creator…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto ml-auto flex-wrap">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              {TYPE_FILTERS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTypeFilter(option.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer",
                    typeFilter === option.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </MotionItem>

        <MotionReveal>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-sm font-bold text-slate-500">Loading content…</div>
            ) : filtered.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <Video className="w-7 h-7 text-slate-300" />
                </div>
                <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                  {data && data.content.length > 0 ? "No matches" : "No content yet"}
                </h3>
                <p className="text-sm text-slate-500 font-medium max-w-md">
                  {data && data.content.length > 0
                    ? "Try a different title, creator, or type filter."
                    : "Once creators publish, items will appear here."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-8">Content &amp; Creator</th>
                        <th className="p-8">Format &amp; Plan</th>
                        <th className="p-8">Status</th>
                        <th className="p-8">Engagement</th>
                        <th className="p-8 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filtered.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="p-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400 shadow-sm">
                                {contentIcon(item.contentType)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 mb-1 leading-none line-clamp-1">{item.title}</p>
                                <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest opacity-80">
                                  by {item.creatorName}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-8">
                            <div className="flex flex-col gap-2 items-start">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                {typeLabel(item.contentType, item.fileSubtype)}
                              </span>
                              <Badge
                                variant={
                                  item.accessLevel === "premium"
                                    ? "sky"
                                    : item.accessLevel === "basic"
                                      ? "emerald"
                                      : "default"
                                }
                              >
                                {item.accessLevel === "free"
                                  ? "Free"
                                  : item.accessLevel === "basic"
                                    ? "Basic"
                                    : "Premium"}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-8">
                            <Badge variant="default" className={statusTone(item.status)}>
                              {item.status === "published"
                                ? "Published"
                                : item.status === "draft"
                                  ? "Draft"
                                  : "Archived"}
                            </Badge>
                          </td>
                          <td className="p-8 font-black text-slate-900 text-xs">
                            {item.contentType === "file"
                              ? `${formatNumber(item.downloadsCount)} downloads`
                              : `${formatNumber(item.viewsCount)} views`}
                          </td>
                          <td className="p-8 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity">
                              {item.status !== "published" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-3 text-xs bg-white rounded-xl border-emerald-200 text-emerald-700 hover:border-emerald-300"
                                  onClick={() => handleAction(item.id, "approve")}
                                  disabled={actionPending === item.id}
                                >
                                  {actionPending === item.id ? "…" : "Approve"}
                                </Button>
                              )}
                              {item.status !== "archived" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-3 text-xs bg-white rounded-xl border-rose-200 text-rose-700 hover:border-rose-300"
                                  onClick={() => handleAction(item.id, "archive")}
                                  disabled={actionPending === item.id}
                                >
                                  {actionPending === item.id ? "…" : "Archive"}
                                </Button>
                              )}
                              {item.status === "archived" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-3 text-xs bg-white rounded-xl"
                                  onClick={() => handleAction(item.id, "draft")}
                                  disabled={actionPending === item.id}
                                >
                                  Restore
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                  {filtered.map((item) => (
                    <div key={item.id} className="p-6 space-y-6">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400 shadow-sm">
                          {contentIcon(item.contentType)}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 mb-1 leading-snug">{item.title}</p>
                          <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">
                            by {item.creatorName}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Format / Plan</p>
                          <div className="flex gap-2 items-center">
                            <Badge
                              variant={
                                item.accessLevel === "premium"
                                  ? "sky"
                                  : item.accessLevel === "basic"
                                    ? "emerald"
                                    : "default"
                              }
                              className="text-[10px] py-0.5"
                            >
                              {item.accessLevel === "free"
                                ? "Free"
                                : item.accessLevel === "basic"
                                  ? "Basic"
                                  : "Premium"}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Status</p>
                          <Badge variant="default" className={cn("text-[10px] py-0.5", statusTone(item.status))}>
                            {item.status === "published"
                              ? "Published"
                              : item.status === "draft"
                                ? "Draft"
                                : "Archived"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <AdminPager page={data?.page} onPage={setPage} />
              </>
            )}
          </div>
        </MotionReveal>
      </div>
    </AdminShell>
  );
}
