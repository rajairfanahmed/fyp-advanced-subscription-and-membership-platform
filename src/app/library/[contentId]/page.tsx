"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SubscriberContentCard } from "@/components/cards/SubscriberContentCard";
import { ArticleBody } from "@/components/article/ArticleBody";
import { Play, Download, FileText, FileArchive, CheckCircle2, ChevronLeft, Lock } from "lucide-react";
import type { ContentResponse, RequiredPlan } from "@/types/content";
import type { PublicCreatorPlan } from "@/lib/mongodb/public-data";

const PLAN_RANK: Record<RequiredPlan, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

function planLabel(plan: string) {
  return plan === "premium" ? "Premium" : plan === "basic" ? "Basic" : "Free";
}

function typeLabel(content: ContentResponse) {
  if (content.contentType === "video") return "Video";
  if (content.contentType === "article") return "Article";
  return content.fileSubtype ? content.fileSubtype.toUpperCase() : "File";
}

function cardType(content: ContentResponse): "Video" | "Article" | "PDF" | "ZIP" | "RAR" {
  if (content.contentType === "video") return "Video";
  if (content.contentType === "article") return "Article";
  return ((content.fileSubtype || "pdf").toUpperCase() as "PDF" | "ZIP" | "RAR");
}

export default function ContentDetailPage() {
  const params = useParams<{ contentId: string }>();
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [relatedContent, setRelatedContent] = useState<ContentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatorPlans, setCreatorPlans] = useState<PublicCreatorPlan[]>([]);
  const [checkoutPending, setCheckoutPending] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [quota, setQuota] = useState<{
    monthlyLimit: number | null;
    remaining: number | null;
    accessLevel: "free" | "basic" | "premium";
    windowEnd: string;
  } | null>(null);
  const watchEventReportedRef = React.useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const res = await fetch(`/api/content/${encodeURIComponent(params.contentId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Content not found.");
        const data = (await res.json()) as { content: ContentResponse };
        if (cancelled) return;
        setContent(data.content);

        // Fire-and-forget view counter. We use the server id (not the
        // possibly-slug param) so the counter resolves even if the
        // route param was a slug; failures are silent so a flaky
        // counter never blocks rendering the page.
        try {
          fetch(`/api/content/${encodeURIComponent(data.content.id)}/view`, {
            method: "POST",
            cache: "no-store",
          }).catch(() => {});
        } catch {
          // ignore
        }

        const relatedRes = await fetch("/api/content", { cache: "no-store" });
        if (relatedRes.ok) {
          const relatedData = (await relatedRes.json()) as { content: ContentResponse[] };
          if (!cancelled) setRelatedContent(relatedData.content.filter((item) => item.id !== data.content.id).slice(0, 4));
        }

        if (data.content.creatorSlug) {
          try {
            const creatorRes = await fetch(
              `/api/public/creators/${encodeURIComponent(data.content.creatorSlug)}`,
              { cache: "no-store" }
            );
            if (creatorRes.ok) {
              const creatorData = (await creatorRes.json()) as {
                plans?: PublicCreatorPlan[];
              };
              if (!cancelled) setCreatorPlans(creatorData.plans ?? []);
            }
          } catch {
            // Plans being unavailable is fine; the lock state still renders.
          }
        }
      } catch {
        if (!cancelled) setError("This content is not available yet.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (params.contentId) loadContent();
    return () => {
      cancelled = true;
    };
  }, [params.contentId]);

  const isLocked = content
    ? content.accessGranted === false ||
      (content.accessGranted === undefined && content.requiredPlan !== "free")
    : false;

  const upgradePlan = useMemo(() => {
    if (!content || !isLocked || creatorPlans.length === 0) return null;
    const requiredRank = PLAN_RANK[content.requiredPlan];
    const candidates = creatorPlans
      .filter(
        (plan) =>
          plan.accessLevel !== "free" &&
          plan.stripeReady &&
          PLAN_RANK[plan.accessLevel] >= requiredRank
      )
      .sort(
        (a, b) => PLAN_RANK[a.accessLevel] - PLAN_RANK[b.accessLevel]
      );
    return candidates[0] ?? null;
  }, [content, isLocked, creatorPlans]);

  async function handleDownload() {
    if (!content || downloadPending) return;
    setDownloadPending(true);
    setDownloadError("");
    try {
      const res = await fetch(
        `/api/content/${encodeURIComponent(content.id)}/download`,
        { method: "POST", cache: "no-store" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        fileUrl?: string;
        fileName?: string;
        error?: string;
        quota?: {
          monthlyLimit: number | null;
          remaining: number | null;
          accessLevel: "free" | "basic" | "premium";
          windowEnd: string;
        };
      };
      if (data.quota) setQuota(data.quota);
      if (!res.ok || !data.fileUrl) {
        throw new Error(data.error || "Download is unavailable.");
      }
      window.location.href = data.fileUrl;
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Download is unavailable."
      );
    } finally {
      setDownloadPending(false);
    }
  }

  function handleVideoTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!content || watchEventReportedRef.current) return;
    const video = event.currentTarget;
    if (!video.duration || !Number.isFinite(video.duration)) return;
    const percent = Math.round((video.currentTime / video.duration) * 100);
    if (percent < 90) return;

    watchEventReportedRef.current = true;
    fetch(`/api/content/${encodeURIComponent(content.id)}/event`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "watch_completion", percent }),
    }).catch(() => {
      watchEventReportedRef.current = false;
    });
  }

  function handleVideoEnded() {
    if (!content || watchEventReportedRef.current) return;
    watchEventReportedRef.current = true;
    fetch(`/api/content/${encodeURIComponent(content.id)}/event`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "watch_completion", percent: 100 }),
    }).catch(() => {
      watchEventReportedRef.current = false;
    });
  }

  async function handleUpgrade() {
    if (!upgradePlan) return;
    setCheckoutPending(upgradePlan.id);
    setCheckoutError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: upgradePlan.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Failed to start checkout."
      );
      setCheckoutPending(null);
    }
  }

  const relatedCards = useMemo(
    () =>
      relatedContent.map((item) => ({
        id: item.slug || item.id,
        type: cardType(item),
        title: item.title,
        creator: item.creatorName,
        creatorSlug: item.creatorSlug,
        plan: planLabel(item.requiredPlan) as "Free" | "Basic" | "Premium",
        isLocked: item.requiredPlan !== "free",
        thumbnailUrl: item.thumbnailUrl,
        href: `/library/${item.slug || item.id}`,
        unlockHref: item.creatorSlug ? `/creators/${item.creatorSlug}` : "/pricing",
      })),
    [relatedContent]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen pt-32 pb-20 bg-[var(--color-paper)]">
        <Container>
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-sm font-bold text-slate-500">Loading content...</div>
        </Container>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex flex-col min-h-screen pt-32 pb-20 bg-[var(--color-paper)]">
        <Container>
          <Link href="/library" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[var(--color-ink)] transition-colors mb-6">
            <ChevronLeft className="w-4 h-4" />
            Back to Library
          </Link>
          <div className="bg-white rounded-3xl border border-slate-200 p-8">
            <p className="text-lg font-black text-slate-800 mb-2">Content not found</p>
            <p className="text-sm font-medium text-slate-500">{error || "This content is not available."}</p>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 bg-[var(--color-paper)]">
      <Container className="max-w-[1400px]">
        <MotionReveal className="mb-6">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[var(--color-ink)] transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </MotionReveal>

        <div className="grid lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2 space-y-8">
            <MotionReveal>
              <div className="w-full aspect-video bg-slate-900 rounded-3xl overflow-hidden relative shadow-2xl group flex items-center justify-center">
                {content.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={content.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                )}
                {isLocked && (
                  <div className="absolute inset-0 z-20 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <Lock className="w-10 h-10 mb-3" />
                    <p className="font-black">Upgrade required</p>
                  </div>
                )}
                {content.contentType === "video" && !isLocked && content.videoUrl ? (
                  <video
                    src={content.videoUrl}
                    controls
                    poster={content.thumbnailUrl}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onEnded={handleVideoEnded}
                    className="relative z-10 w-full h-full object-cover"
                  />
                ) : content.contentType === "video" ? (
                  <button className="relative z-10 w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
                    <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                  </button>
                ) : content.contentType === "file" ? (
                  <div className="relative z-10 w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                    <Download className="w-9 h-9 text-white" />
                  </div>
                ) : (
                  <div className="relative z-10 w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                    <FileText className="w-9 h-9 text-white" />
                  </div>
                )}
              </div>
            </MotionReveal>

            <MotionReveal>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge variant="emerald">{typeLabel(content)}</Badge>
                <Badge variant={content.requiredPlan === "premium" ? "sky" : "default"}>{planLabel(content.requiredPlan)} Access</Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)] mb-3 leading-tight">
                {content.title}
              </h1>
              <div className="flex items-center gap-3 text-[var(--color-muted)] font-medium">
                <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-500 font-bold text-sm">
                  {content.creatorName.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </div>
                <Link href={`/creators/${content.creatorSlug}`} className="hover:text-emerald-600 transition-colors">
                  By {content.creatorName}
                </Link>
              </div>
            </MotionReveal>

            <div className="w-full h-px bg-slate-200 my-8" />

            {content.contentType === "article" ? (
              <MotionReveal>
                <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-4">Article</h3>
                <article className="bg-white rounded-3xl border border-slate-200 p-6 md:p-10">
                  {isLocked ? (
                    <p className="text-lg text-slate-500 italic leading-relaxed">
                      {content.articleSummary ||
                        content.description ||
                        "Subscribe to read the full article."}
                    </p>
                  ) : (
                    <ArticleBody source={content.articleBody} />
                  )}
                </article>
              </MotionReveal>
            ) : (
              <MotionReveal>
                <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-4">
                  {content.contentType === "file" ? "About this download" : "About this lesson"}
                </h3>
                <p className="text-lg text-slate-600 leading-relaxed">
                  {content.description || content.articleSummary || "No description has been added yet."}
                </p>
              </MotionReveal>
            )}

            {content.contentType === "file" && !isLocked && content.fileUrl && (
              <MotionReveal className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 mt-10">
                <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-6">Download File</h3>
                {downloadError && (
                  <p className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4">
                    {downloadError}
                  </p>
                )}
                {quota && (
                  <p className="text-xs font-medium text-slate-500 mb-4">
                    {quota.monthlyLimit === null
                      ? `Premium tier · unlimited downloads.`
                      : `${quota.remaining ?? 0} of ${quota.monthlyLimit} downloads remaining this month.`}
                  </p>
                )}
                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-emerald-500">
                      <FileArchive className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-ink)] group-hover:text-emerald-600 transition-colors">{content.title}</h4>
                      <p className="text-sm font-medium text-slate-500">{typeLabel(content)} File {content.fileSizeLabel ? `- ${content.fileSizeLabel}` : ""}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloadPending}
                    aria-label="Download file"
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </MotionReveal>
            )}

            {isLocked ? (
              <MotionReveal className="bg-sky-50 border border-sky-100 rounded-3xl p-6 md:p-8 mt-10 space-y-4">
                <div className="flex gap-4 items-start">
                  <Lock className="w-6 h-6 text-sky-500 shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-sky-900 mb-2">
                      {planLabel(content.requiredPlan)} subscription required
                    </h4>
                    <p className="text-sky-800 font-medium leading-relaxed">
                      You&apos;re seeing the preview because your current access doesn&apos;t cover this content.
                      {upgradePlan
                        ? ` Subscribe to ${upgradePlan.name} to unlock the full ${content.contentType}.`
                        : " The creator hasn't connected a paid plan yet, so checkout isn't available."}
                    </p>
                  </div>
                </div>
                {checkoutError && (
                  <p className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                    {checkoutError}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {upgradePlan ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleUpgrade}
                      disabled={Boolean(checkoutPending)}
                    >
                      {checkoutPending
                        ? "Redirecting…"
                        : `Upgrade to ${upgradePlan.name} · $${upgradePlan.priceMonthly.toFixed(
                            upgradePlan.priceMonthly % 1 === 0 ? 0 : 2
                          )}/mo`}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      href={`/creators/${content.creatorSlug}`}
                    >
                      View creator profile
                    </Button>
                  )}
                  <Button variant="outline" href="/pricing">
                    Compare all plans
                  </Button>
                </div>
              </MotionReveal>
            ) : (
              <MotionReveal className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 md:p-8 mt-10 flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-emerald-900 mb-2">You have access</h4>
                  <p className="text-emerald-800 font-medium leading-relaxed">
                    Your current subscription includes this content. Enjoy the full {content.contentType} above.
                  </p>
                </div>
              </MotionReveal>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <MotionReveal>
                <h3 className="text-xl font-black font-display text-[var(--color-ink)] mb-6">Up Next</h3>
              </MotionReveal>
              <MotionReveal className="space-y-4" staggerChildren={0.1}>
                {relatedCards.map((card) => (
                  <MotionItem key={card.id}>
                    <SubscriberContentCard
                      {...card}
                      ctaText={card.isLocked ? "Upgrade" : "View"}
                    />
                  </MotionItem>
                ))}
              </MotionReveal>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
