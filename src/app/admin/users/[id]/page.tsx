"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Mail,
  Calendar,
  CreditCard,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  DollarSign,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type {
  AdminUserDetailResponse,
  AdminUserPaymentRow,
  AdminUserSubscriptionRow,
} from "@/types/admin-stats";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(cents: number, currency: string) {
  const symbol =
    currency.toLowerCase() === "eur"
      ? "€"
      : currency.toLowerCase() === "gbp"
        ? "£"
        : "$";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function statusTone(status: AdminUserDetailResponse["user"]["status"]) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "Suspended") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-rose-50 text-rose-700 border-rose-100";
}

function subStatusTone(status: AdminUserSubscriptionRow["status"]) {
  if (status === "active" || status === "trialing")
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "past_due") return "bg-red-50 text-red-700 border-red-100";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function subStatusLabel(status: AdminUserSubscriptionRow["status"]) {
  if (status === "active" || status === "trialing") return "Active";
  if (status === "past_due") return "Past due";
  if (status === "canceled") return "Cancelled";
  if (status === "expired") return "Expired";
  return status;
}

function paymentStatusTone(status: AdminUserPaymentRow["status"]) {
  if (status === "succeeded") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-100";
  if (status === "pending") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<AdminUserDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(params.id)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to load user.");
      }
      const json = (await res.json()) as AdminUserDetailResponse;
      setData(json);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load user.");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) load();
  }, [params.id, load]);

  async function handleStatusChange(next: "active" | "suspended") {
    if (!data || actionPending) return;
    setActionPending(true);
    setActionError("");
    setFeedback("");
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(params.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountStatus: next }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as
        | AdminUserDetailResponse
        | { error?: string };
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error || "Failed to update user."
        );
      }
      setData(body as AdminUserDetailResponse);
      setFeedback(
        next === "suspended" ? "User suspended." : "User restored."
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update user."
      );
    } finally {
      setActionPending(false);
    }
  }

  if (isLoading) {
    return (
      <AdminShell>
        <div className="space-y-6">
          <DashboardHeader
            role="admin"
            eyebrow="Platform Accounts"
            title="User Detail"
            subtitle="Loading user…"
          />
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-sm font-bold text-slate-500">
            Loading user…
          </div>
        </div>
      </AdminShell>
    );
  }

  if (errorMessage || !data) {
    return (
      <AdminShell>
        <div className="space-y-6">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to users
          </Link>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-sm font-bold text-rose-700">
            {errorMessage || "User not found."}
          </div>
        </div>
      </AdminShell>
    );
  }

  const { user, metrics, subscriptions, payments } = data;

  return (
    <AdminShell>
      <div className="space-y-10">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to users
        </Link>

        <DashboardHeader
          role="admin"
          eyebrow="Platform Accounts"
          title={user.name}
          subtitle={user.email || user.clerkUserId}
          action={
            user.role === "admin" ? null : user.accountStatus === "suspended" ? (
              <Button
                variant="primary"
                onClick={() => handleStatusChange("active")}
                disabled={actionPending}
                icon={<ShieldCheck className="w-4 h-4 ml-1" />}
              >
                {actionPending ? "Restoring…" : "Restore access"}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => handleStatusChange("suspended")}
                disabled={actionPending}
                icon={<ShieldAlert className="w-4 h-4 ml-1" />}
                className="bg-white border-slate-200"
              >
                {actionPending ? "Suspending…" : "Suspend account"}
              </Button>
            )
          }
        />

        {feedback && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm font-bold text-emerald-700">
            {feedback}
          </div>
        )}
        {actionError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm font-bold text-rose-700">
            {actionError}
          </div>
        )}

        {/* Profile + status card */}
        <MotionItem>
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm grid md:grid-cols-[auto,1fr,auto] gap-8 items-center">
            <div className="w-20 h-20 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-700 text-3xl font-black font-display overflow-hidden shrink-0">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="default"
                  className={cn("text-[10px] py-0.5", statusTone(user.status))}
                >
                  {user.status}
                </Badge>
                <Badge
                  variant="default"
                  className={
                    user.role === "admin"
                      ? "bg-violet-50 text-violet-700 border-violet-100 text-[10px]"
                      : user.role === "creator"
                        ? "bg-sky-50 text-sky-700 border-sky-100 text-[10px]"
                        : "bg-slate-50 text-slate-600 border-slate-100 text-[10px]"
                  }
                >
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
                <Badge
                  variant="default"
                  className="bg-slate-50 text-slate-600 border-slate-100 text-[10px]"
                >
                  {user.highestPlanLabel} plan
                </Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate font-medium">
                    {user.email || "no email on file"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">
                    Joined {formatDate(user.joinedAt)}
                  </span>
                </div>
              </div>
              {user.bio && (
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  {user.bio}
                </p>
              )}
              <p className="text-xs font-bold text-slate-400 break-all">
                {user.clerkUserId}
              </p>
            </div>
          </div>
        </MotionItem>

        {/* Metrics */}
        <MotionItem>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">
                Total Spent
              </h3>
              <p className="text-2xl font-black text-slate-900">
                {formatAmount(metrics.totalSpentCents, "usd")}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
                <CreditCard className="w-5 h-5 text-sky-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">
                Active Subs
              </h3>
              <p className="text-2xl font-black text-slate-900">
                {metrics.activeSubscriptions}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5 text-violet-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">
                Paid Subs
              </h3>
              <p className="text-2xl font-black text-slate-900">
                {metrics.paidSubscriptions}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">
                Failed Payments
              </h3>
              <p className="text-2xl font-black text-slate-900">
                {metrics.failedPayments}
              </p>
            </div>
          </div>
        </MotionItem>

        {/* Subscriptions */}
        <MotionReveal>
          <div className="bg-white rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm">
            <h2 className="text-lg font-black font-display text-slate-900 mb-6">
              Subscriptions
            </h2>
            {subscriptions.length === 0 ? (
              <p className="text-sm font-medium text-slate-500">
                This user has no subscription history yet.
              </p>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/40"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {sub.creatorName}{" "}
                        <span className="text-slate-400 font-medium">
                          · {sub.plan}
                        </span>
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-1">
                        Started {formatDate(sub.startedAt)} · {sub.renewalLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="default"
                        className={cn(
                          "text-[10px] py-0.5",
                          subStatusTone(sub.status)
                        )}
                      >
                        {subStatusLabel(sub.status)}
                      </Badge>
                      <span className="text-xs font-black text-slate-700">
                        ${sub.priceMonthly.toFixed(2)}/mo
                      </span>
                      {sub.creatorSlug && (
                        <Link
                          href={`/creators/${sub.creatorSlug}`}
                          className="text-xs font-black text-violet-600 hover:text-violet-700 inline-flex items-center gap-1"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MotionReveal>

        {/* Payments */}
        <MotionReveal>
          <div className="bg-white rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm">
            <h2 className="text-lg font-black font-display text-slate-900 mb-6">
              Recent Payments
            </h2>
            {payments.length === 0 ? (
              <p className="text-sm font-medium text-slate-500">
                No payment history.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.slice(0, 20).map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className="w-5 h-5 text-slate-400 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-900">
                          {formatAmount(p.amountCents, p.currency)}{" "}
                          <span className="text-slate-400 font-medium text-xs">
                            {p.currency.toUpperCase()}
                          </span>
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          {p.description || "Subscription charge"} ·{" "}
                          {formatDate(p.paidAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="default"
                        className={cn(
                          "text-[10px] py-0.5",
                          paymentStatusTone(p.status)
                        )}
                      >
                        {p.status}
                      </Badge>
                      {p.receiptUrl && (
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-black text-violet-600 hover:text-violet-700 inline-flex items-center gap-1"
                        >
                          Receipt <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MotionReveal>
      </div>
    </AdminShell>
  );
}
