"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Search,
  Filter,
  UserCheck,
  TrendingUp,
  UserMinus,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminSubscriberRow,
  AdminSubscribersResponse,
} from "@/types/admin-stats";

const PLAN_FILTERS: Array<{
  id: "all" | "Free" | "Basic" | "Premium";
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "Free", label: "Free" },
  { id: "Basic", label: "Basic" },
  { id: "Premium", label: "Premium" },
];

function statusLabel(status: AdminSubscriberRow["status"]) {
  if (status === "active" || status === "trialing") return "Active";
  if (status === "past_due") return "Past due";
  if (status === "canceled") return "Cancelled";
  if (status === "expired") return "Expired";
  return status;
}

function statusTone(status: AdminSubscriberRow["status"]) {
  if (status === "active" || status === "trialing") return "text-emerald-600";
  if (status === "past_due") return "text-red-600";
  return "text-amber-600";
}

export default function AdminSubscribersPage() {
  const [data, setData] = useState<AdminSubscribersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] =
    useState<(typeof PLAN_FILTERS)[number]["id"]>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/admin/subscribers", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load subscribers.");
        }
        const json = (await res.json()) as AdminSubscribersResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load subscribers."
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

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.subscribers.filter((row) => {
      const matchesQuery =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        row.creatorName.toLowerCase().includes(needle);
      const matchesPlan = planFilter === "all" || row.plan === planFilter;
      return matchesQuery && matchesPlan;
    });
  }, [data, query, planFilter]);

  const metrics = data?.metrics;
  const dist = data?.planDistribution;

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Growth Operations"
          title="Subscriber Management"
          subtitle="Review subscriber plans, renewal dates, payment status, content access, and engagement state."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<UserCheck className="w-4 h-4 ml-1" />}
              href="/api/admin/subscribers?format=csv"
              title="Download a CSV of all subscribers"
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Active Subscribers</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.activeSubscribers ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mb-5">
                <PieChart className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Premium Ratio</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : `${(metrics?.premiumRatioPercent ?? 0).toFixed(1)}%`}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-5">
                <TrendingUp className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">High Engagement</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.highEngagementCount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
                <UserMinus className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Churn Risk</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.churnRiskCount ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </MotionItem>

        <div className="grid lg:grid-cols-4 gap-10">
          <div className="lg:col-span-3 space-y-10">
            <MotionItem>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shadow-sm">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or creator…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm font-medium"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto ml-auto flex-wrap">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  {PLAN_FILTERS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setPlanFilter(option.id)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer",
                        planFilter === option.id
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </MotionItem>

            <MotionReveal>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                  <div className="p-12 text-sm font-bold text-slate-500">Loading subscribers…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                      <UserCheck className="w-7 h-7 text-slate-300" />
                    </div>
                    <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                      {data && data.subscribers.length > 0 ? "No matches" : "No subscribers yet"}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium max-w-md">
                      {data && data.subscribers.length > 0
                        ? "Try a different name or plan filter."
                        : "Once members subscribe, they'll appear here with their plan and renewal info."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="p-8">Subscriber</th>
                            <th className="p-8">Creator &amp; Plan</th>
                            <th className="p-8">Status &amp; Renewal</th>
                            <th className="p-8">Engagement</th>
                            <th className="p-8 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {filtered.map((row) => (
                            <tr key={row.subscriptionId} className="hover:bg-slate-50/30 transition-colors group">
                              <td className="p-8">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-500 font-black font-display overflow-hidden">
                                    {row.avatarUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={row.avatarUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      row.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 mb-1 leading-none">{row.name}</p>
                                    <span className="text-xs font-medium text-slate-400 opacity-80">
                                      {row.email || "no email"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-8">
                                <div className="flex flex-col gap-1.5 items-start">
                                  <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">
                                    {row.creatorName}
                                  </span>
                                  <Badge variant={row.plan === "Premium" ? "sky" : row.plan === "Basic" ? "emerald" : "default"}>
                                    {row.plan}
                                  </Badge>
                                </div>
                              </td>
                              <td className="p-8">
                                <div className="flex flex-col gap-1.5">
                                  <span className={cn("font-black text-[10px] uppercase tracking-wider", statusTone(row.status))}>
                                    {statusLabel(row.status)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold">{row.renewalLabel}</span>
                                </div>
                              </td>
                              <td className="p-8">
                                <span className={cn(
                                  "inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider",
                                  row.engagement === "High" ? "bg-emerald-50 text-emerald-700" :
                                  row.engagement === "Medium" ? "bg-amber-50 text-amber-700" :
                                  "bg-slate-100 text-slate-600"
                                )}>
                                  {row.engagement}
                                </span>
                              </td>
                              <td className="p-8 text-right">
                                <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Link href={`/admin/users/${encodeURIComponent(row.subscriberClerkUserId)}`}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-9 px-4 text-xs bg-white rounded-xl"
                                    >
                                      View
                                    </Button>
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden divide-y divide-slate-100">
                      {filtered.map((row) => (
                        <div key={row.subscriptionId} className="p-6 space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-500 font-black font-display overflow-hidden">
                                {row.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={row.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  row.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-none mb-1.5">{row.name}</p>
                                <Badge variant={row.plan === "Premium" ? "sky" : row.plan === "Basic" ? "emerald" : "default"} className="text-[10px] py-0.5">
                                  {row.plan} · {row.creatorName}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Status</p>
                              <p className={cn("text-xs font-black uppercase tracking-wider", statusTone(row.status))}>{statusLabel(row.status)}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1">{row.renewalLabel}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Engagement</p>
                              <span className={cn(
                                "inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mt-1",
                                row.engagement === "High" ? "bg-emerald-50 text-emerald-700" :
                                row.engagement === "Medium" ? "bg-amber-50 text-amber-700" :
                                "bg-slate-100 text-slate-600"
                              )}>
                                {row.engagement}
                              </span>
                            </div>
                          </div>
                          <Link href={`/admin/users/${encodeURIComponent(row.subscriberClerkUserId)}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-11 text-xs bg-white rounded-xl"
                            >
                              View account
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </MotionReveal>
          </div>

          <div className="lg:col-span-1 space-y-10">
            <MotionReveal className="sticky top-24">
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <h3 className="text-xl font-black font-display text-slate-900 mb-8">Plan Split</h3>
                {isLoading || !dist ? (
                  <p className="text-sm font-bold text-slate-500">Loading…</p>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400 flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Free
                        </span>
                        <span className="text-slate-900">{dist.freePercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-300 rounded-full" style={{ width: `${dist.freePercent}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400 flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Basic
                        </span>
                        <span className="text-slate-900">{dist.basicPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dist.basicPercent}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-3">
                        <span className="text-slate-400 flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Premium
                        </span>
                        <span className="text-slate-900">{dist.premiumPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${dist.premiumPercent}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </MotionReveal>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
