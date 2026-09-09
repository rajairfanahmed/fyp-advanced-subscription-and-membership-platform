"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import {
  TrendingUp,
  Download,
  Users,
  AlertCircle,
  PlaySquare,
  DollarSign,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminAnalyticsRange,
  AdminAnalyticsResponse,
} from "@/types/admin-stats";

const RANGE_OPTIONS: Array<{ id: AdminAnalyticsRange; label: string }> = [
  { id: "1m", label: "1m" },
  { id: "3m", label: "3m" },
  { id: "6m", label: "6m" },
  { id: "12m", label: "12m" },
];

function formatCurrencyCents(cents: number) {
  const amount = cents / 100;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function formatNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [range, setRange] = useState<AdminAnalyticsRange>("6m");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch(
          `/api/admin/analytics?range=${encodeURIComponent(range)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || "Failed to load analytics.");
        }
        const json = (await res.json()) as AdminAnalyticsResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load analytics."
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const rangeLabel = (() => {
    const opt = RANGE_OPTIONS.find((o) => o.id === range);
    if (!opt) return "Last 6 Months";
    if (range === "1m") return "Last Month";
    if (range === "3m") return "Last 3 Months";
    if (range === "6m") return "Last 6 Months";
    return "Last 12 Months";
  })();

  const metrics = data?.metrics;

  const metricCards = [
    {
      label: "Platform MRR",
      value: metrics ? formatCurrencyCents(metrics.platformMrrCents) : "—",
      icon: <DollarSign className="w-6 h-6 text-emerald-600" />,
    },
    {
      label: "Active Subscribers",
      value: metrics ? formatNumber(metrics.activeSubscribers) : "—",
      icon: <Users className="w-6 h-6 text-sky-600" />,
    },
    {
      label: "Total Views",
      value: metrics ? formatNumber(metrics.totalViews) : "—",
      icon: <PlaySquare className="w-6 h-6 text-violet-600" />,
    },
    {
      label: "Premium Conv.",
      value: metrics
        ? `${metrics.premiumConversionPercent.toFixed(1)}%`
        : "—",
      icon: <TrendingUp className="w-6 h-6 text-indigo-600" />,
    },
  ];

  const maxRevenue = useMemo(
    () => (data ? data.trend.reduce((m, p) => Math.max(m, p.valueCents), 0) : 0),
    [data]
  );
  const maxAcquisition = useMemo(
    () => (data ? data.acquisition.reduce((m, p) => Math.max(m, p.count), 0) : 0),
    [data]
  );

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Market Intelligence"
          title="Platform Performance"
          subtitle="Measure platform growth, revenue, churn, content activity, creator performance, and subscriber engagement."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<Download className="w-4 h-4 ml-1" />}
              href={`/api/admin/analytics?format=csv&range=${encodeURIComponent(
                range
              )}`}
              title="Download analytics report as CSV"
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

        <MotionItem>
          <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                Time Range
              </p>
              <p className="text-sm font-black text-slate-900 ml-1">
                {rangeLabel}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setRange(opt.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer",
                    range === opt.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </MotionItem>

        <MotionItem>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {metricCards.map((metric, i) => (
              <div key={i} className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-6 shadow-sm">
                  {metric.icon}
                </div>
                <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">{metric.label}</h3>
                <p className="text-3xl font-black font-display text-slate-900 leading-none">
                  {isLoading ? "…" : metric.value}
                </p>
              </div>
            ))}
          </div>
        </MotionItem>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Revenue Trend */}
          <MotionReveal>
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-xl font-black font-display text-slate-900 tracking-tight">Revenue Trend</h2>
                <span className="bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-xl px-4 py-2">
                  {rangeLabel}
                </span>
              </div>
              {isLoading || !data ? (
                <p className="text-sm font-bold text-slate-500">Loading trend…</p>
              ) : maxRevenue === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center mt-auto">
                  <p className="font-black text-slate-700 mb-1">No paid revenue yet</p>
                  <p className="text-sm font-medium text-slate-500">
                    Once paid subscriptions land, revenue will populate here by month.
                  </p>
                </div>
              ) : (
                <>
                  <div className="h-64 flex items-end gap-3 border-b border-slate-50 pb-6 relative mt-auto">
                    <div className="absolute inset-0 flex flex-col justify-between pt-2 pointer-events-none">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-full h-px bg-slate-50/50" />
                      ))}
                    </div>
                    {data.trend.map((point, i) => {
                      const heightPercent = maxRevenue
                        ? Math.max(4, (point.valueCents / maxRevenue) * 100)
                        : 4;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col justify-end z-10"
                          title={`${point.label}: ${formatCurrencyCents(point.valueCents)}`}
                        >
                          <div
                            className="w-full bg-emerald-50 border-t-4 border-emerald-500 rounded-t-lg transition-all duration-500"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {data.trend.map((p, i) => (
                      <span key={i}>{p.label}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </MotionReveal>

          {/* User Acquisition */}
          <MotionReveal>
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-xl font-black font-display text-slate-900 tracking-tight">User Acquisition</h2>
                <span className="bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-xl px-4 py-2">
                  {rangeLabel}
                </span>
              </div>
              {isLoading || !data ? (
                <p className="text-sm font-bold text-slate-500">Loading acquisition…</p>
              ) : maxAcquisition === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center mt-auto">
                  <p className="font-black text-slate-700 mb-1">No subscriptions yet</p>
                  <p className="text-sm font-medium text-slate-500">
                    Acquisition data will populate as subscribers join.
                  </p>
                </div>
              ) : (
                <>
                  <div className="h-64 flex items-end gap-3 border-b border-slate-50 pb-6 relative mt-auto">
                    <div className="absolute inset-0 flex flex-col justify-between pt-2 pointer-events-none">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-full h-px bg-slate-50/50" />
                      ))}
                    </div>
                    {data.acquisition.map((point, i) => {
                      const heightPercent = maxAcquisition
                        ? Math.max(4, (point.count / maxAcquisition) * 100)
                        : 4;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col justify-end z-10"
                          title={`${point.label}: ${point.count} new subs`}
                        >
                          <div
                            className="w-full bg-sky-50 border-t-4 border-sky-500 rounded-t-lg transition-all duration-500"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {data.acquisition.map((p, i) => (
                      <span key={i}>{p.label}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </MotionReveal>
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black font-display text-slate-900 tracking-tight">Global Content Leaders</h2>
                </div>
                {isLoading ? (
                  <p className="text-sm font-bold text-slate-500">Loading top content…</p>
                ) : data && data.topContent.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                    <p className="font-black text-slate-700 mb-2">No content yet</p>
                    <p className="text-sm font-medium text-slate-500">
                      Once creators publish content, top performers will be ranked here by views and downloads.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data?.topContent.map((content, i) => (
                      <div
                        key={content.id}
                        className="flex items-center justify-between p-5 rounded-2xl hover:bg-slate-50/50 transition-all group border border-transparent hover:border-slate-50 gap-6"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-xs shrink-0 shadow-sm group-hover:bg-white">
                            {i + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-snug">{content.title}</h4>
                            <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mt-1">by {content.creatorName}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 bg-slate-50 px-3 py-1.5 rounded-lg group-hover:bg-white">
                          {content.primaryStat}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </MotionReveal>
          </div>

          <div className="lg:col-span-1 space-y-10">
            <MotionReveal className="space-y-8">
              <div className="bg-amber-50/50 rounded-[2.5rem] border border-amber-100 p-10 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
                    <TrendingDown className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-black font-display text-amber-900 uppercase tracking-tight">Churn Health</h3>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-black text-amber-900 font-display tracking-tight">
                    {isLoading ? "…" : `${(data?.churnRatePercent ?? 0).toFixed(1)}%`}
                  </span>
                  <span className="text-[10px] font-black text-amber-600 ml-3 uppercase tracking-widest opacity-80">30-day Rate</span>
                </div>
                <p className="text-[13px] font-medium text-amber-800 leading-relaxed mb-4 opacity-80">
                  Computed from cancellations in the last 30 days against all subscriptions.
                </p>
              </div>

              <div className="bg-red-50/50 rounded-[2.5rem] border border-red-100 p-10 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 border border-red-200">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-black font-display text-red-900 uppercase tracking-tight">Failed Payments</h3>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-black text-red-900 font-display tracking-tight">
                    {isLoading
                      ? "…"
                      : `${(data?.failedPaymentRatioPercent ?? 0).toFixed(1)}%`}
                  </span>
                  <span className="text-[10px] font-black text-red-700 ml-3 uppercase tracking-widest opacity-80">Failure Ratio</span>
                </div>
                <p className="text-[13px] font-medium text-red-800 leading-relaxed opacity-80">
                  Failed-to-total ratio across all payment events. Retry a failed charge from Payments.
                </p>
              </div>
            </MotionReveal>
          </div>
        </div>

        <MotionReveal>
          <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm flex items-start gap-4">
            <span className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-slate-400" />
            </span>
            <p className="text-[13px] font-medium text-slate-600 leading-relaxed">
              Charts above bucket data by month using each subscription&rsquo;s start date over the selected range.
              Once the daily <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs">Analytics</code> rollup job lands,
              we&rsquo;ll swap these live aggregates for the persisted daily series so longer windows are cheap.
            </p>
          </div>
        </MotionReveal>
      </div>
    </AdminShell>
  );
}
