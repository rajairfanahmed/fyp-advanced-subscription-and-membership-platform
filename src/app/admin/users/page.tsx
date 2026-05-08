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
  MoreHorizontal,
  Users,
  ShieldAlert,
  UserCheck,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminUserRow, AdminUsersResponse } from "@/types/admin-stats";

const ROLE_FILTERS: Array<{ id: "all" | "subscriber" | "creator" | "admin"; label: string }> = [
  { id: "all", label: "All" },
  { id: "subscriber", label: "Subscribers" },
  { id: "creator", label: "Creators" },
  { id: "admin", label: "Admins" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusTone(status: AdminUserRow["status"]) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "Suspended") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-rose-50 text-rose-700 border-rose-100";
}

function roleLabel(role: AdminUserRow["role"]) {
  if (role === "admin") return "Admin";
  if (role === "creator") return "Creator";
  return "Subscriber";
}

export default function AdminUsersPage() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<(typeof ROLE_FILTERS)[number]["id"]>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to load users.");
        }
        const json = (await res.json()) as AdminUsersResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load users."
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
    return data.users.filter((row) => {
      const matchesQuery =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        row.clerkUserId.toLowerCase().includes(needle);
      const matchesRole = roleFilter === "all" || row.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [data, query, roleFilter]);

  const metrics = data?.metrics;

  const metricCards = [
    {
      icon: <Users className="w-6 h-6 text-violet-600" />,
      iconBg: "bg-violet-50",
      label: "Total Users",
      value: metrics ? metrics.totalUsers.toLocaleString() : "—",
    },
    {
      icon: <UserCheck className="w-6 h-6 text-emerald-600" />,
      iconBg: "bg-emerald-50",
      label: "Active Accounts",
      value: metrics ? metrics.activeAccounts.toLocaleString() : "—",
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-amber-600" />,
      iconBg: "bg-amber-50",
      label: "Suspended",
      value: metrics ? metrics.suspended.toLocaleString() : "—",
    },
    {
      icon: <UserX className="w-6 h-6 text-red-600" />,
      iconBg: "bg-red-50",
      label: "Deactivated",
      value: metrics ? metrics.deactivated.toLocaleString() : "—",
    },
  ];

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Platform Accounts"
          title="User Management"
          subtitle="View platform users, roles, account status, plan access, and recent activity."
          action={
            <Button
              variant="secondary"
              className="bg-white border-slate-200"
              icon={<Users className="w-4 h-4 ml-1" />}
              href="/api/admin/users?format=csv"
              title="Download a CSV of all users"
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

        {/* Metric Cards */}
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

        {/* Filter Bar */}
        <MotionItem>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or Clerk ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto ml-auto flex-wrap">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              {ROLE_FILTERS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setRoleFilter(option.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer",
                    roleFilter === option.id
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

        {/* User Table */}
        <MotionReveal>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-sm font-bold text-slate-500">Loading users…</div>
            ) : filtered.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-slate-300" />
                </div>
                <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                  {data && data.users.length > 0 ? "No matches" : "No users yet"}
                </h3>
                <p className="text-sm text-slate-500 font-medium max-w-md">
                  {data && data.users.length > 0
                    ? "Try a different name, email, or role filter."
                    : "Once users sign up, they'll appear here."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-8">User Details</th>
                        <th className="p-8">Role &amp; Plan</th>
                        <th className="p-8">Status</th>
                        <th className="p-8">Joined Date</th>
                        <th className="p-8 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filtered.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="p-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 text-violet-700 font-black font-display overflow-hidden">
                                {user.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  user.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 mb-1 leading-none">{user.name}</p>
                                <span className="text-xs font-medium text-slate-400 opacity-80">
                                  {user.email || user.clerkUserId.slice(0, 12)}…
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-8">
                            <div className="flex flex-col gap-2 items-start">
                              <Badge
                                variant="default"
                                className={
                                  user.role === "admin"
                                    ? "bg-violet-50 text-violet-700 border-violet-100 text-[10px]"
                                    : "bg-slate-50 text-slate-500 border-slate-100 text-[10px]"
                                }
                              >
                                {roleLabel(user.role)}
                              </Badge>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {user.highestPlanLabel} Plan
                              </span>
                            </div>
                          </td>
                          <td className="p-8">
                            <Badge variant="default" className={statusTone(user.status)}>
                              {user.status}
                            </Badge>
                          </td>
                          <td className="p-8 font-medium text-slate-400 text-xs">
                            {formatDate(user.joinedAt)}
                          </td>
                          <td className="p-8 text-right">
                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Link href={`/admin/users/${encodeURIComponent(user.clerkUserId)}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-4 text-xs bg-white rounded-xl"
                                >
                                  View
                                </Button>
                              </Link>
                              <button
                                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all"
                                disabled
                                title="More actions land in a follow-up"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filtered.map((user) => (
                    <div key={user.id} className="p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 text-violet-700 font-black font-display overflow-hidden">
                            {user.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              user.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-none mb-1.5">
                              {user.name}
                            </p>
                            <Badge variant="default" className="text-[10px] py-0.5">
                              {roleLabel(user.role)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">
                            Plan &amp; Joined
                          </p>
                          <p className="text-xs font-black uppercase tracking-wider text-slate-900">
                            {user.highestPlanLabel}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">
                            {formatDate(user.joinedAt)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-60">
                            Account Status
                          </p>
                          <Badge
                            variant="default"
                            className={cn("text-[10px] py-0.5", statusTone(user.status))}
                          >
                            {user.status}
                          </Badge>
                        </div>
                      </div>
                      <Link href={`/admin/users/${encodeURIComponent(user.clerkUserId)}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-11 text-xs bg-white rounded-xl"
                        >
                          View Profile
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
    </AdminShell>
  );
}
