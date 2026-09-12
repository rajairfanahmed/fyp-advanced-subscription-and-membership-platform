"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Bell,
  CreditCard,
  PlaySquare,
  ShieldAlert,
  CheckCircle2,
  SlidersHorizontal,
  Settings2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  NotificationCategory,
  NotificationListResult,
  NotificationResponse,
} from "@/types/notification";
import type {
  NotificationPreferences,
  PublicUserRole,
  UserProfileResponse,
} from "@/types/profile";

const PREFERENCE_OPTIONS: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: "renewalReminders", label: "Billing notices" },
  { key: "paymentAlerts", label: "Payment alerts" },
  { key: "contentDigests", label: "New content updates" },
  { key: "accountNotices", label: "Account notices" },
  { key: "creatorAnnouncements", label: "Creator announcements" },
];

const DEFAULT_PREFERENCES: NotificationPreferences = {
  productUpdates: true,
  contentDigests: true,
  downloadAlerts: true,
  renewalReminders: true,
  paymentAlerts: true,
  accountNotices: true,
  creatorAnnouncements: false,
};

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case "renewal":
      return <Bell className="w-5 h-5 text-amber-500" />;
    case "payment":
      return <CreditCard className="w-5 h-5 text-emerald-500" />;
    case "content":
      return <PlaySquare className="w-5 h-5 text-sky-500" />;
    case "locked":
      return <ShieldAlert className="w-5 h-5 text-violet-500" />;
    case "account":
      return <Settings2 className="w-5 h-5 text-slate-500" />;
    case "creator":
      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    case "system":
    default:
      return <Info className="w-5 h-5 text-slate-500" />;
  }
}

function getCategoryLabel(category: NotificationCategory) {
  switch (category) {
    case "renewal":
      return "Renewal reminder";
    case "payment":
      return "Payment update";
    case "content":
      return "Content update";
    case "locked":
      return "Locked content";
    case "account":
      return "Account notice";
    case "creator":
      return "Creator update";
    case "system":
    default:
      return "Notification";
  }
}

