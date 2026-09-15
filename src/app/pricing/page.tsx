"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Check, X, Minus, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import type { PublicPlansSummary } from "@/lib/mongodb/public-data";

type PricingPlanCard = {
  name: "Free" | "Basic" | "Premium";
  price: string;
  billing: string;
  bestFor: string;
  features: string[];
  buttonText: string;
  variant: "simple" | "recommended" | "premium";
  hasRealData: boolean;
};

const PLAN_BEST_FOR: Record<"Free" | "Basic" | "Premium", string> = {
  Free: "Follow a creator and open their Free content.",
  Basic: "Unlock that creator’s Basic videos, articles, and files.",
  Premium: "Unlock that creator’s full catalog and unlimited downloads.",
};

const PLAN_BUTTON_LABEL: Record<"Free" | "Basic" | "Premium", string> = {
  Free: "Start Free",
  Basic: "Choose Basic",
  Premium: "Choose Premium",
};

const FALLBACK_PRICING: PricingPlanCard[] = [
  {
    name: "Free",
    price: "$0",
    billing: "Forever",
    bestFor: PLAN_BEST_FOR.Free,
    features: [
      "Public content preview.",
      "Free-tier articles and video previews.",
      "Up to 5 file downloads per creator each month.",
    ],
    buttonText: "Start Free",
    variant: "simple",
    hasRealData: false,
  },
  {
    name: "Basic",
    price: "—",
    billing: "set per creator",
    bestFor: PLAN_BEST_FOR.Basic,
    features: [
      "Free + Basic-tier videos and articles.",
      "Up to 30 file downloads per creator each month.",
      "PDF, ZIP, and RAR downloads.",
    ],
    buttonText: "Choose Basic",
    variant: "recommended",
    hasRealData: false,
  },
  {
    name: "Premium",
    price: "—",
    billing: "set per creator",
    bestFor: PLAN_BEST_FOR.Premium,
    features: [
      "Every tier of content from the creator.",
      "Unlimited file downloads.",
      "Every file download from that creator.",
    ],
    buttonText: "Choose Premium",
    variant: "premium",
    hasRealData: false,
  },
];

function formatStartingPrice(amount: number, currency: string): string {
  if (amount === 0) return "$0";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
  }
}

const COMPARISON_FEATURES = [
  { name: "Public content preview", free: "Included", basic: "Included", premium: "Included" },
  { name: "Subscriber library", free: "Limited", basic: "Included", premium: "Included" },
  { name: "Free-tier video & articles", free: "Included", basic: "Included", premium: "Included" },
  { name: "Basic-tier video & articles", free: "Not included", basic: "Included", premium: "Included" },
  { name: "Premium-tier video & articles", free: "Not included", basic: "Not included", premium: "Included" },
  { name: "File downloads / creator / month", free: "5", basic: "30", premium: "Unlimited" },
  { name: "PDF, ZIP, and RAR downloads", free: "Limited", basic: "Included", premium: "Included" },
  { name: "In-app billing notices", free: "Not included", basic: "Included", premium: "Included" },
  { name: "Unlimited downloads", free: "Not included", basic: "Not included", premium: "Included" },
];

const WHO_ITS_FOR = [
  {
    plan: "Free",
    title: "Free is for previewing a creator.",
    description: "Follow a creator with no card to open their free videos, articles, and files. Paid posts stay locked until you Subscribe on that creator.",
  },
  {
    plan: "Basic",
    title: "Basic is the first paid membership.",
    description: "Subscribe to a creator's Basic plan to unlock that creator's Basic videos, articles, and downloadable files.",
  },
  {
    plan: "Premium",
    title: "Premium is full access to that creator.",
    description: "Subscribe to a creator's Premium plan for their full catalog, including unlimited downloads from that creator.",
  },
];

