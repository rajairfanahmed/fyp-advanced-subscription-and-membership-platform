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
  UserCheck,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Calendar,
  CreditCard as CreditCardIcon,
  Download,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CreatorMembershipLifecycle,
  CreatorSubscriberRow,
  CreatorSubscribersResponse,
} from "@/types/creator-stats";

type StatusFilter =
  | "all"
  | "active"
  | "free"
  | "basic"
  | "premium"
  | "cancel_scheduled"
  | "past_due"
  | "trialing"
  | "expired"
  | "canceled";

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "free", label: "Free" },
  { id: "basic", label: "Basic" },
  { id: "premium", label: "Premium" },
  { id: "cancel_scheduled", label: "Ending" },
  { id: "past_due", label: "Past due" },
  { id: "expired", label: "Expired" },
  { id: "canceled", label: "Canceled" },
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

function lifecycleLabel(lifecycle: CreatorMembershipLifecycle) {
  switch (lifecycle) {
    case "following":
      return "Following";
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "cancel_scheduled":
      return "Ends this period";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return lifecycle;
  }
}

function lifecycleTone(lifecycle: CreatorMembershipLifecycle) {
  if (lifecycle === "active" || lifecycle === "following" || lifecycle === "trialing") {
    return "text-emerald-600";
  }
  if (lifecycle === "past_due") return "text-red-600";
  if (lifecycle === "cancel_scheduled") return "text-amber-700";
  return "text-slate-500";
}

