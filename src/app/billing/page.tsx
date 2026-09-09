"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CreditCard,
  Download,
  AlertCircle,
  CheckCircle2,
  History,
} from "lucide-react";
import type { PaymentResponse, PaymentStatus } from "@/types/payment";
import type { SubscriptionResponse } from "@/types/subscription";

const STATUS_TONE: Record<PaymentStatus, "emerald" | "sky" | "default" | "locked"> = {
  succeeded: "emerald",
  pending: "sky",
  failed: "locked",
  refunded: "default",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  succeeded: "Paid",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};

function formatCurrency(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BillingPage() {
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadNonce, setLoadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const [paymentRes, subRes] = await Promise.all([
          fetch("/api/payments/me", { cache: "no-store" }),
          fetch("/api/subscriptions/me", { cache: "no-store" }),
        ]);
        if (!paymentRes.ok || !subRes.ok) throw new Error("Failed");
        const paymentData = (await paymentRes.json()) as { payments: PaymentResponse[] };
        const subData = (await subRes.json()) as { subscriptions: SubscriptionResponse[] };
        if (!cancelled) {
          setPayments(paymentData.payments ?? []);
          setSubscriptions(subData.subscriptions ?? []);
        }
      } catch {
        if (!cancelled)
          setErrorMessage("We couldn't load your billing details. Please try again or contact support if it continues.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadNonce]);

  const activePaidSubscription = useMemo(
    () =>
      subscriptions.find(
        (s) =>
          (s.status === "active" || s.status === "trialing" || s.status === "past_due") &&
          s.accessLevel !== "free"
      ) ?? null,
    [subscriptions]
  );

  const lastFailedPayment = useMemo(
    () => payments.find((p) => p.status === "failed") ?? null,
    [payments]
  );

  const lastSuccessfulPayment = useMemo(
    () => payments.find((p) => p.status === "succeeded") ?? null,
    [payments]
  );

  // Hide the "Payment Method" panel for users who have never paid.
  // It's only meaningful once Stripe knows about a card on file.
  const hasPaymentHistory = payments.length > 0;
  const showPaymentMethodPanel = Boolean(activePaidSubscription || hasPaymentHistory);

  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState("");

  async function openBillingPortal() {
    setIsOpeningPortal(true);
    setPortalError("");
    try {
      const res = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnUrl: typeof window !== "undefined" ? window.location.href : undefined }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Stripe billing portal is unavailable right now.");
      }
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Stripe billing portal is unavailable right now.");
      setIsOpeningPortal(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">

      {/* ── 1. Hero Section ── */}
      <section className="mb-12 relative">
        <div className="absolute top-0 right-1/4 w-[40vw] h-[40vw] bg-sky-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />
        <Container className="max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="mb-4">
              <Badge variant="sky">Billing Hub</Badge>
            </MotionItem>
            <MotionItem>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.1] mb-4">
                Billing And <span className="text-gradient-primary">Payment History</span>
              </h1>
            </MotionItem>
            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] font-medium max-w-2xl leading-relaxed">
                Track your renewal dates, payment status, and invoice history for every paid Advanced Subscription & Membership Platform membership.
              </p>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      <Container className="max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-10">

          <div className="lg:col-span-2 space-y-10">

            {errorMessage && (
              <MotionReveal>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700 space-y-3">
                  <p>{errorMessage}</p>
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

            {/* ── 5. Failed Payment Alert (real, only when needed) ── */}
            {lastFailedPayment && (
              <MotionReveal>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                  <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-red-900 mb-1">Action Required: Payment Failed</h3>
                    <p className="text-sm text-red-800 font-medium leading-relaxed mb-3">
                      Your latest payment of{" "}
                      <span className="font-black">
                        {formatCurrency(lastFailedPayment.amountCents, lastFailedPayment.currency)}
                      </span>{" "}
                      to {lastFailedPayment.creatorName} could not be processed. Update your billing method to
                      keep your access.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white border-red-200 text-red-700 hover:bg-red-50 py-1.5 h-auto text-xs"
                      onClick={openBillingPortal}
                      disabled={isOpeningPortal}
                    >
                      {isOpeningPortal ? "Opening Stripe…" : "Update Billing Method"}
                    </Button>
                  </div>
                </div>
              </MotionReveal>
            )}

            {/* ── 2 & 3. Billing Status & Payment Method ── */}
            <MotionReveal>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                <h2 className="text-2xl font-black font-display text-[var(--color-ink)] mb-8 relative z-10">
                  Overview
                </h2>

                <div className={`grid ${showPaymentMethodPanel ? "sm:grid-cols-2" : "sm:grid-cols-1"} gap-8 relative z-10`}>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-widest">
                        Payment Status
                      </h3>
                      {isLoading ? (
                        <div className="text-slate-400 font-medium">Loading…</div>
                      ) : lastFailedPayment ? (
                        <div className="flex items-center gap-2 text-red-600 font-bold">
                          <AlertCircle className="w-5 h-5" /> Payment failed
                        </div>
                      ) : lastSuccessfulPayment || activePaidSubscription ? (
                        <div className="flex items-center gap-2 text-[var(--color-ink)] font-bold">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Current &amp; Active
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-slate-500 font-bold">
                            <CheckCircle2 className="w-5 h-5 text-slate-400" /> No paid memberships
                          </div>
                          {subscriptions.some(
                            (s) =>
                              s.accessLevel === "free" &&
                              (s.status === "active" || s.status === "trialing")
                          ) && (
                            <p className="text-sm font-medium text-slate-600 leading-relaxed">
                              You&apos;re on Follow free with one or more creators. Open a creator profile and Subscribe to Basic or Premium to start paid billing.
                            </p>
                          )}
                          <Button variant="primary" size="sm" href="/creators">
                            Browse creators
                          </Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-widest">
                        Next Renewal
                      </h3>
                      {activePaidSubscription && activePaidSubscription.currentPeriodEnd ? (
                        <div className="text-[var(--color-ink)] font-bold">
                          {formatDate(activePaidSubscription.currentPeriodEnd)}{" "}
                          <span className="text-slate-400 font-medium ml-1">
                            (${activePaidSubscription.priceMonthly.toFixed(activePaidSubscription.priceMonthly % 1 === 0 ? 0 : 2)})
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-500 font-medium">
                          No upcoming renewals
                        </div>
                      )}
                    </div>
                  </div>

                  {showPaymentMethodPanel && (
                    <div className="space-y-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-widest">
                          Payment Method
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-8 bg-white border border-slate-200 rounded flex items-center justify-center font-bold text-xs text-slate-400 shadow-sm">
                            —
                          </div>
                          <span className="font-bold text-slate-500">Managed by Stripe</span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                          You can update your card or cancel anytime in the Stripe billing portal. Questions?{" "}
                          <Link href="/contact" className="font-bold text-emerald-700 hover:text-emerald-800 underline-offset-2 hover:underline">
                            Contact us
                          </Link>
                          .
                        </p>
                        {portalError && (
                          <p className="mt-3 text-xs font-bold text-red-700">
                            {portalError}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={openBillingPortal}
                        disabled={isOpeningPortal}
                      >
                        {isOpeningPortal ? "Opening Stripe…" : "Update Method"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </MotionReveal>

            {/* ── 4. Invoice History ── */}
            <MotionReveal>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-2xl font-black font-display text-[var(--color-ink)]">
                    Invoice History
                  </h2>
                  <History className="w-6 h-6 text-slate-400" />
                </div>

                {isLoading ? (
                  <div className="p-12 text-sm font-bold text-slate-500">
                    Loading invoices…
                  </div>
                ) : payments.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                      <CreditCard className="w-7 h-7 text-slate-300" />
                    </div>
                    <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                      No invoices yet
                    </h3>
                    <p className="text-slate-500 font-medium max-w-md mb-6">
                      Once you pay for a Basic or Premium membership, your receipts will appear here.
                    </p>
                    <Button variant="primary" href="/creators">
                      Browse creators
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest">
                          <th className="p-6 font-bold">Date</th>
                          <th className="p-6 font-bold">Creator</th>
                          <th className="p-6 font-bold">Amount</th>
                          <th className="p-6 font-bold">Status</th>
                          <th className="p-6 font-bold text-right">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {payments.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-6 font-medium text-[var(--color-ink)] whitespace-nowrap">
                              {formatDate(inv.paidAt) || formatDate(inv.createdAt)}
                            </td>
                            <td className="p-6 text-slate-600 font-medium whitespace-nowrap">
                              {inv.creatorName}
                              {inv.description ? (
                                <div className="text-xs font-normal text-slate-400 mt-1">
                                  {inv.description}
                                </div>
                              ) : null}
                            </td>
                            <td className="p-6 text-slate-600 font-bold whitespace-nowrap">
                              {formatCurrency(inv.amountCents, inv.currency)}
                            </td>
                            <td className="p-6 whitespace-nowrap">
                              <Badge variant={STATUS_TONE[inv.status]}>
                                {STATUS_LABEL[inv.status]}
                              </Badge>
                            </td>
                            <td className="p-6 text-right whitespace-nowrap">
                              {inv.receiptUrl ? (
                                <a
                                  href={inv.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                                  title="Open receipt"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              ) : (
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-300">
                                  <Download className="w-4 h-4" />
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </MotionReveal>
          </div>

          <div className="lg:col-span-1 space-y-6">
            {/* ── 6. Billing FAQ Card ── */}
            <MotionReveal className="sticky top-24 space-y-6">
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-6 border border-slate-100">
                  <CreditCard className="w-6 h-6 text-sky-500" />
                </div>
                <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-4">Billing Help</h3>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-[var(--color-ink)] text-sm mb-1">How do I change my card?</h4>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      Card management runs through Stripe&apos;s billing portal. The button enables once a successful
                      checkout has been completed.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-[var(--color-ink)] text-sm mb-1">Where are my receipts?</h4>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      Receipts attach to the row in Invoice History as soon as Stripe confirms the payment.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-[var(--color-ink)] text-sm mb-1">Need to change plans?</h4>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      Open the creator&apos;s profile and Subscribe to a different tier. Paid plan changes update the same Stripe subscription.
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
                  <Button variant="secondary" className="w-full" href="/subscription">Manage Subscription</Button>
                  <Button variant="outline" className="w-full" href="/support">Contact Support</Button>
                </div>
              </div>
            </MotionReveal>
          </div>

        </div>
      </Container>
    </div>
  );
}
