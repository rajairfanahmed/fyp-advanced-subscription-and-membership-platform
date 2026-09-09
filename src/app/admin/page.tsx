"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem } from "@/components/ui/MotionReveal";
import { Badge } from "@/components/ui/Badge";
import {
  Users,
  UserCheck,
  UserSquare2,
  DollarSign,
  AlertCircle,
  UserMinus,
  Video,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import type { AdminOverviewResponse } from "@/types/admin-stats";

function formatCurrencyCents(cents: number) {
  const amount = cents / 100;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function formatNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatRelative(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diff < 60) return "Just now";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} ${m === 1 ? "min" : "mins"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${d === 1 ? "day" : "days"} ago`;
  const w = Math.floor(d / 7);
  return `${w} ${w === 1 ? "week" : "weeks"} ago`;
}

function activityDot(type: AdminOverviewResponse["recentActivity"][number]["type"]) {
  if (type === "subscription_started" || type === "payment_succeeded")
    return "bg-emerald-400";
  if (type === "subscription_canceled") return "bg-amber-400";
  if (type === "payment_failed") return "bg-red-400";
  if (type === "content_published") return "bg-sky-400";
  return "bg-slate-300";
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/admin/overview", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load overview.");
        }
        const json = (await res.json()) as AdminOverviewResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load overview."
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
      label: "Total Users",
      value: metrics ? formatNumber(metrics.totalUsers) : "—",
      icon: <Users className="w-5 h-5 text-slate-600" />,
      trend: "All time",
    },
    {
      label: "Active Subscribers",
      value: metrics ? formatNumber(metrics.activeSubscribers) : "—",
      icon: <UserCheck className="w-5 h-5 text-emerald-600" />,
      trend: "Distinct subscribers",
    },
    {
      label: "Active Creators",
      value: metrics ? formatNumber(metrics.activeCreators) : "—",
      icon: <UserSquare2 className="w-5 h-5 text-violet-600" />,
      trend: "All accounts",
    },
    {
      label: "Monthly Revenue",
      value: metrics ? formatCurrencyCents(metrics.monthlyRevenueCents) : "—",
      icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
      trend: "Active paid MRR",
    },
    {
      label: "Failed Payments",
      value: metrics ? formatNumber(metrics.failedPayments) : "—",
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      trend: "All time",
    },
    {
      label: "Cancelled (30d)",
      value: metrics ? formatNumber(metrics.cancelledSubscribers30d) : "—",
      icon: <UserMinus className="w-5 h-5 text-amber-600" />,
      trend: "Last 30 days",
    },
    {
      label: "Published Content",
      value: metrics ? formatNumber(metrics.publishedContent) : "—",
      icon: <Video className="w-5 h-5 text-sky-600" />,
      trend: "Live items",
    },
    {
      label: "Platform Conversion",
      value: metrics
        ? `${metrics.conversionRatePercent.toFixed(1)}%`
        : "—",
      icon: <TrendingUp className="w-5 h-5 text-indigo-600" />,
      trend: "Paid / total",
    },
  ];

  const maxBarValue = useMemo(() => {
    if (!data) return 0;
    return data.trend.reduce((m, p) => Math.max(m, p.valueCents), 0);
  }, [data]);

  return (
    <AdminShell>
      <div className="space-y-12">

        <DashboardHeader
          role="admin"
          eyebrow="Platform Status"
          title="Admin Dashboard"
          subtitle="Monitor platform users, creators, subscribers, subscriptions, payments, content, notifications, and analytics from one control centre."
        />

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* Metrics Grid */}
        <MotionItem>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {metricCards.map((metric, i) => (
              <div key={i} className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-white transition-colors">
                    {metric.icon}
                  </div>
                </div>
                <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">
                  {metric.label}
                </h3>
                <p className="text-3xl font-black font-display text-slate-900 mb-2 leading-none">
                  {isLoading ? "…" : metric.value}
                </p>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
                  {metric.trend}
                </span>
              </div>
            ))}
          </div>
        </MotionItem>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-10">
          <div className="lg:col-span-2 space-y-12">

            {/* Quick Actions */}
            <MotionItem>
              <h2 className="text-xl font-black font-display text-slate-900 mb-6 tracking-tight">Admin Operations</h2>
              <div className="grid sm:grid-cols-3 gap-6">
                <Link href="/admin/users" className="bg-white rounded-[2rem] border border-slate-200 p-8 flex flex-col hover:border-violet-300 hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users className="w-20 h-20 text-violet-600 -rotate-12 translate-x-4 -translate-y-4" />
                  </div>
                  <Users className="w-8 h-8 text-violet-600 mb-4" />
                  <h3 className="font-black text-slate-900 mb-1.5 uppercase tracking-tight text-sm">Review Users</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2 group-hover:text-violet-600 transition-colors mt-auto">Manage accounts <ArrowRight className="w-3.5 h-3.5" /></p>
                </Link>
                <Link href="/admin/creators" className="bg-white rounded-[2rem] border border-slate-200 p-8 flex flex-col hover:border-sky-300 hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <UserSquare2 className="w-20 h-20 text-sky-600 -rotate-12 translate-x-4 -translate-y-4" />
                  </div>
                  <UserSquare2 className="w-8 h-8 text-sky-600 mb-4" />
                  <h3 className="font-black text-slate-900 mb-1.5 uppercase tracking-tight text-sm">Review Creators</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2 group-hover:text-sky-600 transition-colors mt-auto">Monitor earnings <ArrowRight className="w-3.5 h-3.5" /></p>
                </Link>
                <Link href="/admin/payments" className="bg-white rounded-[2rem] border border-slate-200 p-8 flex flex-col hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <DollarSign className="w-20 h-20 text-emerald-600 -rotate-12 translate-x-4 -translate-y-4" />
                  </div>
                  <DollarSign className="w-8 h-8 text-emerald-600 mb-4" />
                  <h3 className="font-black text-slate-900 mb-1.5 uppercase tracking-tight text-sm">Review Payments</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2 group-hover:text-emerald-600 transition-colors mt-auto">Check failures <ArrowRight className="w-3.5 h-3.5" /></p>
                </Link>
              </div>
            </MotionItem>

            {/* Revenue Trend */}
            <MotionItem>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm overflow-hidden relative group">
                <div className="flex items-center justify-between mb-10">
                  <h2 className="text-xl font-black font-display text-slate-900 tracking-tight">Platform Revenue</h2>
                  <Badge variant="default" className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase tracking-widest text-[9px]">
                    Live
                  </Badge>
                </div>

                {isLoading || !data ? (
                  <p className="text-sm font-bold text-slate-500">Loading trend…</p>
                ) : maxBarValue === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                    <p className="font-black text-slate-700 mb-1">No paid revenue yet</p>
                    <p className="text-sm font-medium text-slate-500">
                      Once paid subscriptions land, this chart will fill in by month.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="h-64 flex items-end gap-3 border-b border-slate-50 pb-6 relative">
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
                            className="flex-1 flex flex-col justify-end z-10"
                            title={`${point.label}: ${formatCurrencyCents(point.valueCents)}`}
                          >
                            <div
                              className="w-full bg-violet-50 border-t-4 border-violet-500 rounded-t-lg transition-all duration-500"
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
            </MotionItem>

          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-12">
            {/* Health Snapshot */}
            <MotionItem>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h2 className="text-xl font-black font-display text-slate-900 mb-8 tracking-tight">
                  Health Snapshot
                </h2>
                {isLoading ? (
                  <p className="text-sm font-bold text-slate-500">Loading…</p>
                ) : (
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400">Payment Success</span>
                        <span className="text-emerald-600">
                          {data?.health.paymentSuccessRatePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{
                            width: `${data?.health.paymentSuccessRatePercent ?? 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400">Subscriber Reach</span>
                        <span className="text-sky-600">
                          {data?.health.userRetentionRatePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <div
                          className="h-full bg-sky-500 rounded-full"
                          style={{
                            width: `${data?.health.userRetentionRatePercent ?? 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </MotionItem>

            {/* Recent Activity */}
            <MotionItem>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm relative">
                <h2 className="text-xl font-black font-display text-slate-900 mb-8 tracking-tight">
                  Recent Activity
                </h2>
                {isLoading ? (
                  <p className="text-sm font-bold text-slate-500">Loading activity…</p>
                ) : data && data.recentActivity.length === 0 ? (
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    No recent activity yet. New subscriptions, payments, and content will appear here.
                  </p>
                ) : (
                  <div className="space-y-8 relative">
                    <div className="absolute top-0 left-[1.125rem] bottom-0 w-px bg-slate-100" />
                    {data?.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex gap-6 relative">
                        <div className={`w-2.5 h-2.5 rounded-full ${activityDot(activity.type)} ring-4 ring-white shrink-0 mt-1.5 z-10`} />
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-snug mb-1.5 opacity-80">
                            {activity.text}
                          </p>
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-80">
                            {formatRelative(activity.occurredAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </MotionItem>
          </div>

        </div>
      </div>
    </AdminShell>
  );
}
