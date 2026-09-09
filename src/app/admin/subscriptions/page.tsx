"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Search,
  Filter,
  Repeat,
  AlertCircle,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminSubscriptionRow,
  AdminSubscriptionsResponse,
} from "@/types/admin-stats";

const STATUS_FILTERS: Array<{
  id: "all" | "active" | "canceled" | "past_due";
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "canceled", label: "Cancelled" },
  { id: "past_due", label: "Past due" },
];

function statusLabel(status: AdminSubscriptionRow["status"]) {
  if (status === "active" || status === "trialing") return "Active";
  if (status === "past_due") return "Past Due";
  if (status === "canceled") return "Cancelled";
  if (status === "expired") return "Expired";
  return status;
}

function statusBadgeClass(status: AdminSubscriptionRow["status"]) {
  if (status === "active" || status === "trialing")
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "past_due") return "bg-red-50 text-red-700 border-red-100";
  return "bg-amber-50 text-amber-700 border-amber-100";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState<AdminSubscriptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/subscriptions", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to load subscriptions.");
      }
      const json = (await res.json()) as AdminSubscriptionsResponse;
      setData(json);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load subscriptions."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(
    id: string,
    payload: Record<string, unknown>,
    successMessage: string
  ) {
    if (actionPending) return;
    setActionPending(id);
    setActionError("");
    setFeedback("");
    try {
      const res = await fetch(
        `/api/admin/subscriptions/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Action failed.");
      }
      setFeedback(successMessage);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionPending(null);
    }
  }

  function handleCancel(id: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Cancel this subscription on behalf of the subscriber? This is permanent."
      )
    ) {
      return;
    }
    runAction(id, { action: "cancel" }, "Subscription cancelled.");
  }

  function handleExtend(id: string, days: number) {
    runAction(
      id,
      { action: "extend", extendDays: days },
      `Subscription extended by ${days} days.`
    );
  }

  function handleReactivate(id: string) {
    runAction(id, { action: "reactivate" }, "Subscription reactivated.");
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.subscriptions.filter((row) => {
      const matchesQuery =
        !needle ||
        row.subscriberName.toLowerCase().includes(needle) ||
        row.subscriberEmail.toLowerCase().includes(needle) ||
        row.creatorName.toLowerCase().includes(needle) ||
        row.id.toLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          (row.status === "active" || row.status === "trialing")) ||
        (statusFilter === "canceled" && row.status === "canceled") ||
        (statusFilter === "past_due" && row.status === "past_due");
      return matchesQuery && matchesStatus;
    });
  }, [data, query, statusFilter]);

  const metrics = data?.metrics;
  const breakdown = data?.statusBreakdown;

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Recurring Revenue"
          title="Subscription Lifecycle"
          subtitle="Monitor active, cancelled, expired, pending, and failed subscriptions across the platform."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<Repeat className="w-4 h-4 ml-1" />}
              href="/api/admin/subscriptions?format=csv"
              title="Download a CSV of all subscriptions"
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
        {actionError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
            {actionError}
          </div>
        )}
        {feedback && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-sm font-bold text-emerald-700">
            {feedback}
          </div>
        )}

        <MotionItem>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Active Subs</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.activeSubscriptions ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-5">
                <Repeat className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Renewals Today</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.renewalsToday ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Failed Charges</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.failedCharges ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
                <TrendingDown className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Cancelled</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.pendingChurn ?? 0).toLocaleString()}
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
                    placeholder="Search by subscriber, creator, or ID…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm font-medium"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto ml-auto flex-wrap">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  {STATUS_FILTERS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setStatusFilter(option.id)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer",
                        statusFilter === option.id
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
                  <div className="p-12 text-sm font-bold text-slate-500">Loading subscriptions…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                      <Repeat className="w-7 h-7 text-slate-300" />
                    </div>
                    <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                      {data && data.subscriptions.length > 0 ? "No matches" : "No subscriptions yet"}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium max-w-md">
                      {data && data.subscriptions.length > 0
                        ? "Try a different search or status filter."
                        : "Once members subscribe to creators, lifecycle data will land here."}
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
                            <th className="p-8">Status</th>
                            <th className="p-8">Lifecycle</th>
                            <th className="p-8 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {filtered.map((sub) => {
                            const isActive =
                              sub.status === "active" || sub.status === "trialing";
                            const isCancelled =
                              sub.status === "canceled" || sub.status === "expired";
                            return (
                              <tr key={sub.id} className="hover:bg-slate-50/30 transition-colors group">
                                <td className="p-8">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400 font-black font-display shadow-sm">
                                      {sub.subscriberName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 leading-none mb-1">{sub.subscriberName}</p>
                                      <span className="text-[10px] font-medium text-slate-400 opacity-80">{sub.subscriberEmail || "no email"}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-8">
                                  <div className="flex flex-col gap-1.5 items-start">
                                    <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">
                                      {sub.creatorName}
                                    </span>
                                    <Badge variant={sub.plan === "Premium" ? "sky" : sub.plan === "Basic" ? "emerald" : "default"}>
                                      {sub.plan}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="p-8">
                                  <Badge variant="default" className={statusBadgeClass(sub.status)}>
                                    {statusLabel(sub.status)}
                                  </Badge>
                                </td>
                                <td className="p-8">
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 opacity-80 uppercase tracking-wider leading-none">
                                      Started: {formatDate(sub.startedAt)}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                                      {sub.renewalLabel}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-8">
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isActive && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 px-3 text-xs bg-white rounded-xl"
                                          onClick={() => handleExtend(sub.id, 7)}
                                          disabled={actionPending === sub.id}
                                        >
                                          +7d
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 px-3 text-xs bg-white rounded-xl"
                                          onClick={() => handleExtend(sub.id, 30)}
                                          disabled={actionPending === sub.id}
                                        >
                                          +30d
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 px-3 text-xs bg-white rounded-xl border-rose-200 text-rose-700 hover:border-rose-300"
                                          onClick={() => handleCancel(sub.id)}
                                          disabled={actionPending === sub.id}
                                        >
                                          {actionPending === sub.id ? "…" : "Cancel"}
                                        </Button>
                                      </>
                                    )}
                                    {isCancelled && sub.accessLevel === "free" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 px-3 text-xs bg-white rounded-xl border-emerald-200 text-emerald-700 hover:border-emerald-300"
                                        onClick={() => handleReactivate(sub.id)}
                                        disabled={actionPending === sub.id}
                                      >
                                        {actionPending === sub.id ? "…" : "Reactivate"}
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden divide-y divide-slate-100">
                      {filtered.map((sub) => (
                        <div key={sub.id} className="p-6 space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400 font-black font-display shadow-sm">
                                {sub.subscriberName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-none mb-1.5">{sub.subscriberName}</p>
                                <Badge variant={sub.plan === "Premium" ? "sky" : sub.plan === "Basic" ? "emerald" : "default"} className="text-[10px] py-0.5">
                                  {sub.plan} · {sub.creatorName}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Status</p>
                              <Badge variant="default" className={cn("text-[10px] py-0.5", statusBadgeClass(sub.status))}>
                                {statusLabel(sub.status)}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Renewal</p>
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider leading-none">{sub.renewalLabel}</span>
                            </div>
                          </div>
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
                <h3 className="text-xl font-black font-display text-slate-900 mb-8">Platform Health</h3>
                {isLoading || !breakdown ? (
                  <p className="text-sm font-bold text-slate-500">Loading…</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50/50 border border-slate-50">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Active
                      </span>
                      <span className="text-sm font-black text-slate-900">{breakdown.active.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50/50 border border-slate-50">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Cancelled
                      </span>
                      <span className="text-sm font-black text-slate-900">{breakdown.cancelled.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50/50 border border-slate-50">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Past Due
                      </span>
                      <span className="text-sm font-black text-slate-900">{breakdown.pastDue.toLocaleString()}</span>
                    </div>
                  </div>
                )}
                <div className="pt-8 mt-8 border-t border-slate-50">
                  <Button
                    variant="outline"
                    className="w-full h-14 bg-white text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 border-red-100 rounded-2xl transition-all"
                    href="/admin/payments"
                  >
                    Open failed charges
                  </Button>
                </div>
              </div>
            </MotionReveal>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
