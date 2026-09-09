"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  SubscriptionResponse,
  SubscriptionStatus,
} from "@/types/subscription";

const TIER_INFO = [
  {
    name: "Free",
    price: "Free",
    accessLevel: "free" as const,
    features: [
      "Watch free articles and video previews.",
      "Up to 5 free-tier downloads per creator each month.",
      "Standard creator updates.",
    ],
  },
  {
    name: "Basic",
    price: "Set by creator",
    accessLevel: "basic" as const,
    features: [
      "Watch free + basic videos and articles.",
      "Up to 30 downloads per creator each month.",
      "PDF, ZIP, and RAR downloads.",
    ],
  },
  {
    name: "Premium",
    price: "Set by creator",
    accessLevel: "premium" as const,
    features: [
      "Watch every tier of content from the creator.",
      "Unlimited file downloads.",
      "Every file download from that creator.",
    ],
  },
];

const STATUS_COPY: Record<SubscriptionStatus, { label: string; tone: "emerald" | "sky" | "default" | "locked" }> = {
  active: { label: "Active", tone: "emerald" },
  trialing: { label: "Trialing", tone: "sky" },
  past_due: { label: "Past due", tone: "locked" },
  canceled: { label: "Canceled", tone: "default" },
  expired: { label: "Expired", tone: "default" },
};

function formatRenewalDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPrice(monthly: number | string | null | undefined) {
  const amount = Number(monthly);
  if (!Number.isFinite(amount) || amount === 0) return "$0";
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export default function SubscriptionPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError("");
      try {
        const res = await fetch("/api/subscriptions/me", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { subscriptions: SubscriptionResponse[] };
        if (!cancelled) setSubscriptions(data.subscriptions ?? []);
      } catch {
        if (!cancelled)
          setLoadError("We couldn't load your subscriptions. Try again or contact support if this continues.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadNonce]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    const sessionId = params.get("session_id") ?? "";
    let cancelled = false;
    setCheckoutPending(true);
    setCheckoutNotice("Confirming your payment with Stripe…");

    async function confirm() {
      const started = Date.now();
      while (!cancelled && Date.now() - started < 20000) {
        try {
          const url = sessionId
            ? `/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`
            : "/api/subscriptions/me";
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as {
              ready?: boolean;
              subscriptions?: SubscriptionResponse[];
            };
            const ready =
              data.ready === true ||
              (Array.isArray(data.subscriptions) &&
                data.subscriptions.some(
                  (s) =>
                    s.accessLevel !== "free" &&
                    (s.status === "active" || s.status === "trialing")
                ));
            if (ready) {
              if (!cancelled) {
                setCheckoutPending(false);
                setCheckoutNotice("Payment confirmed. Your paid membership is active.");
                setLoadNonce((n) => n + 1);
                window.history.replaceState({}, "", "/subscription");
              }
              return;
            }
          }
        } catch {
          // keep polling
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled) {
        setCheckoutPending(false);
        setCheckoutNotice(
          "Stripe is still confirming this payment. Refresh in a moment, or open Billing if the charge already went through."
        );
        setLoadNonce((n) => n + 1);
      }
    }

    confirm();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status === "active" || s.status === "trialing" || s.status === "past_due"),
    [subscriptions]
  );

  const primarySubscription = activeSubscriptions[0] ?? null;

  async function handleCancel(subscription: SubscriptionResponse) {
    if (pendingId) return;
    if (!confirm(`Cancel your ${subscription.planName} subscription with ${subscription.creatorName}?`)) {
      return;
    }
    setPendingId(subscription.id);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed to cancel.");
      }
      const data = (await res.json()) as { subscription: SubscriptionResponse };
      setSubscriptions((prev) =>
        prev.map((item) => (item.id === data.subscription.id ? data.subscription : item))
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to cancel.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleReactivate(subscription: SubscriptionResponse) {
    if (pendingId) return;
    setPendingId(subscription.id);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactivate: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed to reactivate.");
      }
      const data = (await res.json()) as { subscription: SubscriptionResponse };
      setSubscriptions((prev) =>
        prev.map((item) => (item.id === data.subscription.id ? data.subscription : item))
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reactivate.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">

      {/* ── 1. Hero Section ── */}
      <section className="mb-12 relative">
        <div className="absolute top-0 right-1/4 w-[40vw] h-[40vw] bg-emerald-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />
        <Container className="max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="mb-4">
              <Badge variant="emerald">Subscription Settings</Badge>
            </MotionItem>
            <MotionItem>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.1] mb-4">
                Manage Your <span className="text-gradient-primary">Memberships</span>
              </h1>
            </MotionItem>
            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] font-medium max-w-2xl leading-relaxed">
                Review every creator membership tied to your account, see what tier you&apos;re on, and stop or restart any free subscription.
              </p>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      <Container className="max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-10">

          <div className="lg:col-span-2 space-y-10">

            {checkoutNotice && (
              <MotionReveal>
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-sm font-medium text-sky-900">
                  {checkoutPending ? "Confirming your payment with Stripe…" : checkoutNotice}
                </div>
              </MotionReveal>
            )}

            {loadError && (
              <MotionReveal>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700 space-y-3">
                  <p>{loadError}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white border-rose-200 text-rose-800"
                      onClick={() => setLoadNonce((n) => n + 1)}
                    >
                      Try again
                    </Button>
                    <Button variant="ghost" className="text-rose-800" href="/contact">
                      Contact support
                    </Button>
                  </div>
                </div>
              </MotionReveal>
            )}

            {errorMessage && (
              <MotionReveal>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
                  {errorMessage}
                </div>
              </MotionReveal>
            )}

            {/* ── 2. Current / Active Memberships ── */}
            <MotionReveal>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-wrap items-start justify-between gap-4 mb-6 relative z-10">
                  <div>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Active Memberships
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)]">
                        {isLoading ? "—" : activeSubscriptions.length}
                      </span>
                      {!isLoading && activeSubscriptions.length > 0 && (
                        <Badge variant="emerald">Active</Badge>
                      )}
                    </div>
                  </div>
                  {primarySubscription && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--color-ink)]">
                        {formatPrice(primarySubscription.priceMonthly)}{" "}
                        <span className="text-sm text-slate-500 font-medium">/ month</span>
                      </div>
                      {primarySubscription.currentPeriodEnd && (
                        <div className="text-sm text-slate-500 font-medium mt-1">
                          Renews {formatRenewalDate(primarySubscription.currentPeriodEnd)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isLoading ? (
                  <div className="pt-8 border-t border-slate-100 relative z-10 text-sm font-bold text-slate-500">
                    Loading your memberships…
                  </div>
                ) : activeSubscriptions.length === 0 ? (
                  <div className="pt-8 border-t border-slate-100 relative z-10">
                    <p className="text-slate-600 font-medium mb-4">
                      You don&apos;t have any active memberships yet. Browse creators to subscribe to their free tier or upgrade to a paid plan.
                    </p>
                    <Button variant="primary" href="/creators" icon={<ArrowRight className="w-4 h-4 ml-1" />}>
                      Browse Creators
                    </Button>
                  </div>
                ) : (
                  <div className="pt-8 border-t border-slate-100 relative z-10 space-y-4">
                    {activeSubscriptions.map((subscription) => {
                      const status = STATUS_COPY[subscription.status];
                      const isProcessing = pendingId === subscription.id;
                      return (
                        <div
                          key={subscription.id}
                          className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center text-slate-500 font-black shrink-0">
                              {subscription.creatorAvatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={subscription.creatorAvatarUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                subscription.creatorName
                                  .split(" ")
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={
                                    subscription.creatorSlug
                                      ? `/creators/${subscription.creatorSlug}`
                                      : "/creators"
                                  }
                                  className="font-black text-[var(--color-ink)] hover:text-emerald-600 transition-colors truncate"
                                >
                                  {subscription.creatorName}
                                </Link>
                                <Badge variant={status.tone}>{status.label}</Badge>
                              </div>
                              <p className="text-sm font-bold text-slate-600 mt-1">
                                {subscription.planName} · {formatPrice(subscription.priceMonthly)}/mo
                              </p>
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                {subscription.downloadQuota.monthlyLimit === null
                                  ? "Unlimited downloads this month."
                                  : `${subscription.downloadQuota.remaining ?? 0} of ${subscription.downloadQuota.monthlyLimit} downloads left this month.`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {subscription.accessLevel === "free" && subscription.creatorSlug && (
                              <Button
                                variant="primary"
                                className="text-xs"
                                href={`/creators/${subscription.creatorSlug}`}
                              >
                                Upgrade
                              </Button>
                            )}
                            {subscription.cancelAtPeriodEnd ? (
                              <Badge variant="locked">Ends this period</Badge>
                            ) : subscription.accessLevel === "free" ? (
                              <Button
                                variant="outline"
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                                disabled={isProcessing}
                                onClick={() => handleCancel(subscription)}
                              >
                                {isProcessing ? "Cancelling…" : "Cancel"}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                                disabled={isProcessing}
                                onClick={() => handleCancel(subscription)}
                              >
                                {isProcessing ? "Cancelling…" : "Cancel at period end"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </MotionReveal>

            {/* ── 3. Tier comparison (informational) ── */}
            <MotionReveal className="space-y-6">
              <h3 className="text-2xl font-black font-display text-[var(--color-ink)]">Plan Tiers</h3>
              <p className="text-slate-600 font-medium max-w-xl">
                Every creator on Advanced Subscription & Membership Platform offers Free, Basic, and Premium plans. Pricing is set by each creator on their own profile — these tiers describe what kind of access each level unlocks.
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                {TIER_INFO.map((tier) => (
                  <MotionItem
                    key={tier.accessLevel}
                    className={cn(
                      "rounded-2xl border p-6 flex flex-col bg-white border-slate-200 hover:border-slate-300 transition-colors"
                    )}
                  >
                    <h4 className="font-bold text-[var(--color-ink)] mb-1">{tier.name}</h4>
                    <div className="text-xl font-bold text-[var(--color-ink)] mb-6">
                      {tier.accessLevel === "free" ? (
                        <>
                          {tier.price}{" "}
                          <span className="text-xs text-slate-500 font-medium">forever</span>
                        </>
                      ) : (
                        <>
                          {tier.price}{" "}
                          <span className="text-xs text-slate-500 font-medium">/mo</span>
                        </>
                      )}
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      {tier.features.map((feat, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-sm text-slate-600 font-medium"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </MotionItem>
                ))}
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  href="/creators"
                  icon={<Users className="w-4 h-4 ml-1" />}
                >
                  Find a creator to subscribe
                </Button>
              </div>
            </MotionReveal>

            {/* ── 4. Cancellation / Reactivation history ── */}
            {!isLoading && subscriptions.length > activeSubscriptions.length && (
              <MotionReveal>
                <div className="bg-white rounded-3xl border border-slate-200 p-8">
                  <h3 className="font-bold text-[var(--color-ink)] mb-4">
                    Past memberships
                  </h3>
                  <div className="space-y-3">
                    {subscriptions
                      .filter((s) => s.status === "canceled" || s.status === "expired")
                      .map((subscription) => {
                        const isProcessing = pendingId === subscription.id;
                        return (
                          <div
                            key={subscription.id}
                            className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-700 truncate">
                                {subscription.creatorName} · {subscription.planName}
                              </p>
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                Cancelled {formatRenewalDate(subscription.canceledAt)}
                              </p>
                            </div>
                            {subscription.accessLevel === "free" && (
                              <Button
                                variant="outline"
                                className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs shrink-0"
                                disabled={isProcessing}
                                onClick={() => handleReactivate(subscription)}
                              >
                                {isProcessing ? "Reactivating…" : "Reactivate"}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </MotionReveal>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            {/* ── FAQ ── */}
            <MotionReveal className="sticky top-24 space-y-6">
              <div className="bg-[var(--color-ink)] text-white rounded-[2rem] p-8 shadow-xl shadow-slate-900/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-6 border border-white/20 relative z-10">
                  <ShieldCheck className="w-6 h-6 text-sky-400" />
                </div>
                <h3 className="text-xl font-bold font-display mb-4 relative z-10">Subscription FAQ</h3>

                <div className="space-y-6 relative z-10">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm mb-2">When do I get billed?</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Free memberships are never billed. Paid Basic and Premium memberships are billed monthly through Stripe on each creator&apos;s checkout.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm mb-2">Can I switch plans?</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Yes — open a creator&apos;s profile and Subscribe to Basic or Premium. If you already pay that creator, the new tier replaces the old one on the same Stripe subscription.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm mb-2">What happens if I cancel?</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Cancelled free memberships can be reactivated any time. Cancelled paid memberships keep
                      access until the end of the billing period.
                    </p>
                  </div>
                </div>

                <Link
                  href="/support"
                  className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 font-bold text-sm mt-8 transition-colors relative z-10"
                >
                  Read full FAQ <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </MotionReveal>
          </div>

        </div>
      </Container>
    </div>
  );
}
