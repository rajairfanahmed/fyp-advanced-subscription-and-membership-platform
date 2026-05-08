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
  BellRing,
  MailCheck,
  MailWarning,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminBroadcastInput,
  AdminNotificationsResponse,
} from "@/types/admin-stats";
import type { NotificationCategory } from "@/types/notification";

const CATEGORY_FILTERS: Array<{
  id: "all" | NotificationCategory;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "system", label: "System" },
  { id: "account", label: "Account" },
  { id: "renewal", label: "Renewal" },
  { id: "payment", label: "Payment" },
  { id: "content", label: "Content" },
];

function formatRelative(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diff < 60) return "Just now";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} ${m === 1 ? "min" : "mins"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

export default function AdminNotificationsPage() {
  const [data, setData] = useState<AdminNotificationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<(typeof CATEGORY_FILTERS)[number]["id"]>("all");

  const [audience, setAudience] =
    useState<AdminBroadcastInput["audience"]>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || "Failed to load notifications.");
      }
      const json = (await res.json()) as AdminNotificationsResponse;
      setData(json);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load notifications."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.notifications.filter((row) => {
      const matchesQuery =
        !needle ||
        row.title.toLowerCase().includes(needle) ||
        row.recipientName.toLowerCase().includes(needle);
      const matchesCategory =
        categoryFilter === "all" || row.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [data, query, categoryFilter]);

  const metrics = data?.metrics;

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      setFeedback({
        type: "error",
        text: "Both subject and message body are required.",
      });
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          subject: trimmedSubject,
          body: trimmedBody,
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || "Broadcast failed.");
      }
      const result = (await res.json()) as { recipientsCount: number };
      setFeedback({
        type: "success",
        text: `Sent to ${result.recipientsCount} recipient${result.recipientsCount === 1 ? "" : "s"}.`,
      });
      setSubject("");
      setBody("");
      await load();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Broadcast failed.",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-12">
        <DashboardHeader
          role="admin"
          eyebrow="Communications"
          title="System Notifications"
          subtitle="Review renewal reminders, failed payment alerts, cancellation messages, content updates, and account notices."
        />

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
            {errorMessage}
          </div>
        )}

        <MotionItem>
          <div className="grid sm:grid-cols-3 gap-6 md:gap-10">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-6">
                <BellRing className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Total System Alerts</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.totalSystemAlerts ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
                <MailCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Delivery Success</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading
                  ? "…"
                  : `${(metrics?.deliverySuccessPercent ?? 100).toFixed(1)}%`}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 opacity-70">In-app delivery</p>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
                <MailWarning className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Failed Delivery</h3>
              <p className="text-3xl font-black font-display text-slate-900">
                {isLoading ? "…" : (metrics?.failedDelivery ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </MotionItem>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <MotionItem>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shadow-sm">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by title or recipient…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm font-medium"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto ml-auto flex-wrap">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  {CATEGORY_FILTERS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setCategoryFilter(option.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer",
                        categoryFilter === option.id
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
                  <div className="p-12 text-sm font-bold text-slate-500">Loading notifications…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                      <BellRing className="w-7 h-7 text-slate-300" />
                    </div>
                    <h3 className="text-base font-black text-[var(--color-ink)] mb-2">
                      {data && data.notifications.length > 0
                        ? "No matches"
                        : "No notifications yet"}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium max-w-md">
                      {data && data.notifications.length > 0
                        ? "Try a different category or search."
                        : "Send a broadcast from the panel on the right to populate this feed."}
                    </p>
                  </div>
                ) : (
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="p-8">Notice &amp; Date</th>
                          <th className="p-8">Recipient</th>
                          <th className="p-8">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filtered.map((note) => (
                          <tr key={note.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-8">
                              <div className="flex flex-col gap-1.5 items-start">
                                <span className="font-bold text-slate-900 leading-snug">{note.title}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  {note.category} · {formatRelative(note.createdAt)}
                                </span>
                              </div>
                            </td>
                            <td className="p-8">
                              <div className="flex items-center gap-4">
                                <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 text-slate-400 font-black font-display text-xs border border-slate-100 shadow-sm">
                                  {note.recipientName.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold text-slate-900">{note.recipientName}</span>
                              </div>
                            </td>
                            <td className="p-8">
                              <Badge
                                variant="default"
                                className={cn(
                                  note.isRead
                                    ? "bg-slate-50 text-slate-600 border-slate-100"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                )}
                              >
                                {note.isRead ? "Read" : "Unread"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!isLoading && filtered.length > 0 && (
                  <div className="md:hidden divide-y divide-slate-100">
                    {filtered.map((note) => (
                      <div key={note.id} className="p-6 space-y-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-900">{note.title}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {note.category} · {formatRelative(note.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 text-slate-400 font-black font-display text-[10px] border border-slate-100">
                              {note.recipientName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-bold text-slate-900">{note.recipientName}</span>
                          </div>
                          <Badge
                            variant="default"
                            className={cn(
                              "text-[10px] py-0.5",
                              note.isRead
                                ? "bg-slate-50 text-slate-600 border-slate-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            )}
                          >
                            {note.isRead ? "Read" : "Unread"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </MotionReveal>
          </div>

          <div className="lg:col-span-1 space-y-10">
            <MotionReveal className="sticky top-24">
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                    <Send className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black font-display text-slate-900">Dispatch</h3>
                </div>

                <form className="space-y-6" onSubmit={handleBroadcast}>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Audience</label>
                    <select
                      value={audience}
                      onChange={(e) =>
                        setAudience(e.target.value as AdminBroadcastInput["audience"])
                      }
                      className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 cursor-pointer"
                    >
                      <option value="all">All Users</option>
                      <option value="subscribers">All Subscribers</option>
                      <option value="creators">All Creators</option>
                      <option value="admins">Admins Only</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Subject</label>
                    <input
                      type="text"
                      maxLength={120}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Platform Maintenance"
                      className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 placeholder:text-slate-300"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Message Body</label>
                    <textarea
                      rows={5}
                      maxLength={600}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Type message content here…"
                      className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 placeholder:text-slate-300 resize-none leading-relaxed"
                    />
                  </div>

                  {feedback && (
                    <p
                      className={cn(
                        "text-xs font-bold rounded-xl px-4 py-3",
                        feedback.type === "success"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      )}
                    >
                      {feedback.text}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em]"
                    icon={<Send className="w-4 h-4 ml-1" />}
                    disabled={isSending}
                  >
                    {isSending ? "Sending…" : "Send Notice"}
                  </Button>
                </form>
              </div>
            </MotionReveal>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
