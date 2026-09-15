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
  UserSquare2,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { AdminPager } from "@/components/admin/AdminPager";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { cn } from "@/lib/utils";
import type { AdminCreatorRow, AdminCreatorsResponse } from "@/types/admin-stats";

const STATUS_FILTERS: Array<{ id: "all" | "Active" | "Review"; label: string }> = [
  { id: "all", label: "All" },
  { id: "Active", label: "Active" },
  { id: "Review", label: "Review" },
];

function formatCurrencyCents(cents: number) {
  const amount = cents / 100;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export default function AdminCreatorsPage() {
  const [data, setData] = useState<AdminCreatorsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]["id"]>("all");

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          q: debouncedQuery,
        });
        const res = await fetch(`/api/admin/creators?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load creators.");
        }
        const json = (await res.json()) as AdminCreatorsResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load creators."
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedQuery]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.creators.filter((row) => {
      const matchesQuery =
        !needle ||
        row.creatorName.toLowerCase().includes(needle) ||
        row.creatorSlug.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data, query, statusFilter]);

  const metrics = data?.metrics;

  const metricCards = [
    {
      icon: <UserSquare2 className="w-6 h-6 text-violet-600" />,
      iconBg: "bg-violet-50",
      label: "Total Creators",
      value: metrics ? metrics.totalCreators.toLocaleString() : "—",
    },
    {
      icon: <DollarSign className="w-6 h-6 text-emerald-600" />,
      iconBg: "bg-emerald-50",
      label: "Total Creator MRR",
      value: metrics ? formatCurrencyCents(metrics.totalCreatorMrrCents) : "—",
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-sky-600" />,
      iconBg: "bg-sky-50",
      label: "Avg. Audience",
      value: metrics ? metrics.avgAudience.toLocaleString() : "—",
    },
    {
      icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
      iconBg: "bg-amber-50",
      label: "Pending Review",
      value: metrics ? metrics.pendingReview.toLocaleString() : "—",
    },
  ];

  const statusBadgeClass = (status: AdminCreatorRow["status"]) =>
    status === "Active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-amber-50 text-amber-700 border-amber-100";

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Content Providers"
          title="Creator Management"
          subtitle="Monitor creators, published content, subscriber count, revenue activity, and account status."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<UserSquare2 className="w-4 h-4 ml-1" />}
              href="/api/admin/creators?format=csv"
              title="Download a CSV of all creators"
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
            {metricCards.map((card, i) => (
              <div key={i} className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
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

        <MotionItem>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, slug, or email…"
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
              <div className="p-12 text-sm font-bold text-slate-500">Loading creators…</div>
            ) : filtered.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <UserSquare2 className="w-7 h-7 text-slate-300" />
                </div>
                <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                  {data && data.creators.length > 0 ? "No matches" : "No creators yet"}
                </h3>
                <p className="text-sm text-slate-500 font-medium max-w-md">
                  {data && data.creators.length > 0
                    ? "Try a different name, slug, or status filter."
                    : "Once accounts are flagged as creators, they'll appear here."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-8">Creator Details</th>
                        <th className="p-8">Performance</th>
                        <th className="p-8">Revenue (MRR)</th>
                        <th className="p-8">Status</th>
                        <th className="p-8 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filtered.map((creator) => (
                        <tr key={creator.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="p-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 text-violet-700 font-black font-display overflow-hidden">
                                {creator.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={creator.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  creator.creatorName.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 mb-1 leading-none">{creator.creatorName}</p>
                                <span className="text-xs font-medium text-slate-400 opacity-80">
                                  {creator.email || `@${creator.creatorSlug}`}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-8">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-bold text-slate-900 text-sm leading-none">
                                {creator.subscribersCount.toLocaleString()} Subscribers
                              </span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-70">
                                {creator.contentCount.toLocaleString()} Items
                              </span>
                            </div>
                          </td>
                          <td className="p-8 font-black text-slate-900">
                            {formatCurrencyCents(creator.mrrCents)}
                          </td>
                          <td className="p-8">
                            <Badge variant="default" className={statusBadgeClass(creator.status)}>
                              {creator.status}
                            </Badge>
                          </td>
                          <td className="p-8 text-right">
                            <div className="flex items-center justify-end gap-3 opacity-100 transition-opacity">
                              <Link
                                href={`/creators/${creator.creatorSlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="outline" size="sm" className="h-9 px-4 text-xs bg-white rounded-xl">
                                  Profile
                                </Button>
                              </Link>
                              <Link href={`/admin/users/${encodeURIComponent(creator.clerkUserId)}`}>
                                <Button variant="outline" size="sm" className="h-9 px-4 text-xs bg-white rounded-xl">
                                  Account
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
                  {filtered.map((creator) => (
                    <div key={creator.id} className="p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 text-violet-700 font-black font-display overflow-hidden">
                            {creator.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={creator.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              creator.creatorName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-none mb-1.5">{creator.creatorName}</p>
                            <Badge variant="default" className={cn("text-[10px] py-0.5", statusBadgeClass(creator.status))}>
                              {creator.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Audience</p>
                          <p className="text-xs font-black uppercase tracking-wider text-slate-900">
                            {creator.subscribersCount.toLocaleString()} Subs
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">
                            {creator.contentCount.toLocaleString()} Items
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">Revenue</p>
                          <p className="text-sm font-black text-slate-900">
                            {formatCurrencyCents(creator.mrrCents)}
                          </p>
                        </div>
                      </div>
                      <Link href={`/creators/${creator.creatorSlug}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="w-full h-11 text-xs bg-white rounded-xl">
                          View Creator Portfolio
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
                <AdminPager page={data?.page} onPage={setPage} />
              </>
            )}
          </div>
        </MotionReveal>
      </div>
    </AdminShell>
  );
}
