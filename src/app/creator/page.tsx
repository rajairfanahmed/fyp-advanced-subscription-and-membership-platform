"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  DollarSign,
  Users,
  Eye,
  BellRing,
  UserMinus,
  TrendingUp,
  PlusCircle,
  CreditCard,
  PlaySquare,
  FileText,
  FileArchive,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import type { CreatorOverviewResponse } from "@/types/creator-stats";

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
  if (m < 60) return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${d === 1 ? "day" : "days"} ago`;
  const w = Math.floor(d / 7);
  return `${w} ${w === 1 ? "week" : "weeks"} ago`;
}

function contentIcon(type: "video" | "article" | "file") {
  if (type === "video") return <PlaySquare className="w-6 h-6" />;
  if (type === "article") return <FileText className="w-6 h-6" />;
  return <FileArchive className="w-6 h-6" />;
}

export default function CreatorOverviewPage() {
  const [data, setData] = useState<CreatorOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadNonce, setLoadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/creator/overview", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load overview.");
        }
        const json = (await res.json()) as CreatorOverviewResponse;
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
  }, [loadNonce]);

  const metrics = data?.metrics;

  const metricCards = [
    {
      label: "Monthly Revenue",
      value: metrics ? formatCurrencyCents(metrics.monthlyRevenueCents) : "—",
      icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
      trend: metrics
        ? `${metrics.basicSubscribers} basic · ${metrics.premiumSubscribers} premium`
        : "—",
      bg: "bg-emerald-50",
    },
    {
      label: "Active Subscribers",
      value: metrics ? formatNumber(metrics.activeSubscribers) : "—",
      icon: <Users className="w-5 h-5 text-sky-600" />,
      trend: metrics
        ? `${formatNumber(metrics.freeSubscribers)} free · ${formatNumber(metrics.paidSubscribers)} paid`
        : "—",
      bg: "bg-sky-50",
    },
    {
      label: "Content Views",
      value: metrics ? formatNumber(metrics.contentViews) : "—",
      icon: <Eye className="w-5 h-5 text-violet-600" />,
      trend: "All published content",
      bg: "bg-violet-50",
    },
    {
      label: "Pending cancellations",
      value: metrics ? formatNumber(metrics.pendingCancellations) : "—",
      icon: <BellRing className="w-5 h-5 text-amber-600" />,
      trend: "Cancel at period end",
      bg: "bg-amber-50",
      href: "/creator/subscribers?filter=cancel_scheduled",
    },
    {
      label: "Cancelled Subs (30d)",
      value: metrics
        ? formatNumber(metrics.cancelledSubscribers30d)
        : "—",
      icon: <UserMinus className="w-5 h-5 text-red-600" />,
      trend: "Last 30 days",
      bg: "bg-red-50",
    },
    {
      label: "Conversion Rate",
      value: metrics
        ? `${metrics.conversionRatePercent.toFixed(1)}%`
        : "—",
      icon: <TrendingUp className="w-5 h-5 text-indigo-600" />,
      trend: "Paid / total",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <CreatorShell>
      <div className="space-y-12 min-w-0">
        <DashboardHeader
          eyebrow="Workspace Overview"
          title={data?.creatorName ? `${data.creatorName}'s Studio` : "Creator Dashboard"}
          subtitle="Manage content, subscribers, plans, revenue, and engagement from one creator workspace."
          action={
            <Button
              variant="primary"
              href="/creator/content/new"
              icon={<PlusCircle className="w-4 h-4 ml-1" />}
            >
              New Content
            </Button>
          }
        />

        {data && data.profileStatus === "draft" && (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 md:p-6 space-y-5"
            role="status"
            aria-label="Profile publish readiness"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-black text-amber-950 mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {data.publishReadiness.ready
                    ? "You're ready to publish"
                    : "Finish setting up your profile"}
                </p>
                <p className="text-sm font-medium text-amber-900/90 max-w-2xl">
                  {data.publishReadiness.ready ? (
                    <>
                      All the basics look good. Flip Profile Status to{" "}
                      <span className="font-bold">Published</span> in Settings to
                      appear on{" "}
                      <Link
                        href="/creators"
                        className="font-bold underline decoration-amber-700/50 hover:decoration-amber-900"
                      >
                        /creators
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Visitors cannot find you on{" "}
                      <Link
                        href="/creators"
                        className="font-bold underline decoration-amber-700/50 hover:decoration-amber-900"
                      >
                        /creators
                      </Link>{" "}
                      until you complete the steps below and set Profile Status
                      to <span className="font-bold">Published</span>.
                    </>
                  )}
                </p>
              </div>
              <Button
                variant="secondary"
                className="shrink-0 h-12 rounded-xl"
                href="/creator/settings"
              >
                Open settings
              </Button>
            </div>

            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                {
                  done: data.publishReadiness.hasCreatorName,
                  label: "Display name set",
                },
                {
                  done: data.publishReadiness.hasAvatar,
                  label: "Avatar uploaded",
                },
                {
                  done: data.publishReadiness.hasBio,
                  label: "Bio at least 30 characters",
                },
                {
                  done: data.publishReadiness.hasPublishedContent,
                  label: "At least one published content",
                },
                {
                  done: data.publishReadiness.hasActivePlan,
                  label: "At least one active plan",
                },
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-2">
                  {step.done ? (
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="w-4 h-4 text-amber-500 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={
                      step.done
                        ? "text-emerald-900 font-bold"
                        : "text-amber-900 font-medium"
                    }
                  >
                    {step.label}
                  </span>
                  <span className="sr-only">
                    {step.done ? " (done)" : " (pending)"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {errorMessage && (
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
        )}

        {/* ── Metrics Grid ── */}
        <MotionItem>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {metricCards.map((metric, i) => {
              const card = (
                <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group h-full">
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className={`w-12 h-12 rounded-2xl ${metric.bg} flex items-center justify-center shrink-0 shadow-sm group-hover:bg-white transition-colors`}
                    >
                      {metric.icon}
                    </div>
                    <Badge
                      variant="default"
                      className="bg-slate-50 text-slate-500 hover:bg-slate-100 font-black text-[9px] sm:text-[10px] uppercase tracking-widest border-transparent max-w-[7.5rem] sm:max-w-[9rem] truncate"
                    >
                      {metric.trend}
                    </Badge>
                  </div>
                  <h3 className="text-slate-600 font-black text-[10px] uppercase tracking-widest mb-2">
                    {metric.label}
                  </h3>
                  <p className="text-2xl sm:text-3xl font-black font-display text-slate-900 leading-none">
                    {isLoading ? "…" : metric.value}
                  </p>
                </div>
              );
              return "href" in metric && metric.href ? (
                <Link key={i} href={metric.href} className="block">
                  {card}
                </Link>
              ) : (
                <div key={i}>{card}</div>
              );
            })}
          </div>
        </MotionItem>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-10">

          {/* ── Main Content Area (Left) ── */}
          <div className="lg:col-span-2 space-y-12 min-w-0">

            {/* Quick Actions */}
            <MotionItem>
              <h2 className="text-xl font-black font-display text-slate-900 mb-6 tracking-tight">
                Quick Actions
              </h2>
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <Link
                  href="/creator/content/new"
                  className="bg-white rounded-[2rem] border border-slate-200 p-5 sm:p-8 flex items-center gap-4 sm:gap-6 hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <PlaySquare className="w-20 h-20 text-emerald-600 -rotate-12 translate-x-4 -translate-y-4" />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                    <PlaySquare className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 mb-1 uppercase tracking-tight text-sm">
                      Add Content
                    </h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Upload video or resource
                    </p>
                  </div>
                </Link>

                <Link
                  href="/creator/plans"
                  className="bg-white rounded-[2rem] border border-slate-200 p-5 sm:p-8 flex items-center gap-4 sm:gap-6 hover:border-sky-300 hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <CreditCard className="w-20 h-20 text-sky-600 -rotate-12 translate-x-4 -translate-y-4" />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                    <CreditCard className="w-7 h-7 text-sky-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 mb-1 uppercase tracking-tight text-sm">
                      Manage Plans
                    </h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Edit subscription tiers
                    </p>
                  </div>
                </Link>
              </div>
            </MotionItem>

            {/* Engagement Leaders */}
            <MotionItem>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-5 sm:p-8 lg:p-10 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 sm:mb-8">
                  <h2 className="text-xl font-black font-display text-slate-900 tracking-tight">
                    Engagement Leaders
                  </h2>
                  <Link
                    href="/creator/content"
                    className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] hover:opacity-70 transition-opacity"
                  >
                    Full Library &rarr;
                  </Link>
                </div>
                {isLoading ? (
                  <p className="text-sm font-bold text-slate-500">Loading top content…</p>
                ) : data && data.topContent.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-5 sm:p-8 text-center">
                    <p className="font-black text-slate-700 mb-2">No content yet</p>
                    <p className="text-sm font-medium text-slate-500 mb-4">
                      Publish your first video, article, or download to start tracking engagement.
                    </p>
                    <Button variant="primary" href="/creator/content/new">
                      Add your first piece
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data?.topContent.map((item) => (
                      <Link
                        key={item.id}
                        href={`/creator/content/${item.id}/edit`}
                        className="flex items-center justify-between gap-3 p-4 sm:p-6 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group min-w-0"
                      >
                        <div className="flex items-center gap-5 min-w-0">
                          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white shadow-sm shrink-0">
                            {contentIcon(item.contentType)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm mb-1 leading-snug truncate">
                              {item.title}
                            </h4>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                              {item.publishedAt
                                ? `Published ${formatRelative(item.publishedAt)}`
                                : "Draft"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="font-black text-slate-900 text-base">
                            {item.contentType === "file"
                              ? `${formatNumber(item.downloadsCount)} downloads`
                              : `${formatNumber(item.viewsCount)} views`}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </MotionItem>

          </div>

          {/* ── Sidebar Area (Right) ── */}
          <div className="lg:col-span-1 space-y-12">

            {/* Activity Feed */}
            <MotionItem>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-5 sm:p-8 lg:p-10 shadow-sm relative">
                <h2 className="text-xl font-black font-display text-slate-900 mb-8 tracking-tight">
                  Recent Activity
                </h2>
                {isLoading ? (
                  <p className="text-sm font-bold text-slate-500">Loading activity…</p>
                ) : data && data.recentActivity.length === 0 ? (
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    No activity yet. New subscriptions, payments, and cancellations will appear here.
                  </p>
                ) : (
                  <div className="space-y-8 relative">
                    <div className="absolute top-0 left-[1.125rem] bottom-0 w-px bg-slate-100" />
                    {data?.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex gap-4 sm:gap-6 relative min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white shrink-0 mt-1.5 z-10" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-snug mb-1.5 opacity-80 break-words">
                            {activity.text}
                          </p>
                          <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
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
    </CreatorShell>
  );
}
