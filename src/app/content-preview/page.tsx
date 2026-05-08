"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PublicContentPreviewGrid, type PublicPreviewCard } from "@/components/cards/PublicContentPreviewGrid";
import { Search, Play, FileText, LayoutGrid, CheckCircle2, Lock } from "lucide-react";
import type { PublicContent } from "@/lib/mongodb/public-data";

function publicContentToPreviewCard(
  content: PublicContent,
  unlockHref: string
): PublicPreviewCard {
  const type =
    content.contentType === "video"
      ? "Video"
      : content.contentType === "article"
        ? "Article"
        : ((content.fileSubtype || "pdf").toUpperCase() as
            | "PDF"
            | "ZIP"
            | "RAR");

  const isLocked = content.requiredPlan !== "free";
  const slugOrId = content.slug || content.id;

  return {
    id: content.id,
    type,
    title: content.title,
    creator: content.creatorName,
    creatorSlug: content.creatorSlug,
    plan:
      content.requiredPlan === "premium"
        ? "Premium"
        : content.requiredPlan === "basic"
          ? "Basic"
          : "Free",
    isLocked,
    thumbnailUrl: content.thumbnailUrl,
    ctaText: isLocked
      ? "Upgrade To Unlock"
      : type === "Video"
        ? "Watch Preview"
        : type === "Article"
          ? "Read Article"
          : "View File",
    href: isLocked ? unlockHref : `/library/${slugOrId}`,
    unlockHref,
  };
}

const ACCESS_LEVELS = [
  {
    title: "Free Access",
    badge: "Free",
    description: "Free subscribers can view public previews, sample articles, and selected starter resources.",
  },
  {
    title: "Basic Access",
    badge: "Basic",
    description: "Basic subscribers unlock deeper guides, PDFs, ZIP files, and focused premium resources.",
  },
  {
    title: "Premium Access",
    badge: "Premium",
    description: "Premium subscribers unlock the full library, video content, downloads, templates, and private resources.",
  },
];

const UX_FEATURES = [
  {
    icon: <Play className="w-6 h-6 text-emerald-500" />,
    title: "Large thumbnails for video discovery.",
  },
  {
    icon: <CheckCircle2 className="w-6 h-6 text-sky-500" />,
    title: "Clear badges for content type and plan level.",
  },
  {
    icon: <Lock className="w-6 h-6 text-slate-500" />,
    title: "Locked states that explain what to do next.",
  },
  {
    icon: <LayoutGrid className="w-6 h-6 text-violet-500" />,
    title: "Simple library structure for repeat subscribers.",
  },
];

