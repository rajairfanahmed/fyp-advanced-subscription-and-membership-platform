"use client";

import React from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashboardPreviewCard } from "@/components/cards/DashboardPreviewCard";
import { SubscriberContentCard } from "@/components/cards/SubscriberContentCard";
import { BenefitCard } from "@/components/cards/BenefitCard";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import type { PublicContent } from "@/lib/mongodb/public-data";

type HomeContentCard = {
  title: string;
  creator: string;
  creatorSlug?: string;
  type: "Video" | "Article" | "PDF" | "ZIP" | "RAR";
  plan: "Free" | "Basic" | "Premium";
  isLocked: boolean;
  thumbnailUrl?: string;
  href?: string;
  unlockHref?: string;
};

const WORKFLOW_STEPS = [
  "Create a subscription plan.",
  "Publish premium content.",
  "Lock access by plan.",
  "Track revenue and engagement."
];

const CONTENT_TYPES = [
  { name: "Video content", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { name: "Articles", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
  { name: "PDF files", icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z M9 9h4v4H9z" },
  { name: "ZIP files", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
  { name: "Templates", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
  { name: "Private resources", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
];

function publicContentToHomeCard(content: PublicContent): HomeContentCard {
  const type =
    content.contentType === "video"
      ? "Video"
      : content.contentType === "article"
        ? "Article"
        : ((content.fileSubtype || "pdf").toUpperCase() as "PDF" | "ZIP" | "RAR");

  const isLocked = content.requiredPlan !== "free";
  const creatorHref = content.creatorSlug
    ? `/creators/${content.creatorSlug}`
    : "/creators";

  return {
    title: content.title,
    creator: content.creatorName,
    creatorSlug: content.creatorSlug,
    type,
    plan:
      content.requiredPlan === "premium"
        ? "Premium"
        : content.requiredPlan === "basic"
          ? "Basic"
          : "Free",
    isLocked,
    thumbnailUrl: content.thumbnailUrl,
    href: creatorHref,
    unlockHref: creatorHref,
  };
}

export default function HomePage() {
  const [homepageContent, setHomepageContent] = useState<HomeContentCard[]>([]);
  const [contentLoading, setContentLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicContent() {
      setContentLoading(true);
      try {
        const res = await fetch("/api/public/content", { cache: "no-store" });
        const data = (await res.json()) as { content: PublicContent[] };
        if (!cancelled) {
          setHomepageContent(
            (data.content ?? [])
              .slice(0, 6)
              .map((c) => publicContentToHomeCard(c))
          );
        }
      } catch {
        if (!cancelled) setHomepageContent([]);
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    }

    loadPublicContent();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* ── 1. Hero Section (Asymmetric) ── */}
      <section className="relative pt-32 lg:pt-48 pb-20 lg:pb-32 overflow-hidden border-b border-[var(--color-border)]">
        {/* Abstract daylight shapes */}
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-400/10 rounded-full blur-[72px] opacity-60 -z-10 translate-x-1/3 -translate-y-1/3 motion-reduce:blur-none" />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-sky-400/10 rounded-full blur-[64px] opacity-40 -z-10 -translate-x-1/3 translate-y-1/3 motion-reduce:blur-none" />
        
        <Container className="relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Copy & Actions */}
            <MotionReveal className="lg:col-span-5 flex flex-col justify-center" staggerChildren={0.1}>
              <MotionItem className="flex flex-wrap gap-3 mb-8">
                <Badge variant="emerald">Membership Plans</Badge>
                <Badge variant="sky">Locked Content</Badge>
                <Badge variant="default">Creator Analytics</Badge>
              </MotionItem>

              <MotionItem>
                <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.05] mb-6">
                  Turn Paid Content Into{" "}
                  <span className="text-gradient-primary">Recurring Membership Revenue</span>
                </h1>
              </MotionItem>

              <MotionItem>
                <p className="text-lg md:text-xl text-[var(--color-muted)] mb-10 leading-relaxed font-medium max-w-xl">
                  Advanced Subscription & Membership Platform helps creators sell premium videos, articles, and downloadable files through subscription plans, controlled access, and creator-first revenue tools.
                </p>
              </MotionItem>

              <MotionItem className="flex flex-col sm:flex-row gap-4">
                <Button variant="primary" size="lg" href="/pricing" className="w-full sm:w-auto">
                  View Plans
                </Button>
                <Button variant="secondary" size="lg" href="/content-preview" className="w-full sm:w-auto">
                  Explore Content
                </Button>
              </MotionItem>
            </MotionReveal>

            {/* Right Column: Premium Dashboard Preview */}
            <MotionReveal className="lg:col-span-7 relative" delay={0.2} duration={1}>
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-sky-500/5 rounded-[2.5rem] -rotate-3 scale-105 -z-10" />
              <DashboardPreviewCard />
            </MotionReveal>

          </div>
        </Container>
      </section>

      {/* ── 2. Trust Proof Section ── */}
      <section className="py-16 bg-white border-b border-[var(--color-border)]">
        <MotionReveal>
          <Container>
            <p className="text-xs font-bold text-slate-600 text-center uppercase tracking-[0.2em] mb-4 max-w-2xl mx-auto leading-relaxed">
              Built for independent creators, educators, and teams building recurring revenue — not placeholder brands.
            </p>
            <p className="text-sm font-medium text-slate-600 text-center max-w-xl mx-auto">
              Browse real published content below as creators go live on Advanced Subscription & Membership Platform.
            </p>
          </Container>
        </MotionReveal>
      </section>

      {/* ── 3. Subscriber Content Experience ── */}
      <section className="py-24 lg:py-32 bg-[var(--color-paper)] relative">
        <Container>
          <MotionReveal className="max-w-3xl mb-16">
            <h2 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-6 tracking-tight">
              A familiar, premium viewing experience
            </h2>
            <p className="text-xl text-[var(--color-muted)]">
              Build loyalty with an interface that feels like YouTube, but is designed exclusively for your paid members.
            </p>
          </MotionReveal>
          
          {contentLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-sm font-bold text-slate-600">
              Loading featured content…
            </div>
          ) : homepageContent.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <p className="text-base font-black text-slate-900 mb-2">No public content yet</p>
              <p className="text-sm font-medium text-slate-600 mb-6 max-w-md mx-auto">
                Once creators publish material, it will appear here. Explore the library or creators directory after signing in.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" size="md" href="/sign-up">
                  Become a creator
                </Button>
                <Button variant="outline" size="md" href="/content-preview">
                  Content preview
                </Button>
              </div>
            </div>
          ) : (
            <MotionReveal className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8" staggerChildren={0.1}>
              {homepageContent.map((content, i) => (
                <MotionItem key={`${content.href ?? content.title}-${i}`}>
                  <SubscriberContentCard {...content} />
                </MotionItem>
              ))}
            </MotionReveal>
          )}
        </Container>
      </section>

      {/* ── 4. Creator Workflow Section ── */}
      <section className="py-24 lg:py-32 bg-white border-y border-[var(--color-border)]">
        <Container>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <MotionReveal className="order-2 lg:order-1" staggerChildren={0.15}>
              <MotionItem>
                <h2 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-12 tracking-tight">
                  Monetize in 4 simple steps
                </h2>
              </MotionItem>
              
              <div className="space-y-8 relative before:absolute before:inset-y-0 before:left-6 before:w-px before:bg-slate-200">
                {WORKFLOW_STEPS.map((step, i) => (
                  <MotionItem key={i} className="flex items-center gap-6 relative z-10 group">
                    <div className="w-12 h-12 rounded-full bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center font-bold text-lg font-display group-hover:border-[var(--color-emerald)] group-hover:text-[var(--color-emerald)] group-hover:shadow-[0_0_20px_var(--color-emerald)] transition-all duration-500">
                      0{i + 1}
                    </div>
                    <span className="text-xl md:text-2xl font-medium text-[var(--color-ink)]">{step}</span>
                  </MotionItem>
                ))}
              </div>
            </MotionReveal>

            {/* Editorial graphic representation */}
            <MotionReveal className="order-1 lg:order-2 h-[400px] lg:h-[600px] glass-panel bg-slate-50 relative overflow-hidden flex items-center justify-center p-8">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-multiply"></div>
               <div className="relative w-full max-w-sm space-y-6">
                  {/* Mock UI lines representing steps */}
                  <div className="h-16 w-full bg-white rounded-xl shadow-sm border border-slate-100 flex items-center px-6 gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-100"></div>
                    <div className="h-3 w-1/2 bg-slate-200 rounded-full"></div>
                  </div>
                  <div className="h-16 w-5/6 bg-white rounded-xl shadow-md border-2 border-emerald-200 translate-x-8 flex items-center px-6 gap-4">
                    <div className="w-8 h-8 rounded-md bg-sky-100"></div>
                    <div className="h-3 w-2/3 bg-[var(--color-ink)] rounded-full"></div>
                  </div>
                  <div className="h-16 w-11/12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center px-6 gap-4">
                    <div className="w-8 h-8 rounded-md bg-emerald-100"></div>
                    <div className="h-3 w-1/3 bg-slate-200 rounded-full"></div>
                  </div>
               </div>
            </MotionReveal>
          </div>
        </Container>
      </section>

      {/* ── 5. Benefits Section ── */}
      <section className="py-24 lg:py-32 bg-[var(--color-paper)]">
        <Container>
          <MotionReveal className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-6 tracking-tight">
              Everything you need to scale
            </h2>
          </MotionReveal>
          
          <MotionReveal className="grid md:grid-cols-3 gap-8" staggerChildren={0.1}>
            <MotionItem>
              <BenefitCard
                number="01"
                title="Subscription Plans"
                description="Create Free, Basic, and Premium tiers for different content access levels."
              />
            </MotionItem>
            <MotionItem>
              <BenefitCard
                number="02"
                title="Locked Content Access"
                description="Restrict premium videos, guides, downloads, and private resources by member plan."
              />
            </MotionItem>
            <MotionItem>
              <BenefitCard
                number="03"
                title="Creator Analytics"
                description="Track active members, recurring revenue, cancellations, and content engagement from one dashboard."
              />
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      {/* ── 6. Content Types Section ── */}
      <section className="py-24 bg-white border-y border-[var(--color-border)] overflow-hidden">
        <Container>
          <MotionReveal className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-[var(--color-ink)]">Sell any type of digital content</h2>
          </MotionReveal>
          
          <MotionReveal className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6" staggerChildren={0.05}>
            {CONTENT_TYPES.map((type, i) => (
              <MotionItem key={i} className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-lg transition-all duration-300 group">
                <svg className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 mb-4 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={type.icon} />
                </svg>
                <span className="text-sm font-bold text-slate-700 text-center">{type.name}</span>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 7. Revenue Operating System Section ── */}
      <section className="py-24 lg:py-32 bg-[var(--color-paper)]">
        <Container>
           <MotionReveal className="text-center max-w-4xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] tracking-tight">
              Run Your Membership Business From One Place
            </h2>
          </MotionReveal>

          <MotionReveal className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" staggerChildren={0.1}>
             {['Plan based access', 'In-app billing notices', 'Subscriber activity', 'Revenue insights'].map((feature, i) => (
               <MotionItem key={i} className="bg-white p-8 rounded-3xl border border-[var(--color-border)] shadow-[var(--shadow-soft)] hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-3 h-3 rounded-full bg-[var(--color-emerald)] mb-6 shadow-[0_0_12px_var(--color-emerald)]"></div>
                  <h3 className="text-xl font-bold font-display text-[var(--color-ink)]">{feature}</h3>
               </MotionItem>
             ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 8. Final Call to Action ── */}
      <section className="py-32 relative overflow-hidden">
        {/* Luminous background styling */}
        <div className="absolute inset-0 bg-white" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-50/50" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80vw] h-[400px] bg-emerald-400/20 rounded-full blur-[64px] pointer-events-none motion-reduce:blur-none" />
        <div className="absolute top-0 right-0 w-[40vw] h-[400px] bg-sky-400/10 rounded-full blur-[64px] pointer-events-none motion-reduce:blur-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal>
            <h2 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black font-display text-[var(--color-ink)] mb-8 tracking-tight leading-[1.05]">
              Build a Membership Experience Your Audience Wants To Pay For
            </h2>
            <p className="text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
              Start with plans, content access, and a polished subscriber experience. Manage billing, subscriptions, and creator analytics from one platform.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button variant="primary" size="lg" href="/sign-up" className="w-full sm:w-auto min-w-[200px]">
                Start Free
              </Button>
              <Button variant="secondary" size="lg" href="/pricing" className="w-full sm:w-auto min-w-[200px]">
                View Pricing
              </Button>
            </div>
          </MotionReveal>
        </Container>
      </section>

    </div>
  );
}