function formatRelativeTime(iso: string) {
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - created) / 1000));
  if (diffSeconds < 60) return "Just now";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listLoadError, setListLoadError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [savedPreferences, setSavedPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [preferencesError, setPreferencesError] = useState("");
  const [viewerRole, setViewerRole] = useState<PublicUserRole>("subscriber");

  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      setPreferencesLoading(true);
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load profile.");
        const data = (await res.json()) as { profile: UserProfileResponse | null };
        if (cancelled) return;
        setViewerRole(data.profile?.role ?? "subscriber");
        const next = {
          ...DEFAULT_PREFERENCES,
          ...(data.profile?.subscriberProfile?.notificationPreferences ?? {}),
        };
        setPreferences(next);
        setSavedPreferences(next);
      } catch {
        // Keep defaults if profile is unreachable.
      } finally {
        if (!cancelled) setPreferencesLoading(false);
      }
    }
    loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setListLoadError("");
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load notifications.");
        const data = (await res.json()) as NotificationListResult;
        if (!cancelled) setNotifications(data.items);
      } catch {
        if (!cancelled)
          setListLoadError("We couldn't load your notifications. Try again or contact support.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadNonce]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const filteredNotifications = useMemo(
    () => (activeTab === "all" ? notifications : notifications.filter((n) => !n.isRead)),
    [activeTab, notifications]
  );

  async function handleToggleRead(notification: NotificationResponse) {
    if (pendingId) return;
    const nextRead = !notification.isRead;
    setPendingId(notification.id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id
          ? { ...n, isRead: nextRead, readAt: nextRead ? new Date().toISOString() : null }
          : n
      )
    );
    try {
      const res = await fetch(`/api/notifications/${notification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: nextRead }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, isRead: notification.isRead, readAt: notification.readAt }
            : n
        )
      );
      setErrorMessage("We couldn't update that notification. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleMarkAllRead() {
    if (isMarkingAll || unreadCount === 0) return;
    setIsMarkingAll(true);
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((n) =>
        n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() }
      )
    );
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setNotifications(previous);
      setErrorMessage("We couldn't mark everything as read. Please try again.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  function togglePreference(key: keyof NotificationPreferences) {
    setPreferencesMessage("");
    setPreferencesError("");
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSavePreferences() {
    setPreferencesSaving(true);
    setPreferencesMessage("");
    setPreferencesError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPreferences: preferences }),
      });
      if (!res.ok) throw new Error("Failed to save preferences.");
      const data = (await res.json()) as { profile: UserProfileResponse | null };
      const next = {
        ...DEFAULT_PREFERENCES,
        ...(data.profile?.subscriberProfile?.notificationPreferences ?? preferences),
      };
      setPreferences(next);
      setSavedPreferences(next);
      setPreferencesMessage("Preferences saved.");
    } catch (err) {
      setPreferencesError(
        err instanceof Error ? err.message : "Failed to save preferences."
      );
    } finally {
      setPreferencesSaving(false);
    }
  }

  const preferencesDirty =
    JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">

      {/* ── 1. Hero Section ── */}
      <section className="mb-12 relative">
        <div className="absolute top-0 right-1/2 translate-x-1/4 w-[40vw] h-[40vw] bg-amber-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />
        <Container className="max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="mb-4">
              <Badge variant="default">Inbox</Badge>
            </MotionItem>
            <MotionItem>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.1] mb-4">
                Notifications
              </h1>
            </MotionItem>
            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] font-medium max-w-2xl leading-relaxed">
                Review in-app billing notices, content updates, and account messages in one place.
              </p>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      <Container className="max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-10">

          <div className="lg:col-span-2 space-y-8">

            {listLoadError && (
              <MotionReveal>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700 space-y-3">
                  <p>{listLoadError}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white border-rose-200 text-rose-800"
                      onClick={() => setLoadNonce((n) => n + 1)}
                    >
                      Try again
                    </Button>
                    <Button variant="ghost" className="text-rose-800" href="/contact">
                      Contact support
                    </Button>
                  </div>
                </div>
              </MotionReveal>
            )}

            {/* ── 3 & 4. Notification List ── */}
            {(isLoading || !listLoadError) && (
            <MotionReveal>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setActiveTab("all")}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
                        activeTab === "all"
                          ? "bg-white text-[var(--color-ink)] shadow-sm"
                          : "text-slate-500 hover:text-[var(--color-ink)]"
                      )}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setActiveTab("unread")}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer",
                        activeTab === "unread"
                          ? "bg-white text-[var(--color-ink)] shadow-sm"
                          : "text-slate-500 hover:text-[var(--color-ink)]"
                      )}
                    >
                      Unread
                      <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md text-[10px]">
                        {unreadCount}
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={handleMarkAllRead}
                    disabled={unreadCount === 0 || isMarkingAll}
                    className={cn(
                      "text-sm font-bold transition-colors",
                      unreadCount === 0 || isMarkingAll
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-sky-600 hover:text-sky-700 cursor-pointer"
                    )}
                  >
                    {isMarkingAll ? "Marking…" : "Mark all as read"}
                  </button>
                </div>

                {errorMessage && (
                  <div className="px-6 md:px-8 py-3 bg-rose-50 border-b border-rose-100 text-sm font-semibold text-rose-700">
                    {errorMessage}
                  </div>
                )}

                {isLoading ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full border-2 border-slate-200 border-t-[var(--color-ink)] animate-spin mb-4" />
                    <p className="text-sm font-semibold text-slate-500">Loading your inbox…</p>
                  </div>
                ) : filteredNotifications.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredNotifications.map((notif) => {
                      const categoryLabel = getCategoryLabel(notif.category);
                      const icon = getCategoryIcon(notif.category);
                      const time = formatRelativeTime(notif.createdAt);
                      const isPending = pendingId === notif.id;
                      const rowClass = cn(
                        "p-6 md:p-8 flex items-start gap-4 transition-colors hover:bg-slate-50/50 cursor-pointer relative",
                        !notif.isRead && "bg-sky-50/30",
                        isPending && "opacity-60"
                      );

                      const inner = (
                        <>
                          {!notif.isRead && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500" />
                          )}

                          <div
                            className={cn(
                              "w-12 h-12 rounded-full flex items-center justify-center shrink-0 border",
                              !notif.isRead
                                ? "bg-white border-slate-200 shadow-sm"
                                : "bg-slate-50 border-slate-100 opacity-70"
                            )}
                          >
                            {icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                {categoryLabel}
                              </span>
                              <span className="text-xs font-medium text-slate-400">{time}</span>
                            </div>
                            {notif.title && notif.title !== notif.message && (
                              <p
                                className={cn(
                                  "text-base mb-1",
                                  !notif.isRead
                                    ? "font-bold text-[var(--color-ink)]"
                                    : "font-bold text-slate-700"
                                )}
                              >
                                {notif.title}
                              </p>
                            )}
                            <p
                              className={cn(
                                "text-base",
                                !notif.isRead
                                  ? "font-bold text-[var(--color-ink)]"
                                  : "font-medium text-slate-600"
                              )}
                            >
                              {notif.message}
                            </p>
                          </div>
                        </>
                      );

                      if (notif.link) {
                        return (
                          <Link
                            key={notif.id}
                            href={notif.link}
                            onClick={() => {
                              if (!notif.isRead) handleToggleRead(notif);
                            }}
                            className={rowClass}
                          >
                            {inner}
                          </Link>
                        );
                      }

                      return (
                        <div
                          key={notif.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleToggleRead(notif)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleToggleRead(notif);
                            }
                          }}
                          className={rowClass}
                        >
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── 5. Empty State ── */
                  <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                      <Bell className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">
                      You&apos;re all caught up!
                    </h3>
                    <p className="text-slate-500 font-medium">
                      {activeTab === "unread"
                        ? "No unread notifications right now."
                        : "There are no notifications waiting for you."}
                    </p>
                  </div>
                )}
              </div>
            </MotionReveal>
            )}

          </div>

          <div className="lg:col-span-1 space-y-6">

            {/* ── 2. Notification Preference Card ── */}
            <MotionReveal className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <SlidersHorizontal className="w-5 h-5 text-[var(--color-ink)]" />
                  <h3 className="text-lg font-black font-display text-[var(--color-ink)]">Notification Settings</h3>
                </div>

                <div className="space-y-5">
                  {preferencesLoading ? (
                    <p className="text-sm font-medium text-slate-500">Loading preferences…</p>
                  ) : viewerRole === "creator" ? (
                    <>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        Creator workspace alerts (new subscribers, renewals, revenue) are managed in Creator Settings.
                      </p>
                      <Button variant="outline" className="w-full text-xs" href="/creator/settings">
                        Open creator settings
                      </Button>
                    </>
                  ) : (
                    <>
                    {PREFERENCE_OPTIONS.map((pref) => (
                      <div key={pref.key} className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">{pref.label}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences[pref.key]}
                            onChange={() => togglePreference(pref.key)}
                            className="sr-only peer"
                            aria-label={pref.label}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    ))}

                  {preferencesError && (
                    <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                      {preferencesError}
                    </p>
                  )}
                  {preferencesMessage && !preferencesError && (
                    <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      {preferencesMessage}
                    </p>
                  )}

                  <div className="pt-6 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={handleSavePreferences}
                      disabled={preferencesSaving || preferencesLoading || !preferencesDirty}
                    >
                      {preferencesSaving
                        ? "Saving…"
                        : preferencesDirty
                          ? "Save Settings"
                          : "Saved"}
                    </Button>
                  </div>
                    </>
                  )}
                </div>
              </div>
            </MotionReveal>

            {/* ── 6. Notification Explanation Card ── */}
            <MotionReveal>
              <div className="bg-sky-50 border border-sky-100 rounded-[2rem] p-8 flex gap-4 items-start">
                <Info className="w-6 h-6 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-sky-900 uppercase tracking-widest mb-2">How we notify you</h3>
                  <p className="text-sm text-sky-800 font-medium leading-relaxed">
                    {viewerRole === "creator"
                      ? "Workspace alerts for new subscribers, failed payments, and revenue live in Creator Settings. You can still read every in-app notification here."
                      : "Billing and account alerts appear in this inbox when they happen. Promotional content and creator updates can be toggled off at any time."}
                  </p>
                </div>
              </div>
            </MotionReveal>

          </div>

        </div>
      </Container>
    </div>
  );
}
