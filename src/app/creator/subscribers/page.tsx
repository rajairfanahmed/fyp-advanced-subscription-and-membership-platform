"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Search,
  Filter,
  Mail,
  Users,
  TrendingUp,
  UserCheck,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Calendar,
  CreditCard as CreditCardIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CreatorSubscriberRow,
  CreatorSubscribersResponse,
} from "@/types/creator-stats";

const STATUS_FILTERS: Array<{ id: "all" | "active" | "canceled" | "past_due"; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "canceled", label: "Canceled" },
  { id: "past_due", label: "Past due" },
];

function statusLabel(status: CreatorSubscriberRow["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

function statusTone(status: CreatorSubscriberRow["status"]) {
  if (status === "active" || status === "trialing") return "text-emerald-600";
  if (status === "past_due") return "text-red-600";
  return "text-amber-600";
}

export default function SubscribersPage() {
  const [data, setData] = useState<CreatorSubscribersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  function toggleRow(rowId: string) {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/creator/subscribers", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load subscribers.");
        }
        const json = (await res.json()) as CreatorSubscribersResponse;
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
        row.email.toLowerCase().includes(needle);
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

  const metricCards = [
    {
      icon: <Users className="w-6 h-6 text-teal-600" />,
      iconBg: "bg-teal-50",
      label: "Total Active",
      value: metrics ? metrics.totalSubscribers.toLocaleString() : "—",
    },
    {
      icon: <UserCheck className="w-6 h-6 text-emerald-600" />,
      iconBg: "bg-emerald-50",
      label: "Paid Members",
      value: metrics ? metrics.paidSubscribers.toLocaleString() : "—",
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-violet-600" />,
      iconBg: "bg-violet-50",
      label: "High Engagement",
      value: metrics ? `${metrics.highEngagementPercent.toFixed(1)}%` : "—",
    },
    {
      icon: <UserMinus className="w-6 h-6 text-red-600" />,
      iconBg: "bg-red-50",
      label: "Churn Risk",
      value: metrics ? metrics.churnRisk.toLocaleString() : "—",
    },
  ];

  return (
    <CreatorShell>
      <div className="space-y-12">

        <DashboardHeader
          eyebrow="Community Growth"
          title="Subscribers"
          subtitle="Review active subscribers, plan levels, renewal dates, and engagement status."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<Users className="w-4 h-4 ml-1" />}
              href="/api/creator/subscribers?format=csv"
              title="Download a CSV of your subscribers"
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
            {metricCards.map((card, i) => (
              <div
                key={i}
                className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm"
              >
                <div className={`w-12 h-12 rounded-2xl ${card.iconBg} flex items-center justify-center mb-5`}>
                  {card.icon}
                </div>
                <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">
                  {card.label}
                </h3>
                <p className="text-3xl font-black font-display text-slate-900">
                  {isLoading ? "…" : card.value}
                </p>
              </div>
            ))}
          </div>
        </MotionItem>

        {/* ── Filter Bar ── */}
        <MotionItem>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm font-medium"
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

        {/* ── Subscriber Table ── */}
        <MotionReveal>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-sm font-bold text-slate-500">Loading subscribers…</div>
            ) : filtered.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-slate-300" />
                </div>
                <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                  {data && data.subscribers.length > 0 ? "No matches" : "No subscribers yet"}
                </h3>
                <p className="text-sm text-slate-500 font-medium max-w-md">
                  {data && data.subscribers.length > 0
                    ? "Try a different name, email, or status filter."
                    : "Once members subscribe to your plans, they'll appear here with renewal dates and engagement signals."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-8">Subscriber</th>
                        <th className="p-8">Plan Level</th>
                        <th className="p-8">Status &amp; Renewal</th>
                        <th className="p-8">Engagement</th>
                        <th className="p-8 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filtered.map((row) => {
                        const isExpanded = expandedRowId === row.subscriptionId;
                        return (
                          <React.Fragment key={row.subscriptionId}>
                            <tr className="hover:bg-slate-50/30 transition-colors group">
                              <td className="p-8">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 text-teal-700 font-black font-display overflow-hidden">
                                    {row.avatarUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={row.avatarUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      row.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 mb-1 leading-none">
                                      {row.name}
                                    </p>
                                    <span className="text-xs font-medium text-slate-400 opacity-80">
                                      {row.email || "no email on file"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-8">
                                <Badge
                                  variant={
                                    row.plan === "Premium"
                                      ? "sky"
                                      : row.plan === "Basic"
                                        ? "emerald"
                                        : "default"
                                  }
                                >
                                  {row.plan}
                                </Badge>
                              </td>
                              <td className="p-8">
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={cn(
                                      "font-black text-xs uppercase tracking-wider",
                                      statusTone(row.status)
                                    )}
                                  >
                                    {statusLabel(row.status)}
                                  </span>
                                  <span className="text-xs text-slate-400 font-medium">
                                    {row.renewalLabel}
                                  </span>
                                </div>
                              </td>
                              <td className="p-8">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider",
                                    row.engagement === "High"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : row.engagement === "Medium"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-slate-100 text-slate-600"
                                  )}
                                >
                                  {row.engagement}
                                </span>
                              </td>
                              <td className="p-8 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleRow(row.subscriptionId)}
                                    className="inline-flex items-center gap-2 h-9 px-4 text-xs font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                                    aria-expanded={isExpanded}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="w-3.5 h-3.5" />
                                        Hide
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3.5 h-3.5" />
                                        View
                                      </>
                                    )}
                                  </button>
                                  {row.email && (
                                    <a
                                      href={`mailto:${row.email}`}
                                      className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                                      title={`Email ${row.name}`}
                                    >
                                      <Mail className="w-4 h-4" />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50/40 border-b border-slate-100">
                                <td colSpan={5} className="px-8 py-6">
                                  <div className="grid sm:grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Email
                                      </p>
                                      <p className="text-sm font-bold text-slate-700 break-all">
                                        {row.email || "—"}
                                      </p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <CreditCardIcon className="w-3 h-3" />
                                        Plan
                                      </p>
                                      <p className="text-sm font-bold text-slate-700">
                                        {row.plan}
                                      </p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" />
                                        Renewal
                                      </p>
                                      <p className="text-sm font-bold text-slate-700">
                                        {row.renewalLabel}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filtered.map((row) => (
                    <div key={row.subscriptionId} className="p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 text-teal-700 font-black font-display overflow-hidden">
                            {row.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.avatarUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              row.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-none mb-1.5">
                              {row.name}
                            </p>
                            <Badge
                              variant={
                                row.plan === "Premium"
                                  ? "sky"
                                  : row.plan === "Basic"
                                    ? "emerald"
                                    : "default"
                              }
                              className="text-[10px] py-0.5"
                            >
                              {row.plan}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">
                            Status &amp; Renewal
                          </p>
                          <p
                            className={cn(
                              "text-xs font-black uppercase tracking-wider",
                              statusTone(row.status)
                            )}
                          >
                            {statusLabel(row.status)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">
                            {row.renewalLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">
                            Engagement
                          </p>
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                              row.engagement === "High"
                                ? "bg-emerald-50 text-emerald-700"
                                : row.engagement === "Medium"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {row.engagement}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => toggleRow(row.subscriptionId)}
                          className="flex-1 h-11 text-xs font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                        >
                          {expandedRowId === row.subscriptionId ? "Hide" : "View"}
                        </button>
                        {row.email && (
                          <a
                            href={`mailto:${row.email}`}
                            className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                          >
                            <Mail className="w-4 h-4" />
                            Email
                          </a>
                        )}
                      </div>
                      {expandedRowId === row.subscriptionId && (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Email
                            </p>
                            <p className="text-xs font-bold text-slate-700 break-all">
                              {row.email || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Renewal
                            </p>
                            <p className="text-xs font-bold text-slate-700">
                              {row.renewalLabel}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </MotionReveal>
      </div>
    </CreatorShell>
  );
}