function formatPrice(amount: number, accessLevel: CreatorSubscriberRow["accessLevel"]) {
  if (accessLevel === "free" || !amount) return "Free";
  const rounded = Number(amount);
  if (!Number.isFinite(rounded)) return "$0";
  return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}/mo`;
}

function matchesFilter(row: CreatorSubscriberRow, statusFilter: StatusFilter) {
  if (statusFilter === "all") return true;
  if (statusFilter === "active") {
    return row.status === "active" || row.status === "trialing" || row.status === "past_due";
  }
  if (statusFilter === "free" || statusFilter === "basic" || statusFilter === "premium") {
    return (
      row.accessLevel === statusFilter &&
      (row.status === "active" || row.status === "trialing" || row.status === "past_due")
    );
  }
  if (statusFilter === "cancel_scheduled") return row.lifecycle === "cancel_scheduled";
  return row.status === statusFilter;
}

export default function SubscribersPage() {
  const [data, setData] = useState<CreatorSubscribersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function toggleRow(rowId: string) {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  }

  async function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/creator/subscribers", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to load subscribers.");
      }
      const json = (await res.json()) as CreatorSubscribersResponse;
      setData(json);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load subscribers.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get("filter");
    if (filter && STATUS_FILTERS.some((option) => option.id === filter)) {
      setStatusFilter(filter as StatusFilter);
    }
    void load();
  }, []);

  async function runAction(
    row: CreatorSubscriberRow,
    action: "schedule_cancel" | "keep_membership" | "remove_follower"
  ) {
    const confirmText =
      action === "schedule_cancel"
        ? `Schedule cancellation for ${row.name}? They keep ${row.plan} access until ${row.renewalLabel.replace(/^Ends\s+/i, "") || "the end of this billing period"}.`
        : action === "keep_membership"
          ? `Keep ${row.name}'s membership and resume billing?`
          : `Remove ${row.name} from your free followers now? They can subscribe again later.`;
    if (typeof window !== "undefined" && !window.confirm(confirmText)) return;

    setBusyId(row.subscriptionId);
    setErrorMessage("");
    setActionMessage("");
    try {
      const res = await fetch(`/api/creator/subscribers/${row.subscriptionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not update this membership.");
      setActionMessage(
        action === "schedule_cancel"
          ? `${row.name} will keep access until the period ends.`
          : action === "keep_membership"
            ? `${row.name}'s membership will continue.`
            : `${row.name} was removed from free followers.`
      );
      await load({ silent: true });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not update this membership.");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.subscribers.filter((row) => {
      const matchesQuery =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle);
      return matchesQuery && matchesFilter(row, statusFilter);
    });
  }, [data, query, statusFilter]);

  const metrics = data?.metrics;

  const metricCards = [
    {
      icon: <Users className="w-6 h-6 text-teal-600" />,
      iconBg: "bg-teal-50",
      label: "Active members",
      value: metrics ? metrics.totalSubscribers.toLocaleString() : "—",
      hint: metrics
        ? `${metrics.freeSubscribers} free · ${metrics.basicSubscribers} basic · ${metrics.premiumSubscribers} premium`
        : "",
    },
    {
      icon: <UserCheck className="w-6 h-6 text-emerald-600" />,
      iconBg: "bg-emerald-50",
      label: "Paid members",
      value: metrics ? metrics.paidSubscribers.toLocaleString() : "—",
      hint: "Basic + Premium",
    },
    {
      icon: <Clock className="w-6 h-6 text-amber-600" />,
      iconBg: "bg-amber-50",
      label: "Ending this period",
      value: metrics ? metrics.scheduledCancellations.toLocaleString() : "—",
      hint: "Cancel at period end",
    },
    {
      icon: <UserMinus className="w-6 h-6 text-red-600" />,
      iconBg: "bg-red-50",
      label: "Needs attention",
      value: metrics ? metrics.churnRisk.toLocaleString() : "—",
      hint: "Past due + scheduled cancel",
    },
  ];

  function memberActions(row: CreatorSubscriberRow) {
    return (
      <div className="flex flex-wrap gap-2">
        {row.canScheduleCancel && (
          <Button
            type="button"
            variant="outline"
            className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50 h-9"
            disabled={busyId === row.subscriptionId}
            onClick={() => void runAction(row, "schedule_cancel")}
          >
            {busyId === row.subscriptionId ? "Working…" : "Cancel at period end"}
          </Button>
        )}
        {row.canKeepMembership && (
          <Button
            type="button"
            variant="primary"
            className="text-xs h-9"
            disabled={busyId === row.subscriptionId}
            onClick={() => void runAction(row, "keep_membership")}
          >
            {busyId === row.subscriptionId ? "Working…" : "Keep membership"}
          </Button>
        )}
        {row.canRemoveFollower && (
          <Button
            type="button"
            variant="outline"
            className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50 h-9"
            disabled={busyId === row.subscriptionId}
            onClick={() => void runAction(row, "remove_follower")}
          >
            {busyId === row.subscriptionId ? "Working…" : "Remove follower"}
          </Button>
        )}
      </div>
    );
  }

  function detailGrid(row: CreatorSubscriberRow) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <CreditCardIcon className="w-3 h-3" />
            Price
          </p>
          <p className="text-sm font-bold text-slate-700">
            {formatPrice(row.priceMonthly, row.accessLevel)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Time left
          </p>
          <p className="text-sm font-bold text-slate-700">
            {row.daysRemainingLabel || row.renewalLabel || "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Download className="w-3 h-3" />
            Downloads this window
          </p>
          <p className="text-sm font-bold text-slate-700">{row.quotaLabel}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Email
          </p>
          <p className="text-sm font-bold text-slate-700 break-all">{row.email || "—"}</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">{memberActions(row)}</div>
      </div>
    );
  }

  return (
    <CreatorShell>
      <div className="space-y-12 min-w-0">
        <DashboardHeader
          eyebrow="Community Growth"
          title="Subscribers"
          subtitle="See each member’s plan, days remaining, download quota, and cancellation state."
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
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700" role="alert">
            {errorMessage}
          </div>
        )}
        {actionMessage && !errorMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-sm font-bold text-emerald-700" role="status">
            {actionMessage}
          </div>
        )}

        <MotionItem>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {metricCards.map((card, i) => (
              <div
                key={i}
                className="bg-white rounded-[2rem] border border-slate-200 p-5 sm:p-6 shadow-sm min-w-0"
              >
                <div className={`w-12 h-12 rounded-2xl ${card.iconBg} flex items-center justify-center mb-5`}>
                  {card.icon}
                </div>
                <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">
                  {card.label}
                </h3>
                <p className="text-2xl sm:text-3xl font-black font-display text-slate-900">
                  {isLoading ? "…" : card.value}
                </p>
                {card.hint ? (
                  <p className="text-[11px] font-medium text-slate-500 mt-2">{card.hint}</p>
                ) : null}
              </div>
            ))}
          </div>
        </MotionItem>

        <MotionItem>
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-col gap-4 shadow-sm">
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
            <div className="flex items-center gap-2 w-full min-w-0 overflow-x-auto hide-scrollbar pb-1">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              {STATUS_FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStatusFilter(option.id)}
                  className={cn(
                    "px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap shrink-0",
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
              <div className="p-5 sm:p-8 lg:p-12 text-sm font-bold text-slate-500">Loading subscribers…</div>
            ) : filtered.length === 0 ? (
              <div className="p-5 sm:p-10 lg:p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-slate-300" />
                </div>
                <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                  {data && data.subscribers.length > 0 ? "No matches" : "No subscribers yet"}
                </h3>
                <p className="text-sm text-slate-500 font-medium max-w-md">
                  {data && data.subscribers.length > 0
                    ? "Try a different name, email, or status filter."
                    : "Once members subscribe, they appear here with days remaining and download quota."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto min-w-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-4 lg:p-8">Subscriber</th>
                        <th className="p-4 lg:p-8">Plan</th>
                        <th className="p-4 lg:p-8">Membership</th>
                        <th className="p-4 lg:p-8">Quota</th>
                        <th className="p-4 lg:p-8 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filtered.map((row) => {
                        const isExpanded = expandedRowId === row.subscriptionId;
                        return (
                          <React.Fragment key={row.subscriptionId}>
                            <tr className="hover:bg-slate-50/30 transition-colors group">
                              <td className="p-4 lg:p-8">
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
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 mb-1 leading-none truncate">
                                      {row.name}
                                    </p>
                                    <span className="text-xs font-medium text-slate-400 opacity-80 break-all">
                                      {row.email || "no email on file"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 lg:p-8">
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
                                <p className="text-[11px] font-medium text-slate-500 mt-1.5">
                                  {formatPrice(row.priceMonthly, row.accessLevel)}
                                </p>
                              </td>
                              <td className="p-4 lg:p-8">
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={cn(
                                      "font-black text-xs uppercase tracking-wider",
                                      lifecycleTone(row.lifecycle)
                                    )}
                                  >
                                    {lifecycleLabel(row.lifecycle)}
                                  </span>
                                  <span className="text-xs text-slate-400 font-medium">
                                    {row.daysRemainingLabel || row.renewalLabel}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 lg:p-8">
                                <span className="text-sm font-black text-slate-800">
                                  {row.quotaLabel}
                                </span>
                                <p className="text-[11px] font-medium text-slate-500 mt-1">
                                  30-day window
                                </p>
                              </td>
                              <td className="p-4 lg:p-8 text-right">
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
                                <td colSpan={5} className="px-4 lg:px-8 py-5 lg:py-6">
                                  {detailGrid(row)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                  {filtered.map((row) => (
                    <div key={row.subscriptionId} className="p-5 space-y-5">
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center gap-4 min-w-0">
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
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 leading-none mb-1.5 truncate">
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
                            Membership
                          </p>
                          <p
                            className={cn(
                              "text-xs font-black uppercase tracking-wider",
                              lifecycleTone(row.lifecycle)
                            )}
                          >
                            {lifecycleLabel(row.lifecycle)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">
                            {row.daysRemainingLabel || row.renewalLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">
                            Quota
                          </p>
                          <p className="text-sm font-black text-slate-800">{row.quotaLabel}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">
                            {statusLabel(row.status)}
                          </p>
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
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                          {detailGrid(row)}
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
