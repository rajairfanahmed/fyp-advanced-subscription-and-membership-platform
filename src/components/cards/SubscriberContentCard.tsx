"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Play } from "lucide-react";

interface SubscriberContentCardProps {
  title: string;
  creator: string;
  type: "Video" | "Article" | "PDF" | "ZIP" | "RAR";
  plan: "Free" | "Basic" | "Premium";
  isLocked: boolean;
  thumbnailPlaceholder?: boolean;
  thumbnailUrl?: string;
  ctaText?: string;
  creatorSlug?: string;
  /** Where the card thumbnail/title navigate when unlocked. */
  href?: string;
  /**
   * Where the CTA goes when the content is locked. Pages decide this so
   * signed-out viewers go to /login while signed-in subscribers go to
   * the upgrade flow (e.g. /pricing or the creator profile).
   */
  unlockHref?: string;
}

/**
 * SubscriberContentCard — a self-contained card that owns its own
 * `<Link>`s. Pages must NOT wrap this in another `<Link>` (that would
 * produce nested anchors and the React 18 hydration error
 * `<a> cannot be a descendant of <a>`).
 */
export function SubscriberContentCard({
  title,
  creator,
  type,
  plan,
  isLocked,
  thumbnailPlaceholder = true,
  thumbnailUrl,
  ctaText,
  creatorSlug,
  href,
  unlockHref,
}: SubscriberContentCardProps) {
  const ctaHref = isLocked ? unlockHref || "/creators" : href;
  const thumbnailHref = isLocked ? unlockHref || "/creators" : href;

  const thumbnailInner = (
    <>
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        thumbnailPlaceholder && (
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-200 to-slate-50 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
            {type === "Video" ? (
              <div className="w-16 h-16 rounded-full bg-white/50 backdrop-blur-md shadow-sm flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-slate-400 translate-x-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            ) : (
              <svg
                className="w-12 h-12 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
          </div>
        )
      )}

      {type === "Video" && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-white/50 transition-transform">
            <Play className="w-7 h-7 text-white fill-white drop-shadow ml-0.5" />
          </div>
        </div>
      )}

      {isLocked && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center z-10 transition-opacity duration-300">
          <div className="bg-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg mb-3">
            <svg
              className="w-4 h-4 text-slate-800"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-bold text-slate-900">
              {plan} Access Only
            </span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="group flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-xl transition-all duration-300 h-full">
      <div className="relative w-full aspect-video bg-slate-100 overflow-hidden">
        {thumbnailHref ? (
          <Link
            href={thumbnailHref}
            className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label={
              isLocked
                ? `Upgrade to unlock ${title}`
                : type === "Video"
                  ? `Play ${title}`
                  : `Open ${title}`
            }
          >
            {thumbnailInner}
          </Link>
        ) : (
          thumbnailInner
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant={isLocked ? "locked" : "default"}>{type}</Badge>
          <Badge variant={plan === "Premium" ? "emerald" : "sky"}>{plan}</Badge>
        </div>

        <h3 className="text-lg font-bold font-display text-[var(--color-ink)] mb-1 line-clamp-2">
          {href && !isLocked ? (
            <Link
              href={href}
              className="hover:text-emerald-700 transition-colors"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <p className="text-sm font-medium text-[var(--color-muted)] mb-6">
          {creatorSlug ? (
            <Link
              href={`/creators/${creatorSlug}`}
              className="hover:text-emerald-700 transition-colors"
            >
              {creator}
            </Link>
          ) : (
            creator
          )}
        </p>

        <div className="mt-auto pt-4 border-t border-slate-100">
          {isLocked ? (
            <Button
              variant="outline"
              href={ctaHref || "/creators"}
              className="w-full text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              {ctaText || "Upgrade to Unlock"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              href={href}
              className="w-full"
            >
              {ctaText || (type === "Video" ? "Watch Now" : "View Content")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
