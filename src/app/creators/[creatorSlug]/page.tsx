"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Container } from "@/components/layout/Container";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PublicCreatorContentTabs } from "@/components/cards/PublicCreatorContentTabs";
import type {
  PublicContent,
  PublicCreator,
  PublicCreatorPlan,
} from "@/lib/mongodb/public-data";
import type { PlanAccessLevel } from "@/types/plan";
import type { SubscriptionStatus } from "@/types/subscription";
import { CheckCircle2, Eye, FileText, Lock, Sparkles, Users } from "lucide-react";

type ViewerSubscription = {
  id: string;
  accessLevel: PlanAccessLevel;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

const TIER_RANK: Record<PlanAccessLevel, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatPrice(monthly: number, currency: string) {
  if (!monthly) return "Free";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      maximumFractionDigits: monthly % 1 === 0 ? 0 : 2,
    }).format(monthly);
  } catch {
    return `$${monthly.toFixed(monthly % 1 === 0 ? 0 : 2)}`;
  }
}

export default function CreatorProfilePage() {
  const params = useParams<{ creatorSlug: string }>();
  const { isSignedIn, isLoaded } = useAuth();
  const [creator, setCreator] = useState<PublicCreator | null>(null);
  const [content, setContent] = useState<PublicContent[]>([]);
  const [plans, setPlans] = useState<PublicCreatorPlan[]>([]);
  const [viewer, setViewer] = useState<ViewerSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const creatorSlug = params?.creatorSlug;
    if (!creatorSlug) return;

    async function loadCreator() {
      try {
        const res = await fetch(`/api/public/creators/${encodeURIComponent(creatorSlug)}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setCreator(null);
          return;
        }
        const data = (await res.json()) as {
          creator: PublicCreator | null;
          content: PublicContent[];
          plans?: PublicCreatorPlan[];
          viewer?: ViewerSubscription | null;
        };
        if (!cancelled) {
          setCreator(data.creator);
          setContent(data.content);
          setPlans(data.plans ?? []);
          setViewer(data.viewer ?? null);
        }
      } catch {
        if (!cancelled) setCreator(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadCreator();
    return () => {
      cancelled = true;
    };
  }, [params?.creatorSlug, reloadNonce]);

  const sortedPlans = useMemo(
    () =>
      [...plans].sort(
        (a, b) => TIER_RANK[a.accessLevel] - TIER_RANK[b.accessLevel]
      ),
    [plans]
  );

  async function handleSubscribeFree() {
    if (!creator) return;
    if (!isSignedIn) {
      window.location.href = `/login?redirect_url=${encodeURIComponent(`/creators/${creator.slug}`)}`;
      return;
    }
    setPendingPlanId("free");
    setActionError("");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorClerkUserId: creator.clerkUserId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to subscribe.");
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to subscribe.");
    } finally {
      setPendingPlanId(null);
    }
  }

  async function handleCheckout(plan: PublicCreatorPlan) {
    if (!creator) return;
    if (!isSignedIn) {
      window.location.href = `/login?redirect_url=${encodeURIComponent(`/creators/${creator.slug}`)}`;
      return;
    }
    setPendingPlanId(plan.id);
    setActionError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
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
      setActionError(
        err instanceof Error ? err.message : "Failed to start checkout."
      );
      setPendingPlanId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
        <Container>
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-sm font-bold text-slate-600">
            Loading creator profile...
          </div>
        </Container>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
        <Container>
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h1 className="text-3xl font-black font-display text-slate-950 mb-3">Creator not found</h1>
            <p className="text-sm font-bold text-slate-600 mb-6">
              This creator profile is unavailable or has not been published yet.
            </p>
            <Link href="/creators" className="text-sm font-black text-emerald-700 hover:text-emerald-800">
              Browse published creators
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pt-24 pb-20 bg-[var(--color-paper)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-400/5 rounded-full blur-[80px] motion-reduce:blur-none -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-sky-400/5 rounded-full blur-[80px] motion-reduce:blur-none -z-10 pointer-events-none" />

      <Container className="max-w-5xl pt-8 md:pt-12">
        <MotionReveal instant>
          <MotionItem>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              {/* Banner is its own block. The avatar sits cleanly below
                  it (no overlap) so the banner image is never visually
                  cut into by the avatar bubble — Nielsen #4 / #8. */}
              <div className="h-40 md:h-56 bg-gradient-to-r from-emerald-50 to-sky-50 relative">
                {creator.bannerUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creator.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
              </div>

              <div className="px-6 md:px-12 pt-8 pb-10 md:pb-12">
                <div className="flex flex-col md:flex-row md:items-start md:gap-8 mb-8">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-slate-100 ring-4 ring-white shadow-md overflow-hidden flex items-center justify-center text-emerald-700 text-2xl md:text-3xl font-black font-display shrink-0 mb-5 md:mb-0">
                    {creator.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={creator.avatarUrl} alt={creator.name} className="w-full h-full object-cover" />
                    ) : (
                      initials(creator.name)
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-center md:text-left">
                    <Badge variant="emerald" className="mb-3">Creator</Badge>
                    <h1 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)] mb-2 tracking-tight break-words">
                      {creator.name}
                    </h1>
                    <p className="text-[var(--color-muted)] font-medium text-base max-w-xl leading-relaxed">
                      {creator.bio || "Creator profile details are coming soon."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto md:mx-0">
                  <div className="bg-[var(--color-paper)] rounded-2xl p-4 text-center border border-slate-100">
                    <Users className="w-4 h-4 text-emerald-500 mx-auto mb-1.5" />
                    <p className="text-xl font-black text-[var(--color-ink)]">{creator.subscriberCount.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Subscribers</p>
                  </div>
                  <div className="bg-[var(--color-paper)] rounded-2xl p-4 text-center border border-slate-100">
                    <FileText className="w-4 h-4 text-sky-500 mx-auto mb-1.5" />
                    <p className="text-xl font-black text-[var(--color-ink)]">{creator.contentCount}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Content</p>
                  </div>
                  <div className="bg-[var(--color-paper)] rounded-2xl p-4 text-center border border-slate-100">
                    <Eye className="w-4 h-4 text-violet-500 mx-auto mb-1.5" />
                    <p className="text-xl font-black text-[var(--color-ink)]">{creator.totalViews.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Views</p>
                  </div>
                </div>
              </div>
            </div>
          </MotionItem>
        </MotionReveal>
      </Container>

      <Container className="max-w-5xl mt-12">
        <MotionReveal instant>
          <MotionItem>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg md:text-xl font-black font-display text-[var(--color-ink)]">
                    Membership
                  </h2>
                </div>
                {viewer && viewer.status === "active" && (
                  <Badge variant="emerald">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                    Subscribed · {viewer.accessLevel}
                  </Badge>
                )}
                {viewer && viewer.status === "past_due" && (
                  <Badge variant="locked">Payment past due</Badge>
                )}
              </div>

              {!isLoaded ? (
                <p className="text-sm font-medium text-slate-500">
                  Checking membership status…
                </p>
              ) : sortedPlans.length === 0 ? (
                <p className="text-sm font-medium text-slate-600">
                  This creator hasn&apos;t opened any plans yet. Check back soon.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedPlans.map((plan) => {
                    const planTier = TIER_RANK[plan.accessLevel];
                    const viewerTier = viewer
                      ? TIER_RANK[viewer.accessLevel]
                      : -1;
                    const isCurrent =
                      Boolean(viewer) &&
                      viewer!.status !== "canceled" &&
                      viewer!.status !== "expired" &&
                      viewerTier === planTier;
                    const isLowerTier =
                      Boolean(viewer) &&
                      viewer!.status !== "canceled" &&
                      viewer!.status !== "expired" &&
                      viewerTier > planTier;
                    const isFree = plan.accessLevel === "free";
                    const stripeBlocked = !isFree && !plan.stripeReady;
                    const isPending = pendingPlanId === plan.id || (isFree && pendingPlanId === "free");

                    return (
                      <div
                        key={plan.id}
                        className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-black font-display text-[var(--color-ink)]">
                            {plan.name}
                          </h3>
                          <Badge
                            variant={
                              plan.accessLevel === "premium"
                                ? "sky"
                                : plan.accessLevel === "basic"
                                  ? "emerald"
                                  : "default"
                            }
                          >
                            {plan.accessLevel}
                          </Badge>
                        </div>
                        <p className="text-2xl font-black font-display text-[var(--color-ink)]">
                          {formatPrice(plan.priceMonthly, plan.currency)}
                          {!isFree && (
                            <span className="text-xs font-bold text-slate-500 ml-1">
                              / month
                            </span>
                          )}
                        </p>
                        {plan.description && (
                          <p className="text-xs font-medium text-slate-600 mt-2 leading-relaxed line-clamp-3">
                            {plan.description}
                          </p>
                        )}

                        <div className="mt-4">
                          {isCurrent ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full text-xs"
                              disabled
                            >
                              Current plan
                            </Button>
                          ) : isLowerTier ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full text-xs"
                              disabled
                              title="You already have a higher tier."
                            >
                              Included in your tier
                            </Button>
                          ) : isFree ? (
                            <Button
                              type="button"
                              variant="secondary"
                              className="w-full text-xs"
                              onClick={handleSubscribeFree}
                              disabled={isPending}
                            >
                              {isPending ? "Subscribing…" : "Follow free"}
                            </Button>
                          ) : stripeBlocked ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full text-xs"
                              disabled
                              title="Creator hasn't connected this plan to Stripe yet."
                              icon={<Lock className="w-3.5 h-3.5" />}
                            >
                              Coming soon
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="primary"
                              className="w-full text-xs"
                              onClick={() => handleCheckout(plan)}
                              disabled={isPending}
                            >
                              {isPending
                                ? "Redirecting…"
                                : `Subscribe · ${formatPrice(plan.priceMonthly, plan.currency)}/mo`}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {actionError && (
                <p className="mt-4 text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  {actionError}
                </p>
              )}

              {!isSignedIn && isLoaded && sortedPlans.length > 0 && (
                <p className="mt-4 text-xs font-medium text-slate-500">
                  You&apos;ll be asked to sign in before subscription starts.
                </p>
              )}
            </div>
          </MotionItem>
        </MotionReveal>
      </Container>

      <Container className="max-w-5xl mt-14">
        <MotionReveal instant>
          <MotionItem>
            <h2 className="text-xl md:text-2xl font-black font-display text-[var(--color-ink)] tracking-tight mb-6">
              Published Content
            </h2>
            <PublicCreatorContentTabs content={content} />
          </MotionItem>
        </MotionReveal>
      </Container>
    </div>
  );
}
