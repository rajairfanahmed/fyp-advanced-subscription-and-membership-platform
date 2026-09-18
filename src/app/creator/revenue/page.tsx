"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CalendarClock,
  Download,
  ArrowDownRight,
} from "lucide-react";
import type { CreatorRevenueResponse } from "@/types/creator-stats";

function formatCurrencyCents(cents: number, opts: { compact?: boolean } = {}) {
  const amount = cents / 100;
  if (opts.compact && amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RevenuePage() {
  const [data, setData] = useState<CreatorRevenueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/creator/revenue", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load revenue.");
        }
        const json = (await res.json()) as CreatorRevenueResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load revenue."
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = data?.metrics;

  const metricCards = [
    {
      label: "Monthly Recurring Revenue",
      value: metrics ? formatCurrencyCents(metrics.mrrCents) : "—",
      icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
      caption: "From active paid subscriptions",
    },
    {
      label: "Avg. Revenue Per User",
      value: metrics ? formatCurrencyCents(metrics.arpuCents) : "—",
      icon: <TrendingUp className="w-5 h-5 text-sky-600" />,
      caption: "MRR / paid members",
    },
    {
      label: "Failed Payments",
      value: metrics ? metrics.failedPayments.toString() : "—",
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      caption: "Last 30 days",
    },
    {
      label: "Churn Rate (30d)",
      value: metrics ? `${metrics.churnRatePercent.toFixed(1)}%` : "—",
      icon: <ArrowDownRight className="w-5 h-5 text-amber-600" />,
      caption: "Cancelled / starting active",
    },
  ];

  const maxBarValue = useMemo(() => {
    if (!data) return 0;
    return data.trend.reduce((m, p) => Math.max(m, p.valueCents), 0);
  }, [data]);

  return (
    <CreatorShell>
      <div className="space-y-12 min-w-0">

        <DashboardHeader
          eyebrow="Financial Health"
          title="Revenue"
          subtitle="Track recurring revenue, active subscriptions, failed payments, and upcoming renewals."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<Download className="w-4 h-4 ml-1" />}
              href="/api/creator/revenue?format=csv"
              title="Download recent payments as CSV"
            >
              Export CSV
            </Button>
          }
        />

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* ── Metric Cards ── */}
        <MotionItem>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {metricCards.map((metric, i) => (
              <div
                key={i}
                className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                    {metric.icon}
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right max-w-[7rem]">
                    {metric.caption}
                  </span>
                </div>
                <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">
                  {metric.label}
                </h3>
                <p className="text-2xl sm:text-3xl font-black font-display text-slate-900">
                  {isLoading ? "…" : metric.value}
                </p>
              </div>
            ))}
          </div>
        </MotionItem>

        {data && (
          <MotionItem>
            <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Basic MRR
                </p>
                <p className="text-2xl font-black font-display text-slate-900">
                  {formatCurrencyCents(data.mrrByTier.basicMrrCents)}
                </p>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  {data.mrrByTier.basicMembers}{" "}
                  {data.mrrByTier.basicMembers === 1 ? "member" : "members"}
                </p>
              </div>
              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Premium MRR
                </p>
                <p className="text-2xl font-black font-display text-slate-900">
                  {formatCurrencyCents(data.mrrByTier.premiumMrrCents)}
                </p>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  {data.mrrByTier.premiumMembers}{" "}
                  {data.mrrByTier.premiumMembers === 1 ? "member" : "members"}
                </p>
              </div>
            </div>
          </MotionItem>
        )}

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-10">

          {/* ── Main Content Area (Left) ── */}
          <div className="lg:col-span-2 space-y-10 min-w-0">

            {/* MRR Trend Chart */}
            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-5 sm:p-8 lg:p-10 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 lg:mb-10">
                  <h2 className="text-xl font-black font-display text-slate-900">
                    MRR Growth (last 6 months)
                  </h2>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    By new paid subscribers
                  </span>
                </div>

                {isLoading || !data ? (
                  <p className="text-sm font-bold text-slate-500">Loading trend…</p>
                ) : maxBarValue === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 sm:p-10 text-center">
                    <p className="font-black text-slate-700 mb-1">No paid subscriptions yet</p>
                    <p className="text-sm font-medium text-slate-500">
                      As paid memberships start, this chart fills in month-by-month.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="h-64 flex items-end gap-2 sm:gap-3 border-b border-slate-50 pb-6 relative min-w-0">
                      <div className="absolute inset-0 flex flex-col justify-between pt-2 pointer-events-none">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="w-full h-px bg-slate-50/50" />
                        ))}
                      </div>

                      {data.trend.map((point, i) => {
                        const heightPercent = maxBarValue
                          ? Math.max(4, (point.valueCents / maxBarValue) * 100)
                          : 4;
                        return (
                          <div
                            key={i}
                            className="flex-1 min-w-0 flex flex-col justify-end group z-10"
                            title={`${point.label}: ${formatCurrencyCents(point.valueCents)}`}
                          >
                            <div
                              className="w-full bg-teal-50/50 border-t-4 border-teal-500 rounded-t-lg group-hover:bg-teal-100/50 transition-all duration-300"
                              style={{ height: `${heightPercent}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between gap-1 mt-6 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-0">
                      {data.trend.map((p, i) => (
                        <span key={i} className="min-w-0 truncate text-center">{p.label}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </MotionReveal>

            {/* Recent Payments Table */}
            <MotionReveal>
              <div id="recent-payments" className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-8 lg:p-10 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-xl font-black font-display text-slate-900">
                    Recent Payments
                  </h2>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Populates via Stripe
                  </span>
                </div>

                {isLoading ? (
                  <div className="p-5 sm:p-8 lg:p-10 text-sm font-bold text-slate-500">Loading payments…</div>
                ) : data && data.recentPayments.length === 0 ? (
                  <div className="p-5 sm:p-8 lg:p-10 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                      <DollarSign className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="font-black text-slate-700 mb-1">No payments yet</p>
                    <p className="text-sm font-medium text-slate-500 max-w-md">
                      Charges land here after Stripe confirms a member payment. If someone just subscribed, refresh this page in a few seconds.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto min-w-0">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="p-4 sm:p-8">Subscriber</th>
                          <th className="p-4 sm:p-8">Amount</th>
                          <th className="p-4 sm:p-8">Date</th>
                          <th className="p-4 sm:p-8 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {data?.recentPayments.map((payment) => (
                          <tr
                            key={payment.id}
                            className="hover:bg-slate-50/30 transition-colors"
                          >
                            <td className="p-4 sm:p-8 font-bold text-slate-900">
                              {payment.subscriberClerkUserId.slice(0, 8)}…
                            </td>
                            <td className="p-4 sm:p-8 text-slate-900 font-black">
                              {formatCurrencyCents(payment.amountCents)}
                            </td>
                            <td className="p-4 sm:p-8 text-slate-400 font-medium text-xs">
                              {payment.paidAt
                                ? formatDate(payment.paidAt)
                                : formatDate(payment.createdAt)}
                            </td>
                            <td className="p-4 sm:p-8 text-right">
                              <Badge
                                variant={
                                  payment.status === "succeeded"
                                    ? "emerald"
                                    : "locked"
                                }
                                className={
                                  payment.status === "failed"
                                    ? "bg-red-50 text-red-700 border-red-100"
                                    : payment.status === "succeeded"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                      : ""
                                }
                              >
                                {payment.status === "succeeded"
                                  ? "Paid"
                                  : payment.status === "failed"
                                    ? "Failed"
                                    : payment.status === "refunded"
                                      ? "Refunded"
                                      : "Pending"}
                              </Badge>
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

          {/* ── Sidebar Column (Right) ── */}
          <div className="lg:col-span-1 space-y-10">

            {/* Upcoming Renewals */}
            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-5 sm:p-8 lg:p-10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-8 border border-teal-100">
                  <CalendarClock className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="text-xl font-black font-display text-slate-900 mb-4">
                  Upcoming Renewals
                </h3>
                <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8 opacity-80">
                  You have{" "}
                  <strong className="text-slate-900 font-black">
                    {data?.forecast.upcomingRenewalsCount ?? 0}
                  </strong>{" "}
                  paid subscriptions scheduled to renew in the next{" "}
                  {data?.forecast.windowDays ?? 7} days. Members already set to
                  cancel at period end are not included.
                </p>
                <div className="p-6 bg-slate-50/50 rounded-[1.5rem] border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Forecasted revenue (next 7 days)
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900">
                    {data
                      ? formatCurrencyCents(data.forecast.forecastedRevenueCents)
                      : "—"}
                  </span>
                </div>
              </div>
            </MotionReveal>

            {/* Failed Payments Alert (only if any) */}
            {data && data.metrics.failedPayments > 0 && (
              <MotionReveal>
                <div className="bg-red-50/50 rounded-[2.5rem] border border-red-100 p-5 sm:p-8 lg:p-10 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 shadow-sm">
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-black text-red-900 uppercase tracking-tight">
                      System Notice
                    </h3>
                  </div>
                  <p className="text-sm font-medium text-red-800 leading-relaxed mb-8 opacity-90">
                    {data.metrics.failedPayments}{" "}
                    {data.metrics.failedPayments === 1 ? "payment has" : "payments have"}{" "}
                    failed in the last 30 days
                    {data.metrics.failedPaymentsAllTime > data.metrics.failedPayments
                      ? ` (${data.metrics.failedPaymentsAllTime} all time).`
                      : "."}{" "}
                    Review charges and follow up with affected subscribers.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full h-12 bg-white text-red-700 border-red-100 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    onClick={() =>
                      document.getElementById("recent-payments")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                  >
                    Review charges
                  </Button>
                </div>
              </MotionReveal>
            )}

          </div>

        </div>
      </div>
    </CreatorShell>
  );
}