export default function ContentPreviewPage() {
  const { isSignedIn } = useAuth();
  const [contentCards, setContentCards] = useState<PublicPreviewCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const unlockHref = isSignedIn
    ? "/pricing"
    : "/login?redirect_url=%2Flibrary";

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/public/content", { cache: "no-store" });
        const data = (await res.json()) as { content: PublicContent[] };
        if (!cancelled) {
          setContentCards(
            (data.content ?? [])
              .slice(0, 12)
              .map((c) => publicContentToPreviewCard(c, unlockHref))
          );
        }
      } catch {
        if (!cancelled) setContentCards([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadContent();
    return () => {
      cancelled = true;
    };
  }, [unlockHref]);

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-48 bg-[var(--color-paper)]">
      
      {/* ── 1. Hero Section ── */}
      <section className="relative mb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] bg-sky-400/10 rounded-full blur-[72px] opacity-60 -z-10 motion-reduce:blur-none" />
        
        <Container className="relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Hero Text */}
            <MotionReveal staggerChildren={0.1}>
              <MotionItem className="flex flex-wrap gap-3 mb-6">
                <Badge variant="sky">Video Library</Badge>
                <Badge variant="emerald">Articles</Badge>
                <Badge variant="default">Premium Downloads</Badge>
              </MotionItem>

              <MotionItem>
                <h1 className="text-5xl md:text-6xl lg:text-[4rem] font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.05] mb-6">
                  Preview The Subscriber <span className="text-gradient-primary">Content Experience</span>
                </h1>
              </MotionItem>

              <MotionItem>
                <p className="text-lg md:text-xl text-[var(--color-muted)] mb-10 leading-relaxed font-medium max-w-lg">
                  Browse videos, articles, downloads, and premium resources in a content library designed for paid memberships.
                </p>
              </MotionItem>

              <MotionItem className="flex flex-col sm:flex-row gap-4">
                <Button variant="primary" size="lg" href="/pricing" className="w-full sm:w-auto min-w-[180px]">
                  View Plans
                </Button>
                <Button variant="secondary" size="lg" href="/sign-up" className="w-full sm:w-auto min-w-[180px]">
                  Start Free
                </Button>
              </MotionItem>
            </MotionReveal>

            {/* Hero Visual: Mini Content Browser */}
            <MotionReveal className="hidden lg:block">
              <MotionItem className="glass-panel p-6 rounded-3xl border border-slate-200/60 shadow-2xl relative rotate-2 hover:rotate-0 transition-transform duration-700 ease-out">
                {/* Fake Search Bar */}
                <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-full px-4 py-3 mb-6 shadow-sm">
                  <Search className="w-5 h-5 text-slate-300" />
                  <div className="h-4 w-32 bg-slate-100 rounded-md" />
                </div>

                {/* Fake Filters */}
                <div className="flex gap-2 mb-6 overflow-hidden">
                  <div className="px-4 py-1.5 bg-[var(--color-ink)] rounded-full h-7 w-16" />
                  <div className="px-4 py-1.5 bg-slate-100 rounded-full h-7 w-20" />
                  <div className="px-4 py-1.5 bg-slate-100 rounded-full h-7 w-20" />
                  <div className="px-4 py-1.5 bg-slate-100 rounded-full h-7 w-24" />
                </div>

                {/* Fake Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Item 1 - Video Unlocked */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
                    <div className="aspect-video bg-slate-100 rounded-xl mb-3 flex items-center justify-center">
                      <Play className="w-6 h-6 text-slate-300" />
                    </div>
                    <div className="h-3 w-3/4 bg-slate-200 rounded-full mb-2" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded-full" />
                  </div>
                  
                  {/* Item 2 - Premium Locked */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm relative overflow-hidden">
                    <div className="aspect-video bg-slate-100 rounded-xl mb-3 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-slate-300" />
                    </div>
                    <div className="h-3 w-5/6 bg-slate-200 rounded-full mb-2" />
                    <div className="h-3 w-1/3 bg-slate-100 rounded-full" />
                    
                    {/* Locked Overlay */}
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                      <div className="bg-white px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                        <Lock className="w-3 h-3 text-slate-800" />
                        <span className="text-[10px] font-bold text-slate-900">Premium</span>
                      </div>
                    </div>
                  </div>
                </div>
              </MotionItem>
            </MotionReveal>
          </div>
        </Container>
      </section>

      {/* ── 2. Content grid ── */}
      <Container>
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-sm font-bold text-slate-600">
            Loading public content…
          </div>
        ) : contentCards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-base font-black text-slate-900 mb-2">No public content to preview yet</p>
            <p className="text-sm font-medium text-slate-600 max-w-lg mx-auto mb-6">
              When creators publish videos, articles, or files, they will show up here. Sign in to explore your full library.
            </p>
            <Button variant="primary" href="/sign-up">
              Start Free
            </Button>
          </div>
        ) : (
          <PublicContentPreviewGrid cards={contentCards} />
        )}
      </Container>

      {/* ── 3. Featured Content Grid ── */}

      {/* ── 4. Membership Access Explanation ── */}
      <section className="py-24 bg-white border-y border-[var(--color-border)]">
        <Container>
          <MotionReveal className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)] mb-4">Every Resource Belongs To A Plan</h2>
            <p className="text-lg text-[var(--color-muted)] max-w-2xl mx-auto">Control exactly who gets access to your valuable content.</p>
          </MotionReveal>

          <MotionReveal className="grid md:grid-cols-3 gap-8" staggerChildren={0.15}>
            {ACCESS_LEVELS.map((level, i) => (
              <MotionItem key={i} className="bg-[var(--color-paper)] p-8 rounded-3xl border border-slate-100 hover:shadow-lg transition-shadow duration-300">
                <Badge variant={level.badge === "Basic" ? "emerald" : level.badge === "Premium" ? "sky" : "default"} className="mb-6">
                  {level.badge}
                </Badge>
                <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-3">{level.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{level.description}</p>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 5. Subscriber Viewing Experience ── */}
      <section className="py-24 bg-[var(--color-paper)]">
        <Container>
          <MotionReveal className="mb-16">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)] max-w-2xl">Built For Familiar, Fast Content Browsing</h2>
          </MotionReveal>

          <MotionReveal className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8" staggerChildren={0.1}>
            {UX_FEATURES.map((feat, i) => (
              <MotionItem key={i} className="glass-panel p-6 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-5 border border-slate-100">
                  {feat.icon}
                </div>
                <p className="font-bold text-[var(--color-ink)] leading-snug">{feat.title}</p>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 6. Final Call to Action ── */}
      <section className="py-32 relative overflow-hidden bg-white border-t border-[var(--color-border)]">
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-400/10 rounded-full blur-[64px] pointer-events-none motion-reduce:blur-none" />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-sky-400/10 rounded-full blur-[56px] pointer-events-none motion-reduce:blur-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black font-display text-[var(--color-ink)] mb-8 tracking-tight leading-[1.05]">
                Turn Your Content Library Into A <span className="text-gradient-primary">Paid Membership</span>
              </h2>
            </MotionItem>
            <MotionItem>
              <p className="text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
                Use Nexora to organise videos, articles, PDFs, ZIP files, and private resources behind plan based access.
              </p>
            </MotionItem>
            <MotionItem className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button variant="primary" size="lg" href="/pricing" className="w-full sm:w-auto min-w-[200px]">
                View Pricing
              </Button>
              <Button variant="secondary" size="lg" href="/sign-up" className="w-full sm:w-auto min-w-[200px]">
                Start Free
              </Button>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

    </div>
  );
}
