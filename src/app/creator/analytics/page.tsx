"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import {
  TrendingUp,
  PlaySquare,
  Download,
  MousePointerClick,
  Target,
} from "lucide-react";
import type { CreatorAnalyticsResponse } from "@/types/creator-stats";

function formatNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

export default function AnalyticsPage() {
  const [data, setData] = useState<CreatorAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/creator/analytics", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load analytics.");
        }
        const json = (await res.json()) as CreatorAnalyticsResponse;
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
  }, []);

  const metrics = data?.metrics;

  const metricCards = [
    {
      label: "Total Content Views",
      value: metrics ? formatNumber(metrics.totalContentViews) : "—",
      icon: <PlaySquare className="w-5 h-5 text-violet-600" />,
    },
    {
      label: "Avg. Watch Completion",
      value: metrics?.averageWatchCompletionPercent != null
        ? `${metrics.averageWatchCompletionPercent}%`
        : "Not tracked",
      icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
    },
    {
      label: "File Download Rate",
      value: metrics
        ? `${metrics.fileDownloadRatePercent.toFixed(1)}%`
        : "—",
      icon: <Download className="w-5 h-5 text-sky-600" />,
    },
    {
      label: "Paid conversion",
      value: metrics
        ? `${metrics.premiumConversionPercent.toFixed(1)}%`
        : "—",
      icon: <MousePointerClick className="w-5 h-5 text-amber-600" />,
    },
  ];

  const formatSplit = data?.formatSplit;

  return (
    <CreatorShell>
      <div className="space-y-12 min-w-0">

        <DashboardHeader
          eyebrow="Data & Insights"
          title="Analytics"
          subtitle="Content performance from live totals. Subscriber charts appear after daily snapshots exist."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<Download className="w-4 h-4 ml-1" />}
              href="/api/creator/analytics?format=csv"
              title="Download an analytics summary as CSV"
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
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-5">
                  {metric.icon}
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

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-10">

          {/* ── Main Content Area (Left) ── */}
          <div className="lg:col-span-2 space-y-10 min-w-0">

            {/* Top Performing Content */}
            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-5 sm:p-8 lg:p-10 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 sm:mb-8">
                  <h2 className="text-xl font-black font-display text-slate-900">
                    Top Performing Content
                  </h2>
                  <Link
                    href="/creator/content"
                    className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] hover:opacity-70 transition-opacity"
                  >
                    Manage Library &rarr;
                  </Link>
                </div>

                {isLoading ? (
                  <p className="text-sm font-bold text-slate-500">Loading content…</p>
                ) : data && data.topContent.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 sm:p-10 text-center">
                    <p className="font-black text-slate-700 mb-2">No content to rank yet</p>
                    <p className="text-sm font-medium text-slate-500 mb-4">
                      Publish content to start collecting view and download metrics.
                    </p>
                    <Button variant="primary" href="/creator/content/new">
                      Add your first piece
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.topContent.map((content, i) => (
                      <div
                        key={content.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 gap-4 group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center font-black text-teal-600 text-[10px] shrink-0">
                            {i + 1}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm group-hover:translate-x-1 transition-transform truncate">
                            {content.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-4 sm:justify-end shrink-0 pl-12 sm:pl-0">
                          <span className="text-sm font-black text-slate-900">
                            {content.primaryStat}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </MotionReveal>

            {/* Engagement Time-Series */}
            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-5 sm:p-8 lg:p-10 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                  <h2 className="text-xl font-black font-display text-slate-900">
                    Subscribers over the last 30 days
                  </h2>
                  {data?.daily && data.daily.length > 0 && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                      Live · daily rollup
                    </span>
                  )}
                </div>
                {isLoading ? (
                  <p className="text-sm font-bold text-slate-500">Loading…</p>
                ) : !data?.daily || data.daily.length === 0 ? (
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    Daily and weekly trend charts will appear once the analytics
                    rollup job has produced its first snapshot. Today&rsquo;s
                    numbers above are exact, all-time totals computed directly
                    from your live content.
                  </p>
                ) : (
                  <div>
                    <div className="flex items-end gap-1 sm:gap-1.5 h-32 min-w-0">
                      {(() => {
                        const max = Math.max(
                          1,
                          ...data.daily.map((d) => d.totalSubscribers)
                        );
                        return data.daily.map((point) => {
                          const heightPct =
                            (point.totalSubscribers / max) * 100;
                          return (
                            <div
                              key={point.date}
                              className="flex-1 min-w-0 flex flex-col items-center gap-1.5 group"
                              title={`${point.label}: ${point.totalSubscribers} subscribers`}
                            >
                              <div className="w-full bg-slate-100 rounded-md relative h-full flex items-end overflow-hidden">
                                <div
                                  className="w-full bg-emerald-400/80 group-hover:bg-emerald-500 rounded-md transition-colors"
                                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">
                      <span>{data.daily[0]?.label}</span>
                      <span>{data.daily[data.daily.length - 1]?.label}</span>
                    </div>
                  </div>
                )}
              </div>
            </MotionReveal>

          </div>

          {/* ── Sidebar Column (Right) ── */}
          <div className="lg:col-span-1 space-y-10">

            {/* Format Split */}
            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-5 sm:p-8 lg:p-10 shadow-sm relative overflow-hidden">
                <h3 className="text-xl font-black font-display text-slate-900 mb-8">
                  Format Split
                </h3>

                {isLoading ? (
                  <p className="text-sm font-bold text-slate-500">Loading…</p>
                ) : !formatSplit ||
                  (formatSplit.videos === 0 &&
                    formatSplit.files === 0 &&
                    formatSplit.articles === 0) ? (
                  <p className="text-sm font-medium text-slate-500">
                    No published content yet — split appears once you publish at least one item.
                  </p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400">Videos</span>
                        <span className="text-slate-900">{formatSplit.videos}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${formatSplit.videos}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400">Files</span>
                        <span className="text-slate-900">{formatSplit.files}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full"
                          style={{ width: `${formatSplit.files}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400">Articles</span>
                        <span className="text-slate-900">{formatSplit.articles}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full"
                          style={{ width: `${formatSplit.articles}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </MotionReveal>

            {/* Subscriber Insights */}
            <MotionReveal>
              <div className="bg-sky-50/50 rounded-[2.5rem] border border-sky-100 p-5 sm:p-8 lg:p-10 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center shrink-0 border border-sky-200 shadow-sm">
                    <Target className="w-6 h-6 text-sky-600" />
                  </div>
                  <h3 className="text-lg font-black text-sky-900 uppercase tracking-tight">
                    Growth Insight
                  </h3>
                </div>
                <p className="text-[13px] font-medium text-sky-800 leading-relaxed mb-8 opacity-90">
                  Members who download at least one resource in their first 3 days
                  are <strong className="font-black">3x more likely</strong> to
                  upgrade. Pin a featured download to surface this.
                </p>
                <div className="p-6 bg-white/80 rounded-2xl border border-sky-100/50 shadow-sm">
                  <span className="text-[10px] font-black text-sky-700 uppercase tracking-[0.2em] block mb-2">
                    Strategy
                  </span>
                  <span className="text-sm font-bold text-sky-900">
                    Pin a featured PDF to your library hero.
                  </span>
                </div>
              </div>
            </MotionReveal>

          </div>

        </div>
      </div>
    </CreatorShell>
  );
}
