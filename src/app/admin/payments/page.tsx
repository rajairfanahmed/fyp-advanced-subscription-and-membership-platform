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
  Receipt,
  DollarSign,
  AlertCircle,
  RefreshCcw,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminPaymentRow,
  AdminPaymentsResponse,
} from "@/types/admin-stats";

const STATUS_FILTERS: Array<{
  id: "all" | "succeeded" | "pending" | "failed" | "refunded";
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "succeeded", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "refunded", label: "Refunded" },
];

const TIER_FILTERS: Array<{
  id: "all" | "basic" | "premium" | "free";
  label: string;
}> = [
  { id: "all", label: "All tiers" },
  { id: "basic", label: "Basic" },
  { id: "premium", label: "Premium" },
  { id: "free", label: "Free" },
];

function statusLabel(status: AdminPaymentRow["status"]) {
  if (status === "succeeded") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "pending") return "Pending";
  return "Refunded";
}

function statusBadge(status: AdminPaymentRow["status"]) {
  if (status === "succeeded")
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-100";
  if (status === "pending") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function formatAmount(cents: number, currency: string) {
  const amount = cents / 100;
  const symbol = currency === "eur" ? "€" : currency === "gbp" ? "£" : "$";
  return `${symbol}${amount.toFixed(2)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<AdminPaymentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [tierFilter, setTierFilter] =
    useState<(typeof TIER_FILTERS)[number]["id"]>("all");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/payments", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to load payments.");
      }
      const json = (await res.json()) as AdminPaymentsResponse;
      setData(json);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load payments."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePaymentAction(
    paymentId: string,
    kind: "refund" | "retry"
  ) {
    if (actionPending) return;
    if (
      kind === "refund" &&
      typeof window !== "undefined" &&
      !window.confirm("Issue a Stripe refund for this charge?")
    ) {
      return;
    }
    setActionPending(paymentId);
    setActionError("");
    setFeedback("");
    try {
      const res = await fetch(
        `/api/admin/payments/${encodeURIComponent(paymentId)}/${kind}`,
        { method: "POST" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "Action failed.");
      }
      setFeedback(
        body.message || (kind === "refund" ? "Refund issued." : "Retry queued.")
      );
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionPending(null);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.payments.filter((row) => {
      const matchesQuery =
        !needle ||
        row.subscriberName.toLowerCase().includes(needle) ||
        row.subscriberEmail.toLowerCase().includes(needle) ||
        row.creatorName.toLowerCase().includes(needle) ||
        row.id.toLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      const matchesTier =
        tierFilter === "all" || row.accessLevel === tierFilter;
      return matchesQuery && matchesStatus && matchesTier;
    });
  }, [data, query, statusFilter, tierFilter]);

  const metrics = data?.metrics;
  const failed = data?.failed;

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Cash Flow"
          title="Payment Operations"
          subtitle="Track successful payments, failed charges, pending transactions, refunds, and global billing status."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<Receipt className="w-4 h-4 ml-1" />}
              href="/api/admin/payments?format=csv"
              title="Download a CSV of all payments"
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
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">30d Volume</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading
                  ? "…"
                  : formatAmount(metrics?.volume30dCents ?? 0, "usd")}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-5">
                <Receipt className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Success Rate</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading
                  ? "…"
                  : `${(metrics?.successRatePercent ?? 100).toFixed(1)}%`}
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
                <RefreshCcw className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Refunds</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.refunds ?? 0).toLocaleString()}
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
                    placeholder="Search by subscriber, creator, or invoice…"
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
                  {TIER_FILTERS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTierFilter(option.id)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer",
                        tierFilter === option.id
                          ? "bg-violet-600 text-white"
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
                  <div className="p-12 text-sm font-bold text-slate-500">Loading payments…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                      <Receipt className="w-7 h-7 text-slate-300" />
                    </div>
                    <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                      {data && data.payments.length > 0 ? "No matches" : "No payments yet"}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium max-w-md">
                      {data && data.payments.length > 0
                        ? "Try a different search or status filter."
                        : "Once Stripe is wired in and webhooks land, charges will appear here."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="p-8">Subscriber</th>
                            <th className="p-8">Creator &amp; Amount</th>
                            <th className="p-8">Status &amp; Method</th>
                            <th className="p-8">Date</th>
                            <th className="p-8 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {filtered.map((payment) => (
                            <tr key={payment.id} className="hover:bg-slate-50/30 transition-colors group">
                              <td className="p-8">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400 font-black font-display shadow-sm">
                                    {payment.subscriberName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 leading-none">{payment.subscriberName}</p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-1">{payment.subscriberEmail || "no email"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-8">
                                <div className="flex flex-col gap-1.5 items-start">
                                  <span className="font-black text-slate-900">{formatAmount(payment.amountCents, payment.currency)}</span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {payment.creatorName}
                                    {payment.accessLevel ? ` · ${payment.accessLevel}` : ""}
                                  </span>
                                </div>
                              </td>
                              <td className="p-8">
                                <div className="flex flex-col gap-2 items-start">
                                  <Badge variant="default" className={statusBadge(payment.status)}>
                                    {statusLabel(payment.status)}
                                  </Badge>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider opacity-70">
                                    {payment.paymentMethodLabel}
                                  </span>
                                </div>
                              </td>
                              <td className="p-8">
                                <span className="text-slate-400 font-bold text-xs">
                                  {formatDate(payment.paidAt ?? payment.createdAt)}
                                </span>
                              </td>
                              <td className="p-8 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {payment.receiptUrl ? (
                                    <a
                                      href={payment.receiptUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="h-9 px-3 text-xs inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:border-slate-300"
                                    >
                                      Receipt
                                    </a>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-9 px-3 text-xs bg-white rounded-xl"
                                      disabled
                                      title="No Stripe receipt available for this charge"
                                    >
                                      Receipt
                                    </Button>
                                  )}
                                  {payment.status === "succeeded" &&
                                    payment.hasStripeReference && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 px-3 text-xs bg-white rounded-xl border-rose-200 text-rose-700 hover:border-rose-300"
                                        onClick={() =>
                                          handlePaymentAction(payment.id, "refund")
                                        }
                                        disabled={actionPending === payment.id}
                                      >
                                        {actionPending === payment.id ? "…" : "Refund"}
                                      </Button>
                                    )}
                                  {payment.status === "failed" &&
                                    payment.hasStripeReference && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 px-3 text-xs bg-white rounded-xl border-amber-200 text-amber-700 hover:border-amber-300"
                                        onClick={() =>
                                          handlePaymentAction(payment.id, "retry")
                                        }
                                        disabled={actionPending === payment.id}
                                        icon={<RefreshCcw className="w-3 h-3 ml-1" />}
                                      >
                                        {actionPending === payment.id ? "…" : "Retry"}
                                      </Button>
                                    )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden divide-y divide-slate-100">
                      {filtered.map((payment) => (
                        <div key={payment.id} className="p-6 space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400 font-black font-display shadow-sm">
                                {payment.subscriberName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-none mb-1.5">{payment.subscriberName}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {formatDate(payment.paidAt ?? payment.createdAt)}
                                </p>
                              </div>
                            </div>
                            <span className="font-black text-lg text-slate-900">{formatAmount(payment.amountCents, payment.currency)}</span>
                          </div>
                          <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">{payment.creatorName}</span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{payment.paymentMethodLabel}</span>
                            </div>
                            <Badge variant="default" className={cn("text-[10px] py-0.5 uppercase tracking-widest", statusBadge(payment.status))}>
                              {statusLabel(payment.status)}
                            </Badge>
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
              <div
                className={cn(
                  "rounded-[2.5rem] p-10 shadow-sm",
                  failed && failed.failedCount > 0
                    ? "bg-red-50/50 border border-red-100"
                    : "bg-white border border-slate-200"
                )}
              >
                <div className="flex items-center gap-4 mb-8">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                      failed && failed.failedCount > 0
                        ? "bg-red-100 border-red-200"
                        : "bg-slate-50 border-slate-100"
                    )}
                  >
                    <AlertCircle
                      className={cn(
                        "w-6 h-6",
                        failed && failed.failedCount > 0 ? "text-red-600" : "text-slate-400"
                      )}
                    />
                  </div>
                  <h3
                    className={cn(
                      "text-lg font-black font-display uppercase tracking-tight",
                      failed && failed.failedCount > 0
                        ? "text-red-900"
                        : "text-slate-900"
                    )}
                  >
                    Recoveries
                  </h3>
                </div>

                {failed && failed.failedCount > 0 ? (
                  <>
                    <p className="text-[13px] font-medium text-red-800 leading-relaxed mb-8 opacity-90">
                      <strong className="font-black">{failed.failedCount} charge{failed.failedCount === 1 ? "" : "s"}</strong> {failed.failedCount === 1 ? "has" : "have"} failed.
                      At risk: <strong className="font-black">{formatAmount(failed.atRiskCents, "usd")}</strong>.
                    </p>
                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-center bg-white/80 p-4 rounded-2xl border border-red-100/50 shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Action Needed</span>
                        <span className="text-xs font-black text-red-600">{failed.actionNeededCount}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
                    No failed charges right now. The platform is in good standing.
                  </p>
                )}

                <Button
                  variant="outline"
                  className="w-full h-14 bg-white text-red-700 border-red-100 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all"
                  icon={<ArrowRight className="w-4 h-4 ml-1" />}
                  onClick={() => setStatusFilter("failed")}
                >
                  Show failed charges
                </Button>
              </div>
            </MotionReveal>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
