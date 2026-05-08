"use client";

import { useMemo, useState } from "react";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { SubscriberContentCard } from "@/components/cards/SubscriberContentCard";
import { cn } from "@/lib/utils";

export type PublicPreviewCard = {
  id: string;
  type: "Video" | "Article" | "PDF" | "ZIP" | "RAR";
  title: string;
  creator: string;
  creatorSlug?: string;
  plan: "Free" | "Basic" | "Premium";
  isLocked: boolean;
  thumbnailUrl?: string;
  ctaText: string;
  href?: string;
  /** Where the CTA goes when the card is locked (signed-out → /login). */
  unlockHref?: string;
};

const FILTERS = ["All", "Videos", "Articles", "PDFs", "ZIP Files", "RAR Files", "Premium", "Free"];

export function PublicContentPreviewGrid({ cards }: { cards: PublicPreviewCard[] }) {
  const [activeFilter, setActiveFilter] = useState("All");

  const visibleCards = useMemo(() => {
    return cards.filter((card) => {
      return (
        activeFilter === "All" ||
        (activeFilter === "Videos" && card.type === "Video") ||
        (activeFilter === "Articles" && card.type === "Article") ||
        (activeFilter === "PDFs" && card.type === "PDF") ||
        (activeFilter === "ZIP Files" && card.type === "ZIP") ||
        (activeFilter === "RAR Files" && card.type === "RAR") ||
        activeFilter === card.plan
      );
    });
  }, [activeFilter, cards]);

  return (
    <>
      <section className="mb-12 sticky top-20 z-30">
        <div className="flex items-center gap-3 overflow-x-auto pb-4 hide-scrollbar mask-edges">
          <MotionReveal className="flex gap-3" staggerChildren={0.05}>
            {FILTERS.map((filter, i) => (
              <MotionItem key={i}>
                <button
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer",
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
      </section>

      <section className="mb-32 relative z-20">
        {visibleCards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-base font-black text-slate-900 mb-2">
              No matching content
            </p>
            <p className="text-sm font-medium text-slate-600 max-w-md mx-auto">
              Adjust the filter above to browse more public previews.
            </p>
          </div>
        ) : (
          <MotionReveal
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            staggerChildren={0.1}
          >
            {visibleCards.map((card) => (
              <MotionItem key={card.id} className="h-full">
                <SubscriberContentCard {...card} />
              </MotionItem>
            ))}
          </MotionReveal>
        )}
      </section>
    </>
  );
}
