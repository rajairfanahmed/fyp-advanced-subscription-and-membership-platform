"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
import { planTierLabel, daysRemainingLabel } from "@/lib/membership/labels";
import { loginHref } from "@/lib/auth/post-login-redirect";
import {
  fetchWithTimeout,
  readJsonSafe,
  RequestTimeoutError,
} from "@/lib/http/fetch-timeout";
import { useInFlightLock } from "@/lib/ui/useInFlightLock";
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
  const searchParams = useSearchParams();
  const checkoutCancelled = searchParams.get("checkout") === "cancelled";
  const { isSignedIn, isLoaded, userId } = useAuth();
  const [creator, setCreator] = useState<PublicCreator | null>(null);
  const [content, setContent] = useState<PublicContent[]>([]);
  const [plans, setPlans] = useState<PublicCreatorPlan[]>([]);
  const [viewer, setViewer] = useState<ViewerSubscription | null>(null);
  const [viewerRole, setViewerRole] = useState<"subscriber" | "creator" | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loadError, setLoadError] = useState("");
  const subscribeLock = useInFlightLock();
  const checkoutLock = useInFlightLock();

  useEffect(() => {
    let cancelled = false;
    const creatorSlug = params?.creatorSlug;
    if (!creatorSlug) return;

    async function loadCreator() {
      setLoadError("");
      try {
        const res = await fetchWithTimeout(
          `/api/public/creators/${encodeURIComponent(creatorSlug)}`,
          { cache: "no-store", timeoutMs: 15_000 }
        );
        if (!res.ok) {
          if (!cancelled) {
            setCreator(null);
            setLoadError(
              res.status === 404
                ? ""
                : "This creator profile couldn’t be loaded. Check your connection and try again."
            );
          }
          return;
        }
        const data = await readJsonSafe<{
          creator: PublicCreator | null;
          content: PublicContent[];
          plans?: PublicCreatorPlan[];
          viewer?: ViewerSubscription | null;
        }>(res);
        if (!cancelled) {
          setCreator(data.creator ?? null);
          setContent(data.content ?? []);
          setPlans(data.plans ?? []);
          setViewer(data.viewer ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setCreator(null);
          setLoadError(
            error instanceof RequestTimeoutError
              ? error.message
              : "This creator profile couldn’t be loaded. Check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadCreator();
    return () => {
      cancelled = true;
    };
  }, [params?.creatorSlug, reloadNonce]);

  useEffect(() => {
    if (!isSignedIn) {
      setViewerRole(null);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { user?: { role?: string } | null }) => {
        if (cancelled) return;
        const role = data.user?.role;
        setViewerRole(
          role === "creator" ? "creator" : role === "subscriber" ? "subscriber" : null
        );
      })
      .catch(() => {
        if (!cancelled) setViewerRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const isOwnProfile = Boolean(userId && creator?.clerkUserId === userId);

  const sortedPlans = useMemo(
    () =>
      [...plans].sort(
        (a, b) => TIER_RANK[a.accessLevel] - TIER_RANK[b.accessLevel]
      ),
    [plans]
  );

  async function handleSubscribeFree() {
    if (!creator) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.assign(loginHref(`/creators/${creator.slug}`));
      return;
    }
    if (viewerRole === "creator" || isOwnProfile) return;
    if (!subscribeLock.begin()) return;
    setPendingPlanId("free");
    setActionError("");
    try {
      const res = await fetchWithTimeout("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorClerkUserId: creator.clerkUserId }),
        timeoutMs: 15_000,
      });
      const data = await readJsonSafe<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to subscribe.");
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setActionError(
        err instanceof RequestTimeoutError
          ? "The membership service didn’t respond. You were not subscribed. Try again."
          : err instanceof Error
            ? err.message
            : "Failed to subscribe."
      );
    } finally {
      setPendingPlanId(null);
      subscribeLock.end();
    }
  }

  async function handleCheckout(plan: PublicCreatorPlan) {
    if (!creator) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.assign(loginHref(`/creators/${creator.slug}`));
      return;
    }
    if (viewerRole === "creator" || isOwnProfile) return;
    if (!checkoutLock.begin()) return;
    setPendingPlanId(plan.id);
    setActionError("");
    setActionNotice("");
    let navigating = false;
    try {
      const res = await fetchWithTimeout("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
        timeoutMs: 45_000,
      });
      const data = await readJsonSafe<{
        url?: string;
        applied?: boolean;
        error?: string;
      }>(res);
      if (data.applied) {
        setActionNotice(
          `You're now on ${planTierLabel(plan.accessLevel)} with this creator. The change is active immediately.`
        );
        setReloadNonce((n) => n + 1);
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start checkout.");
      }
      navigating = true;
      window.location.assign(data.url);
    } catch (err) {
      setActionError(
        err instanceof RequestTimeoutError
          ? "Checkout is taking too long. Nothing was charged. Wait a moment, then click Subscribe once more — Stripe’s payment page should open."
          : err instanceof Error
            ? err.message
            : "Failed to start checkout."
      );
    } finally {
      if (!navigating) {
        setPendingPlanId(null);
        checkoutLock.end();
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
        <Container>
          <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm animate-pulse">
            <div className="h-40 bg-slate-100" />
            <div className="p-8 md:p-12 space-y-4">
              <div className="w-24 h-24 rounded-full bg-slate-100 -mt-20 ring-4 ring-white" />
              <div className="h-8 w-64 bg-slate-100 rounded-xl" />
              <div className="h-4 w-full max-w-xl bg-slate-50 rounded-lg" />
              <div className="h-4 w-2/3 bg-slate-50 rounded-lg" />
            </div>
          </div>
        </Container>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
        <Container>
          <div className="bg-white rounded-[2rem] border border-slate-200 p-10 md:p-14 text-center max-w-xl mx-auto">
            <h1 className="text-3xl font-black font-display text-slate-950 mb-3">
              {loadError ? "Couldn’t load this creator" : "Creator not found"}
            </h1>
            <p className="text-sm font-medium text-slate-600 mb-8 leading-relaxed">
              {loadError ||
                "This creator profile is unavailable or has not been published yet."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {loadError ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setIsLoading(true);
                    setLoadError("");
                    setReloadNonce((n) => n + 1);
                  }}
                >
                  Try again
                </Button>
              ) : null}
              <Button variant="secondary" href="/creators">
                Browse creators
              </Button>
            </div>
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

              <div className="px-4 sm:px-6 md:px-12 pt-8 pb-10 md:pb-12">
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
                      {creator.bio || "This creator hasn’t added a bio yet."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto md:mx-0">
                  <div className="bg-[var(--color-paper)] rounded-2xl p-3 sm:p-4 text-center border border-slate-100 min-w-0">
                    <Users className="w-4 h-4 text-emerald-500 mx-auto mb-1.5" />
                    <p className="text-xl font-black text-[var(--color-ink)]">{creator.subscriberCount.toLocaleString()}</p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1 leading-tight">Subscribers</p>
                  </div>
                  <div className="bg-[var(--color-paper)] rounded-2xl p-3 sm:p-4 text-center border border-slate-100 min-w-0">
                    <FileText className="w-4 h-4 text-sky-500 mx-auto mb-1.5" />
                    <p className="text-xl font-black text-[var(--color-ink)]">{creator.contentCount}</p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1 leading-tight">Content</p>
                  </div>
                  <div className="bg-[var(--color-paper)] rounded-2xl p-3 sm:p-4 text-center border border-slate-100 min-w-0">
                    <Eye className="w-4 h-4 text-violet-500 mx-auto mb-1.5" />
                    <p className="text-xl font-black text-[var(--color-ink)]">{creator.totalViews.toLocaleString()}</p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1 leading-tight">Views</p>
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
                    {planTierLabel(viewer.accessLevel)}
                    {daysRemainingLabel(
                      viewer.currentPeriodEnd,
                      { ending: viewer.cancelAtPeriodEnd }
                    )
                      ? ` · ${daysRemainingLabel(viewer.currentPeriodEnd, { ending: viewer.cancelAtPeriodEnd })}`
                      : ""}
                  </Badge>
                )}
                {viewer && viewer.status === "past_due" && (
                  <Badge variant="locked">Payment past due</Badge>
                )}
              </div>

              {actionError && (
                <p className="mb-4 text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  {actionError}
                </p>
              )}

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
                    const isUpgrade =
                      Boolean(viewer) &&
                      viewer!.status !== "canceled" &&
                      viewer!.status !== "expired" &&
                      viewer!.accessLevel !== "free" &&
                      planTier > viewerTier;
                    const isFree = plan.accessLevel === "free";
                    const stripeBlocked = !isFree && !plan.stripeReady;
                    const isThisPending =
                      pendingPlanId === plan.id ||
                      (isFree && pendingPlanId === "free");
                    const otherActionBusy =
                      (subscribeLock.busy || checkoutLock.busy) && !isThisPending;

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
                            {planTierLabel(plan.accessLevel)}
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
                          {isOwnProfile ? (
                            <Button
                              href="/creator/plans"
                              variant="outline"
                              className="w-full text-xs"
                            >
                              Your plans
                            </Button>
                          ) : viewerRole === "creator" ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full text-xs"
                              disabled
                              title="Creator accounts cannot follow or subscribe."
                            >
                              Use a subscriber account
                            </Button>
                          ) : isCurrent ? (
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
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                className="w-full text-xs"
                                onClick={handleSubscribeFree}
                                disabled={isThisPending || otherActionBusy || !isLoaded}
                              >
                                {isThisPending ? "Following…" : "Follow free"}
                              </Button>
                              <p className="text-[10px] font-medium text-slate-500 mt-2 text-center">
                                Unlocks Free content only
                              </p>
                            </>
                          ) : stripeBlocked ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full text-xs"
                              disabled
                              title="Checkout isn't ready for this plan yet."
                              icon={<Lock className="w-3.5 h-3.5" />}
                            >
                              Checkout not ready
                            </Button>
                          ) : (
                            <>
                            <Button
                              type="button"
                              variant="primary"
                              className="w-full text-xs"
                              onClick={() => handleCheckout(plan)}
                              disabled={isThisPending || otherActionBusy || !isLoaded}
                            >
                              {isThisPending
                                ? isUpgrade
                                  ? "Upgrading…"
                                  : "Redirecting…"
                                : isUpgrade
                                  ? `Upgrade to ${plan.name}`
                                  : `Subscribe · ${formatPrice(plan.priceMonthly, plan.currency)}/mo`}
                            </Button>
                            {isUpgrade && (
                              <p className="text-[10px] font-medium text-slate-500 mt-2 text-center">
                                Takes effect now. Stripe prorates the difference.
                              </p>
                            )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isOwnProfile && (
                <p className="mt-4 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  This is your creator profile. Membership cards here are what subscribers see — manage them from{" "}
                  <Link href="/creator/plans" className="font-black text-sky-700 underline">
                    your plans
                  </Link>
                  .
                </p>
              )}

              {viewerRole === "creator" && !isOwnProfile && (
                <p className="mt-4 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  Creator accounts cannot follow or subscribe. Use a subscriber account to join this membership.
                </p>
              )}

              {checkoutCancelled && (
                <p className="mt-4 text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  Checkout cancelled. No charge was made.
                </p>
              )}

              {actionNotice && (
                <p className="mt-4 text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  {actionNotice}
                </p>
              )}

              {viewer &&
                (viewer.status === "active" ||
                  viewer.status === "trialing" ||
                  viewer.status === "past_due") &&
                viewer.accessLevel === "free" && (
                <p className="mt-4 text-sm font-medium text-sky-800 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                  You currently have <span className="font-black">Free</span> access. Follow free
                  does not unlock Basic or Premium content — use Subscribe on those cards to pay.
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
            <PublicCreatorContentTabs
              content={content}
              viewerAccessLevel={
                viewer &&
                (viewer.status === "active" ||
                  viewer.status === "trialing" ||
                  viewer.status === "past_due")
                  ? viewer.accessLevel
                  : "free"
              }
            />
          </MotionItem>
        </MotionReveal>
      </Container>
    </div>
  );
}
