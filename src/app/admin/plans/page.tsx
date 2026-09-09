"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Badge } from "@/components/ui/Badge";
import {
  CreditCard,
  CheckCircle2,
  ShieldAlert,
  Globe,
  Lock,
  Zap,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  AdminPlanGroup,
  AdminPlansResponse,
} from "@/types/admin-stats";

const PLAN_FILTERS: Array<{
  id: "all" | "free" | "basic" | "premium";
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  { id: "basic", label: "Basic" },
  { id: "premium", label: "Premium" },
];

function formatCurrencyCents(cents: number) {
  const amount = cents / 100;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function groupIcon(label: AdminPlanGroup["label"]) {
  if (label === "Free") return <Globe className="w-6 h-6 text-slate-500" />;
  if (label === "Basic") return <Lock className="w-6 h-6 text-emerald-500" />;
  return <Zap className="w-6 h-6 text-sky-500" />;
}

function groupAccent(label: AdminPlanGroup["label"]) {
  if (label === "Premium") return "bg-gradient-to-r from-sky-400 to-violet-400";
  if (label === "Basic") return "bg-violet-400";
  return "";
}

export default function AdminPlansPage() {
  const [data, setData] = useState<AdminPlansResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [planFilter, setPlanFilter] =
    useState<(typeof PLAN_FILTERS)[number]["id"]>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/admin/plans", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load plans.");
        }
        const json = (await res.json()) as AdminPlansResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load plans."
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

  const filteredPlans = useMemo(() => {
    if (!data) return [];
    return planFilter === "all"
      ? data.plans
      : data.plans.filter((p) => p.accessLevel === planFilter);
  }, [data, planFilter]);

  const metrics = data?.metrics;

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Revenue Architecture"
          title="Plan Catalog"
          subtitle="Read-only view of every creator's plans, grouped by access tier. Plans are managed by each creator from their own studio."
        />

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* Metric Cards */}
        <MotionItem>
          <div className="grid sm:grid-cols-3 gap-6 md:gap-10">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100">
                  <CreditCard className="w-6 h-6 text-violet-600" />
                </div>
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Total Active Plans</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.totalActivePlans ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Most Popular Tier</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : metrics?.mostPopularLabel ?? "—"}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center shrink-0 border border-sky-100">
                  <TrendingUp className="w-6 h-6 text-sky-600" />
                </div>
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Top Conversion</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : metrics?.topConversionLabel ?? "—"}
              </p>
            </div>
          </div>
        </MotionItem>

        {/* Tier groups */}
        <MotionReveal className="grid lg:grid-cols-3 gap-6 md:gap-10">
          {(data?.groups ?? []).map((group) => (
            <div
              key={group.accessLevel}
              className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative"
            >
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${groupAccent(group.label)}`} />
              <div className="p-10 pb-8 border-b border-slate-50 relative">
                <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
                    {groupIcon(group.label)}
                  </div>
                  <Badge
                    variant="default"
                    className="bg-slate-50 text-slate-600 border-slate-100 uppercase tracking-widest text-[9px]"
                  >
                    {group.activePlanCount} active
                  </Badge>
                </div>
                <h2 className="text-2xl font-black font-display text-slate-900 mb-2">{group.label}</h2>
                <p className="text-sm text-slate-400 font-medium leading-relaxed">
                  {group.planCount} plan{group.planCount === 1 ? "" : "s"} across creators · top: {group.topCreatorName}
                </p>
                <div className="mt-8 flex items-baseline gap-2">
                  <span className="text-4xl font-black font-display text-slate-900">
                    ${group.averagePrice.toFixed(group.averagePrice % 1 === 0 ? 0 : 2)}
                  </span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">avg / month</span>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-black text-slate-900">{group.totalSubscribers.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active subs</span>
                </div>
              </div>
              <div className="p-10 pt-8 flex-1 flex flex-col bg-slate-50/30">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 block">Tier MRR</h3>
                <p className="text-2xl font-black font-display text-slate-900 mb-6">
                  {formatCurrencyCents(group.totalMrrCents)}
                </p>
                <ul className="space-y-3 mt-auto">
                  <li className="flex items-start gap-3 text-[12px] font-bold text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    Aggregated across {group.activePlanCount} active creator plan{group.activePlanCount === 1 ? "" : "s"}
                  </li>
                  <li className="flex items-start gap-3 text-[12px] font-bold text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    Real-time subscriber attribution
                  </li>
                </ul>
              </div>
            </div>
          ))}
          {!isLoading && (!data || data.groups.length === 0) && (
            <p className="col-span-full text-sm font-bold text-slate-500">No plan data available.</p>
          )}
        </MotionReveal>

        {/* Plan listing */}
        <MotionReveal>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 border-b border-slate-50 pb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  <CreditCard className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black font-display text-slate-900">Plan Listing</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest opacity-80">
                    Read-only · creator-owned
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {PLAN_FILTERS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setPlanFilter(option.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer ${
                      planFilter === option.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <p className="text-sm font-bold text-slate-500">Loading plans…</p>
            ) : filteredPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                <p className="font-black text-slate-700 mb-2">No plans here yet</p>
                <p className="text-sm font-medium text-slate-500">
                  Plans are created by creators from their /creator/plans dashboard.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="p-6">Creator</th>
                      <th className="p-6">Plan Name</th>
                      <th className="p-6">Tier</th>
                      <th className="p-6">Price / mo</th>
                      <th className="p-6">Active subs</th>
                      <th className="p-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredPlans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="p-6">
                          {plan.creatorSlug ? (
                            <Link
                              href={`/creators/${plan.creatorSlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-slate-900 hover:text-violet-600"
                            >
                              {plan.creatorName}
                            </Link>
                          ) : (
                            <span className="font-bold text-slate-900">{plan.creatorName}</span>
                          )}
                        </td>
                        <td className="p-6 text-slate-700 font-medium">{plan.name}</td>
                        <td className="p-6">
                          <Badge
                            variant={
                              plan.accessLevel === "premium"
                                ? "sky"
                                : plan.accessLevel === "basic"
                                  ? "emerald"
                                  : "default"
                            }
                          >
                            {plan.accessLevel === "free"
                              ? "Free"
                              : plan.accessLevel === "basic"
                                ? "Basic"
                                : "Premium"}
                          </Badge>
                        </td>
                        <td className="p-6 font-black text-slate-900">${plan.priceMonthly.toFixed(2)}</td>
                        <td className="p-6 font-bold text-slate-700">{plan.subscribersCount.toLocaleString()}</td>
                        <td className="p-6 text-right">
                          <Badge
                            variant="default"
                            className={
                              plan.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }
                          >
                            {plan.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-8 bg-amber-50/50 rounded-[2rem] border border-amber-100 p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-black text-amber-900 uppercase tracking-wider text-sm mb-2">Plan editing is creator-owned</h3>
                <p className="text-[13px] font-medium text-amber-800 leading-relaxed opacity-90">
                  Plans live under each creator and can only be edited by that creator from <code className="px-1.5 py-0.5 rounded bg-amber-100/60">/creator/plans</code>.
                  This page is a read-only catalog of every plan on the platform.
                </p>
              </div>
            </div>
          </div>
        </MotionReveal>

      </div>
    </AdminShell>
  );
}
