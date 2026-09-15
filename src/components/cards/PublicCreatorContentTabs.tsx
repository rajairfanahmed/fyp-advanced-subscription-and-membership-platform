"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { BookOpen, Clock, Download, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { loginHref } from "@/lib/auth/post-login-redirect";
import type { PublicContent } from "@/lib/mongodb/public-data";

const TABS = ["Videos", "Articles", "Files"] as const;

function planLabel(plan: PublicContent["requiredPlan"]) {
  return plan === "premium" ? "Premium" : plan === "basic" ? "Basic" : "Free";
}

function contentTypeLabel(content: PublicContent) {
  if (content.contentType === "video") return "Video";
  if (content.contentType === "article") return "Article";
  return (content.fileSubtype || "pdf").toUpperCase();
}

function matchesTab(content: PublicContent, tab: (typeof TABS)[number]) {
  if (tab === "Videos") return content.contentType === "video";
  if (tab === "Articles") return content.contentType === "article";
  return content.contentType === "file";
}

const TIER_RANK: Record<PublicContent["requiredPlan"], number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

export function PublicCreatorContentTabs({
  content,
  viewerAccessLevel = "free",
}: {
  content: PublicContent[];
  viewerAccessLevel?: PublicContent["requiredPlan"];
}) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Videos");
  const { isLoaded, isSignedIn } = useAuth();
  const visibleContent = content.filter((item) => matchesTab(item, activeTab));
  const guest = !isLoaded || !isSignedIn;

  return (
    <>
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer",
              activeTab === tab
                ? "bg-[var(--color-ink)] text-white shadow-lg shadow-slate-900/10"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {visibleContent.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-sm font-bold text-slate-600">
          No published {activeTab.toLowerCase()} yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleContent.map((item) => {
            const locked =
              TIER_RANK[item.requiredPlan] > TIER_RANK[viewerAccessLevel];
            const libraryPath = `/library/${item.id}`;
            const href = guest ? loginHref(libraryPath) : libraryPath;
            const visuallyLocked = guest || locked;
            const openLabel =
              item.contentType === "video"
                ? visuallyLocked
                  ? `Sign in to play ${item.title}`
                  : `Play ${item.title}`
                : `Open ${item.title}`;
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 group"
              >
                <Link
                  href={href}
                  aria-label={openLabel}
                  className="relative block w-full aspect-video bg-gradient-to-br from-slate-100 to-emerald-50 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {item.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {item.contentType === "video" ? (
                      <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-white/50 transition-transform">
                        <Play className="w-7 h-7 text-white fill-white drop-shadow" />
                      </div>
                    ) : item.contentType === "file" ? (
                      <div className="w-14 h-14 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Download className="w-7 h-7 text-white drop-shadow" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <BookOpen className="w-7 h-7 text-white drop-shadow" />
                      </div>
                    )}
                  </div>
                  {item.videoDurationLabel && (
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-white/70" />
                      <span className="text-xs font-bold text-white">{item.videoDurationLabel}</span>
                    </div>
                  )}
                  {visuallyLocked && (
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                      <Lock className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {item.contentType === "file" && (
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1">
                      <span className="text-xs font-black text-slate-700">{contentTypeLabel(item)}</span>
                    </div>
                  )}
                </Link>
                <div className="p-5">
                  <h3 className="font-bold text-[var(--color-ink)] text-sm mb-3 leading-snug line-clamp-2">
                    <Link
                      href={href}
                      className="hover:text-emerald-700 hover:underline transition-colors"
                    >
                      {item.title}
                    </Link>
                  </h3>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">
                      {contentTypeLabel(item)}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border bg-slate-50 text-slate-700 border-slate-200">
                      {planLabel(item.requiredPlan)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
