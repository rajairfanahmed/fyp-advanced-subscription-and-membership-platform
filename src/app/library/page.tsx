"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SubscriberContentCard } from "@/components/cards/SubscriberContentCard";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentIssueBanner } from "@/components/billing/PaymentIssueBanner";
import type { ContentResponse } from "@/types/content";
import type { SubscriptionResponse } from "@/types/subscription";

const FILTERS = [
  "All",
  "Videos",
  "Articles",
  "PDFs",
  "ZIP Files",
  "RAR Files",
  "Free",
  "Basic",
  "Premium",
] as const;
type FilterValue = (typeof FILTERS)[number];

type LibraryCard = {
  id: string;
  type: "Video" | "Article" | "PDF" | "ZIP" | "RAR";
  title: string;
  creator: string;
  creatorSlug: string;
  plan: "Free" | "Basic" | "Premium";
  isLocked: boolean;
  thumbnailUrl?: string;
};

function contentToCard(content: ContentResponse): LibraryCard {
  const type =
    content.contentType === "video"
      ? "Video"
      : content.contentType === "article"
        ? "Article"
        : ((content.fileSubtype || "pdf").toUpperCase() as
            | "PDF"
            | "ZIP"
            | "RAR");

  const accessGranted = content.accessGranted === true;

  return {
    id: content.slug || content.id,
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
    isLocked: !accessGranted,
    thumbnailUrl: content.thumbnailUrl,
  };
}

function ctaTextFor(card: LibraryCard) {
  if (card.isLocked) return "Upgrade To Unlock";
  if (card.type === "Video") return "Watch";
  if (card.type === "Article") return "Read";
  return "Download";
}

function CardGrid({ cards }: { cards: LibraryCard[] }) {
  return (
    <MotionReveal
      className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      staggerChildren={0.05}
    >
      {cards.map((card) => (
        <MotionItem key={card.id} className="h-full">
          <SubscriberContentCard
            title={card.title}
            creator={card.creator}
            creatorSlug={card.creatorSlug}
            type={card.type}
            plan={card.plan}
            isLocked={card.isLocked}
            thumbnailUrl={card.thumbnailUrl}
            href={`/library/${card.id}`}
            unlockHref={card.creatorSlug ? `/creators/${card.creatorSlug}` : "/creators"}
            ctaText={ctaTextFor(card)}
          />
        </MotionItem>
      ))}
    </MotionReveal>
  );
}