const FAQS = [
  {
    question: "Can I start without payment?",
    answer: "Yes. Follow a creator for free with no card. Paid Basic and Premium plans use Stripe checkout.",
  },
  {
    question: "Can I upgrade later?",
    answer:
      "Yes. On a creator's profile, Follow free first, then use Subscribe on Basic or Premium to unlock that creator's paid content.",
  },
  {
    question: "Will Stripe be used for payments?",
    answer: "Yes. Stripe Checkout, the billing portal, and webhooks update membership status. Charges go to the platform Stripe account. There is no Stripe Connect.",
  },
  {
    question: "Can content be locked by plan?",
    answer: "Yes. Videos, articles, and PDF, ZIP, or RAR files can be assigned to Free, Basic, or Premium on that creator.",
  },
  {
    question: "Is this only for video content?",
    answer: "No. Creators can publish videos, articles, and downloadable PDF, ZIP, and RAR files.",
  },
  {
    question: "Will subscribers get a dashboard?",
    answer: "Subscribers get a content library, subscription page, billing page, and account page. Creators and admins use dashboards.",
  },
];

// Reusable Value Icon for the comparison table
function ValueIcon({ value }: { value: string }) {
  if (value === "Included") return <Check className="w-5 h-5 text-emerald-500 mx-auto" />;
  if (value === "Limited") return <Minus className="w-5 h-5 text-amber-500 mx-auto" />;
  if (value === "Not included") return <X className="w-5 h-5 text-slate-300 mx-auto" />;
  return <span className="text-sm text-slate-600 font-medium">{value}</span>;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between gap-4 text-left focus-visible:outline-none"
      >
        <h4 className="text-lg font-bold font-display text-[var(--color-ink)]">{question}</h4>
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 transition-transform duration-300", isOpen && "rotate-180 bg-emerald-50 text-emerald-500")}>
          <ChevronDown className="w-5 h-5" />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-[var(--color-muted)] leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const [summary, setSummary] = useState<PublicPlansSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const startHref = isSignedIn ? "/creators" : "/sign-up";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/public/plans/summary", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as PublicPlansSummary;
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setIsLoadingSummary(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const livePlans = useMemo<PricingPlanCard[]>(() => {
    if (!summary || summary.tiers.length === 0) return FALLBACK_PRICING;
    return summary.tiers.map((tier) => {
      const variant: PricingPlanCard["variant"] =
        tier.accessLevel === "basic"
          ? "recommended"
          : tier.accessLevel === "premium"
            ? "premium"
            : "simple";
      const price =
        tier.startingPriceMonthly === null
          ? tier.accessLevel === "free"
            ? "$0"
            : "—"
          : tier.startingPriceMonthly === 0
            ? "$0"
            : `from ${formatStartingPrice(tier.startingPriceMonthly, tier.currency)}`;
      const billing =
        tier.startingPriceMonthly === null && tier.accessLevel !== "free"
          ? "set per creator"
          : tier.accessLevel === "free"
            ? "Forever"
            : "per month";
      return {
        name: tier.label,
        price,
        billing,
        bestFor: PLAN_BEST_FOR[tier.label],
        features:
          tier.features.length > 0
            ? tier.features.slice(0, 5)
            : FALLBACK_PRICING.find((f) => f.name === tier.label)?.features ?? [],
        buttonText: PLAN_BUTTON_LABEL[tier.label],
        variant,
        hasRealData: tier.planCount > 0,
      };
    });
  }, [summary]);

  const PLANS = livePlans;
  const showLivePricingNote = summary?.hasRealPlans ?? false;

  const scrollToCompare = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const el = document.getElementById("compare");
    if (el) {
      window.scrollTo({ top: el.offsetTop - 100, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-48 bg-[var(--color-paper)]">
      
      {/* ── 1. Hero Section ── */}
      <section className="relative mb-24">
        {/* Abstract daylight shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[60vw] bg-emerald-400/10 rounded-full blur-[120px] opacity-50 -z-10" />
        
        <Container className="relative z-10">
          <MotionReveal className="max-w-4xl mx-auto text-center" staggerChildren={0.1}>
            <MotionItem className="flex flex-wrap justify-center gap-3 mb-8">
              <Badge variant="default">No card details on Free</Badge>
              <Badge variant="sky">Upgrade anytime</Badge>
              <Badge variant="emerald">Built for paid content</Badge>
            </MotionItem>

            <MotionItem>
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.05] mb-6 sm:mb-8">
                Choose The Membership Plan That Fits Your <span className="text-gradient-primary">Content Business</span>
              </h1>
            </MotionItem>

            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] mb-12 leading-relaxed font-medium max-w-2xl mx-auto">
                Start free, then upgrade when you need more content access, stronger membership controls, and creator revenue tools.
              </p>
            </MotionItem>
            <MotionItem>
              <p className="text-sm font-medium text-slate-600 max-w-2xl mx-auto leading-relaxed border border-slate-200 bg-white/80 rounded-2xl px-5 py-4">
                <span className="font-bold text-[var(--color-ink)]">
                  {isLoadingSummary
                    ? "Loading live pricing…"
                    : showLivePricingNote
                      ? "Live starting prices."
                      : "About prices."}
                </span>{" "}
                {isLoadingSummary ? (
                  <>Pulling the latest plan rows from creators on Advanced Subscription & Membership Platform.</>
                ) : showLivePricingNote ? (
                  <>
                    Each tier shows the cheapest active plan available on the
                    platform today. Final amounts are set per creator at checkout.
                  </>
                ) : (
                  <>
                    No paid plans have been published yet, so dollar amounts on
                    this page are{" "}
                    <span className="font-bold">marketing examples</span>. Once a
                    creator publishes a plan, this page will switch to live prices.
                  </>
                )}
              </p>
            </MotionItem>

            <MotionItem className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <Button variant="primary" size="lg" href={startHref} className="w-full sm:w-auto min-w-[200px]">
                {isSignedIn ? "Browse creators" : "Start Free"}
              </Button>
              <Button variant="secondary" size="lg" href="#compare" onClick={scrollToCompare} className="w-full sm:w-auto min-w-[200px]">
                Compare Plans
              </Button>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      {/* ── 2. Pricing Cards ── */}
      <section className="mb-32 relative z-20">
        <Container>
          <MotionReveal className="grid lg:grid-cols-3 gap-8 items-start" staggerChildren={0.15}>
            {PLANS.map((plan, i) => {
              const isRecommended = plan.variant === "recommended";
              return (
                <MotionItem key={i} className={cn(
                  "relative bg-white rounded-[2rem] border overflow-hidden flex flex-col transition-all duration-300",
                  isRecommended 
                    ? "border-emerald-200 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.2)] lg:-translate-y-4" 
                    : "border-slate-200 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-hover)]"
                )}>
                  {isRecommended && (
                    <div className="bg-gradient-to-r from-emerald-500 to-sky-500 text-white text-xs font-bold uppercase tracking-[0.15em] text-center py-2.5">
                      Recommended Plan
                    </div>
                  )}

                  <div className="p-8 lg:p-10 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-2xl font-bold font-display text-[var(--color-ink)]">{plan.name}</h3>
                      {plan.hasRealData ? (
                        <Badge variant="emerald" className="text-[10px]">Live</Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">Example</Badge>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 mb-6">
                      <span className="text-3xl sm:text-5xl font-black font-display text-[var(--color-ink)] tracking-tight">{plan.price}</span>
                      <span className="text-sm font-medium text-[var(--color-muted)]">{plan.billing}</span>
                    </div>

                    <p className="text-sm text-slate-600 font-medium mb-8 pb-8 border-b border-slate-100">
                      {plan.bestFor}
                    </p>

                    <ul className="flex flex-col gap-4 mb-10 flex-1">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-[var(--color-muted)] text-sm font-medium">
                          <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={isRecommended ? "primary" : "secondary"}
                      className="w-full mt-auto"
                      href={isSignedIn ? "/creators" : plan.name === "Free" ? "/sign-up" : "/creators"}
                    >
                      {isSignedIn
                        ? "Browse Creators"
                        : plan.name === "Free"
                          ? plan.buttonText
                          : "Browse Creators"}
                    </Button>
                  </div>
                </MotionItem>
              );
            })}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 3. Plan Comparison ── */}
      <section id="compare" className="py-24 bg-white border-y border-[var(--color-border)]">
        <Container>
          <MotionReveal className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)]">Compare features in detail</h2>
          </MotionReveal>

          {/* Desktop Table (> md) */}
          <MotionReveal className="hidden md:block overflow-hidden rounded-3xl border border-slate-200 shadow-[var(--shadow-soft)] bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="p-6 font-display font-bold text-[var(--color-ink)] w-2/5">Feature</th>
                  <th className="p-6 font-display font-bold text-center text-[var(--color-ink)] w-1/5">Free</th>
                  <th className="p-6 font-display font-bold text-center text-emerald-600 w-1/5 relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                    Basic
                  </th>
                  <th className="p-6 font-display font-bold text-center text-[var(--color-ink)] w-1/5">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARISON_FEATURES.map((feat, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 text-sm font-semibold text-slate-700">{feat.name}</td>
                    <td className="p-6 text-center"><ValueIcon value={feat.free} /></td>
                    <td className="p-6 text-center bg-emerald-50/30"><ValueIcon value={feat.basic} /></td>
                    <td className="p-6 text-center"><ValueIcon value={feat.premium} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MotionReveal>

          {/* Mobile Stacked Cards (< md) */}
          <MotionReveal className="md:hidden flex flex-col gap-8" staggerChildren={0.1}>
            {['Free', 'Basic', 'Premium'].map((planKey) => {
              const planId = planKey.toLowerCase() as 'free' | 'basic' | 'premium';
              const isRecommended = planKey === 'Basic';
              return (
                <MotionItem key={planKey} className={cn(
                  "bg-white rounded-3xl border overflow-hidden shadow-sm",
                  isRecommended ? "border-emerald-300 ring-4 ring-emerald-50" : "border-slate-200"
                )}>
                  <div className={cn("p-5 border-b font-display font-bold text-lg", isRecommended ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-[var(--color-ink)] border-slate-100")}>
                    {planKey} Plan Features
                  </div>
                  <div className="divide-y divide-slate-50">
                    {COMPARISON_FEATURES.map((feat, i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600">{feat.name}</span>
                        <div className="shrink-0 ml-4"><ValueIcon value={feat[planId]} /></div>
                      </div>
                    ))}
                  </div>
                </MotionItem>
              );
            })}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 4. Who Each Plan Is For ── */}
      <section className="py-24 bg-[var(--color-paper)]">
        <Container>
          <MotionReveal className="mb-16">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)] mb-4">Find your perfect fit</h2>
            <p className="text-lg text-[var(--color-muted)]">Understand exactly which plan aligns with your current membership goals.</p>
          </MotionReveal>

          <MotionReveal className="grid md:grid-cols-3 gap-8" staggerChildren={0.1}>
            {WHO_ITS_FOR.map((item, i) => (
              <MotionItem key={i} className="glass-panel p-8 md:p-10 hover:-translate-y-1 transition-transform duration-500">
                <Badge variant={item.plan === "Basic" ? "emerald" : "default"} className="mb-6">{item.plan}</Badge>
                <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-4">{item.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{item.description}</p>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 5. Pricing FAQ ── */}
      <section className="py-24 bg-white border-y border-[var(--color-border)]">
        <Container className="max-w-4xl">
          <MotionReveal className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)]">Common questions</h2>
          </MotionReveal>
          
          <MotionReveal className="max-w-3xl mx-auto">
            {FAQS.map((faq, i) => (
              <MotionItem key={i}>
                <FAQItem question={faq.question} answer={faq.answer} />
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 6. Final Call to Action ── */}
      <section className="py-32 relative overflow-hidden">
        {/* Luminous background styling */}
        <div className="absolute inset-0 bg-[var(--color-paper)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-50/50" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80vw] h-[400px] bg-emerald-400/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[40vw] h-[400px] bg-sky-400/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem>
              <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-black font-display text-[var(--color-ink)] mb-8 tracking-tight leading-[1.05]">
                Start Simple. Grow Into A <span className="text-gradient-primary">Full Membership System.</span>
              </h2>
            </MotionItem>
            <MotionItem>
              <p className="text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
                Create your first plan, publish premium content, and prepare your creator business for recurring subscription revenue.
              </p>
            </MotionItem>
            <MotionItem className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button variant="primary" size="lg" href={startHref} className="w-full sm:w-auto min-w-[200px]">
                {isSignedIn ? "Browse creators" : "Start Free"}
              </Button>
              <Button variant="secondary" size="lg" href="/content-preview" className="w-full sm:w-auto min-w-[200px]">
                Explore Content
              </Button>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

    </div>
  );
}