export default function LibraryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterValue>("All");
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadContent() {
      setIsLoading(true);
      setLoadError("");
      try {
        const [contentRes, subRes] = await Promise.all([
          fetch("/api/content", { cache: "no-store" }),
          fetch("/api/subscriptions/me", { cache: "no-store" }),
        ]);
        if (!contentRes.ok) {
          throw new Error("The library could not load. Check that Vercel DATABASE_URL points at Neon with sslmode=require.");
        }
        const data = (await contentRes.json()) as { content: ContentResponse[] };
        const subData = subRes.ok
          ? ((await subRes.json()) as { subscriptions?: SubscriptionResponse[] })
          : { subscriptions: [] };
        if (!cancelled) {
          setCards((data.content ?? []).map(contentToCard));
          setSubscriptions(subData.subscriptions ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setCards([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "The library could not load."
          );
        } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadContent();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply text + filter pill in real time. The pill narrows by content
  // type or plan tier; "All" passes everything that matches the search.
  const visibleCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesQuery =
        !needle ||
        card.title.toLowerCase().includes(needle) ||
        card.creator.toLowerCase().includes(needle);
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Videos" && card.type === "Video") ||
        (activeFilter === "Articles" && card.type === "Article") ||
        (activeFilter === "PDFs" && card.type === "PDF") ||
        (activeFilter === "ZIP Files" && card.type === "ZIP") ||
        (activeFilter === "RAR Files" && card.type === "RAR") ||
        activeFilter === card.plan;
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, cards, query]);

  const continueCards = visibleCards.filter((c) => !c.isLocked).slice(0, 4);
  const freeCards = visibleCards.filter((c) => c.plan === "Free");
  const basicCards = visibleCards.filter((c) => c.plan === "Basic");
  const premiumCards = visibleCards.filter((c) => c.plan === "Premium");

  // When a single tier filter is active we collapse down to just that
  // section so the page doesn't render empty headings.
  const showContinue =
    activeFilter === "All" && continueCards.length > 0 && !query;
  const showFree =
    activeFilter === "All" || activeFilter === "Free"
      ? freeCards.length > 0
      : false;
  const showBasic =
    activeFilter === "All" || activeFilter === "Basic"
      ? basicCards.length > 0
      : false;
  const showPremium =
    activeFilter === "All" || activeFilter === "Premium"
      ? premiumCards.length > 0
      : false;

  // For type-only filters (Videos / Articles / PDFs / ZIP / RAR) we
  // show a single flat grid because tier sectioning would just split
  // the same set across three near-empty rails.
  const isTypeFilter =
    activeFilter !== "All" &&
    activeFilter !== "Free" &&
    activeFilter !== "Basic" &&
    activeFilter !== "Premium";

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
      <section className="mb-12 relative">
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-sky-400/10 rounded-full blur-[72px] opacity-60 -z-10 pointer-events-none motion-reduce:blur-none" />
        <Container>
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="flex flex-wrap gap-3 mb-6">
              <Badge variant="emerald">Video Lessons</Badge>
              <Badge variant="sky">Articles</Badge>
              <Badge variant="default">Downloads</Badge>
              <Badge variant="default">Premium Access</Badge>
            </MotionItem>
            <MotionItem>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.1] mb-6">
                Your Member{" "}
                <span className="text-gradient-primary">Content Library</span>
              </h1>
            </MotionItem>
            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] font-medium max-w-2xl mb-10 leading-relaxed">
                Browse videos, articles, PDFs, ZIP files, RAR files, and
                premium resources available through your membership plan.
              </p>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      <section className="mb-12 sticky top-[72px] z-30 bg-[var(--color-paper)]/90 backdrop-blur-md py-4 border-b border-[var(--color-border)]">
        <Container>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative w-full md:max-w-xs shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search your library..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-shadow text-[var(--color-ink)]"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 md:pb-0 hide-scrollbar mask-edges">
              <MotionReveal className="flex gap-2" staggerChildren={0.05}>
                {FILTERS.map((filter) => (
                  <MotionItem key={filter}>
                    <button
                      onClick={() => setActiveFilter(filter)}
                      className={cn(
                        "px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer",
                        activeFilter === filter
                          ? "bg-[var(--color-ink)] text-white shadow-md"
                          : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-[var(--color-ink)] shadow-sm"
                      )}
                    >
                      {filter}
                    </button>
                  </MotionItem>
                ))}
              </MotionReveal>
            </div>
          </div>
        </Container>
      </section>

      {isLoading && (
        <Container className="mb-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 text-sm font-bold text-slate-600">
            Loading published content...
          </div>
        </Container>
      )}

      {!isLoading && cards.some((c) => c.isLocked) && (
        <Container className="mb-8">
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-sm font-medium text-sky-900 leading-relaxed">
            Locked items need that creator&apos;s <span className="font-black">Basic</span> or{" "}
            <span className="font-black">Premium</span> plan.{" "}
            <span className="font-black">Follow free</span> only unlocks Free content. Open the
            creator&apos;s profile and use Subscribe to pay.
          </div>
        </Container>
      )}

      {!isLoading && (
        <Container className="mb-8 empty:hidden">
          <PaymentIssueBanner subscriptions={subscriptions} />
        </Container>
      )}

      {!isLoading && loadError && (
        <Container className="mb-8">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm font-medium text-red-800 leading-relaxed">
            {loadError}
          </div>
        </Container>
      )}

      {!isLoading && visibleCards.length === 0 ? (
        <Container className="mb-20">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 md:p-14 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-black font-display text-[var(--color-ink)] mb-3">
              {query || activeFilter !== "All"
                ? "No results"
                : "Your library is empty"}
            </h2>
            <p className="text-slate-600 font-medium mb-8 leading-relaxed">
              {query || activeFilter !== "All"
                ? "Try a different keyword or filter to find what you're looking for."
                : "There is no published content to show yet. Check back after creators publish new material."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {(query || activeFilter !== "All") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setActiveFilter("All");
                  }}
                >
                  Clear filters
                </Button>
              )}
              <Button variant="primary" href="/creators">
                Browse creators
              </Button>
              <Button variant="secondary" href="/subscription">
                View subscription
              </Button>
            </div>
          </div>
        </Container>
      ) : !isLoading ? (
        <>
          {isTypeFilter ? (
            <section className="mb-20">
              <Container>
                <h2 className="mb-8 text-2xl font-black font-display text-[var(--color-ink)]">
                  {activeFilter}
                  <span className="ml-3 text-sm font-bold text-slate-400">
                    {visibleCards.length}
                  </span>
                </h2>
                <CardGrid cards={visibleCards} />
              </Container>
            </section>
          ) : (
            <>
              {showContinue && (
                <section className="mb-20">
                  <Container>
                    <div className="mb-8 flex items-center justify-between">
                      <h2 className="text-2xl font-black font-display text-[var(--color-ink)]">
                        Continue Watching
                      </h2>
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Recently unlocked for you
                      </span>
                    </div>
                    <CardGrid cards={continueCards} />
                  </Container>
                </section>
              )}

              {showFree && (
                <section className="mb-20">
                  <Container>
                    <div className="mb-8 flex items-center gap-3">
                      <Badge variant="default">Free</Badge>
                      <h2 className="text-2xl font-black font-display text-[var(--color-ink)]">
                        Free for everyone
                        <span className="ml-3 text-sm font-bold text-slate-400">
                          {freeCards.length}
                        </span>
                      </h2>
                    </div>
                    <CardGrid cards={freeCards} />
                  </Container>
                </section>
              )}

              {showBasic && (
                <section className="mb-20">
                  <Container>
                    <div className="mb-8 flex items-center gap-3">
                      <Badge variant="emerald">Basic</Badge>
                      <h2 className="text-2xl font-black font-display text-[var(--color-ink)]">
                        Basic plan
                        <span className="ml-3 text-sm font-bold text-slate-400">
                          {basicCards.length}
                        </span>
                      </h2>
                    </div>
                    <CardGrid cards={basicCards} />
                  </Container>
                </section>
              )}

              {showPremium && (
                <section className="mb-24 py-20 bg-white border-y border-[var(--color-border)] relative overflow-hidden">
                  <div className="absolute top-0 right-1/4 w-[40vw] h-[40vw] bg-emerald-400/5 rounded-full blur-[56px] pointer-events-none motion-reduce:blur-none" />
                  <Container className="relative z-10">
                    <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="sky">Premium</Badge>
                        <h2 className="text-2xl md:text-3xl font-black font-display text-[var(--color-ink)]">
                          Premium &amp; downloads
                          <span className="ml-3 text-sm font-bold text-slate-400">
                            {premiumCards.length}
                          </span>
                        </h2>
                      </div>
                      <Button variant="primary" size="sm" href="/creators">
                        Browse creators to upgrade
                      </Button>
                    </div>
                    <CardGrid cards={premiumCards} />
                  </Container>
                </section>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
