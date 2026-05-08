"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import {
  Settings2,
  Users,
  CreditCard,
  BellRing,
  ShieldAlert,
  Save,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminPlatformSettingsInput,
  AdminPlatformSettingsResponse,
} from "@/types/admin-stats";

const DEFAULTS: AdminPlatformSettingsResponse = {
  platformDisplayName: "Nexora",
  supportEmail: "support@nexora.com",
  defaultSubscriberTier: "free",
  defaultCreatorStatus: "review",
  platformCurrency: "usd",
  defaultBillingCycle: "monthly",
  renewalReminderLeadDays: 7,
  failureAlertCadence: "immediate",
  maintenanceMode: false,
};

export default function AdminSettingsPage() {
  const [settings, setSettings] =
    useState<AdminPlatformSettingsResponse>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errBody.error || "Failed to load settings.");
        }
        const json = (await res.json()) as AdminPlatformSettingsResponse;
        if (!cancelled) setSettings(json);
      } catch (err) {
        if (!cancelled)
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load settings."
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

  function update<K extends keyof AdminPlatformSettingsResponse>(
    key: K,
    value: AdminPlatformSettingsResponse[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setFeedback(null);
  }

  async function persist(payload: AdminPlatformSettingsInput) {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || "Save failed.");
      }
      const json = (await res.json()) as AdminPlatformSettingsResponse;
      setSettings(json);
      setFeedback({ type: "success", text: "Settings saved." });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Save failed.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    await persist(settings);
  }

  async function handleToggleMaintenance() {
    await persist({ maintenanceMode: !settings.maintenanceMode });
  }

  return (
    <AdminShell>
      <form onSubmit={handleSaveAll} className="space-y-12 pb-20">
        <DashboardHeader
          role="admin"
          eyebrow="Global Configuration"
          title="System Settings"
          subtitle="Manage platform settings, role defaults, billing display preferences, notification defaults, and safety settings."
          action={
            <Button
              type="submit"
              variant="primary"
              className="h-12 px-8 rounded-2xl"
              icon={<Save className="w-4 h-4 ml-1" />}
              disabled={isLoading || isSaving}
            >
              {isSaving ? "Saving…" : "Save All Changes"}
            </Button>
          }
        />

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm font-bold text-rose-700">
            {errorMessage}
          </div>
        )}
        {feedback && (
          <div
            className={cn(
              "rounded-2xl p-5 text-sm font-bold",
              feedback.type === "success"
                ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                : "bg-rose-50 border border-rose-100 text-rose-700"
            )}
          >
            {feedback.text}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <MotionReveal className="space-y-10">
              {/* Platform Identity */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-50 flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shadow-sm">
                    <Settings2 className="w-7 h-7 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black font-display text-slate-900 tracking-tight">
                      Platform Identity
                    </h2>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-70">
                      Core Brand Settings
                    </p>
                  </div>
                </div>
                <div className="p-10 space-y-8">
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        Platform Display Name
                      </label>
                      <input
                        type="text"
                        value={settings.platformDisplayName}
                        onChange={(e) =>
                          update("platformDisplayName", e.target.value)
                        }
                        disabled={isLoading || isSaving}
                        maxLength={80}
                        className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        Global Support Alias
                      </label>
                      <input
                        type="email"
                        value={settings.supportEmail}
                        onChange={(e) => update("supportEmail", e.target.value)}
                        disabled={isLoading || isSaving}
                        className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Role Defaults */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-50 flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shadow-sm">
                    <Users className="w-7 h-7 text-sky-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black font-display text-slate-900 tracking-tight">
                      Role Defaults
                    </h2>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-70">
                      New Account Provisioning
                    </p>
                  </div>
                </div>
                <div className="p-10 space-y-8">
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        Default Subscriber Tier
                      </label>
                      <select
                        value={settings.defaultSubscriberTier}
                        onChange={(e) =>
                          update(
                            "defaultSubscriberTier",
                            e.target.value as AdminPlatformSettingsResponse["defaultSubscriberTier"]
                          )
                        }
                        disabled={isLoading || isSaving}
                        className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 cursor-pointer disabled:opacity-60"
                      >
                        <option value="free">Free Plan (auto-grant)</option>
                        <option value="pending">Pending Approval</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        Default Creator Status
                      </label>
                      <select
                        value={settings.defaultCreatorStatus}
                        onChange={(e) =>
                          update(
                            "defaultCreatorStatus",
                            e.target.value as AdminPlatformSettingsResponse["defaultCreatorStatus"]
                          )
                        }
                        disabled={isLoading || isSaving}
                        className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 cursor-pointer disabled:opacity-60"
                      >
                        <option value="review">Review Needed</option>
                        <option value="active">Active</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing Defaults */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-50 flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                    <CreditCard className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black font-display text-slate-900 tracking-tight">
                      Billing Engine
                    </h2>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-70">
                      Currency &amp; Cycle Defaults
                    </p>
                  </div>
                </div>
                <div className="p-10 space-y-8">
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        Platform Currency
                      </label>
                      <select
                        value={settings.platformCurrency}
                        onChange={(e) =>
                          update(
                            "platformCurrency",
                            e.target.value as AdminPlatformSettingsResponse["platformCurrency"]
                          )
                        }
                        disabled={isLoading || isSaving}
                        className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 cursor-pointer disabled:opacity-60"
                      >
                        <option value="usd">USD ($)</option>
                        <option value="eur">EUR (€)</option>
                        <option value="gbp">GBP (£)</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        Default Billing Cycle
                      </label>
                      <select
                        value={settings.defaultBillingCycle}
                        onChange={(e) =>
                          update(
                            "defaultBillingCycle",
                            e.target.value as AdminPlatformSettingsResponse["defaultBillingCycle"]
                          )
                        }
                        disabled={isLoading || isSaving}
                        className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-bold text-slate-900 cursor-pointer disabled:opacity-60"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="annually">Annually</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </MotionReveal>
          </div>

          <div className="lg:col-span-1 space-y-10">
            <MotionReveal className="sticky top-24 space-y-10">
              {/* Notification Defaults */}
              <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <BellRing className="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-black font-display text-slate-900">Alert Defaults</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Renewal Reminders
                    </label>
                    <select
                      value={String(settings.renewalReminderLeadDays)}
                      onChange={(e) =>
                        update(
                          "renewalReminderLeadDays",
                          Number(e.target.value)
                        )
                      }
                      disabled={isLoading || isSaving}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-bold text-slate-900 text-xs cursor-pointer disabled:opacity-60"
                    >
                      <option value="7">7 days before</option>
                      <option value="3">3 days before</option>
                      <option value="1">1 day before</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Failure Alerts
                    </label>
                    <select
                      value={settings.failureAlertCadence}
                      onChange={(e) =>
                        update(
                          "failureAlertCadence",
                          e.target.value as AdminPlatformSettingsResponse["failureAlertCadence"]
                        )
                      }
                      disabled={isLoading || isSaving}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-bold text-slate-900 text-xs cursor-pointer disabled:opacity-60"
                    >
                      <option value="immediate">Immediate (1 hour)</option>
                      <option value="daily">Daily Digest</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Access (informational) */}
              <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-10 shadow-sm">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                    <ShieldCheck className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-black font-display text-slate-900">Admin Allowlist</h3>
                </div>
                <p className="text-[13px] font-medium text-slate-500 leading-relaxed mb-6 opacity-80">
                  Admins are managed via the <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs">ADMIN_EMAILS</code> environment variable. Update your deployment&rsquo;s environment to add or remove admin accounts.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-14 bg-white text-[10px] font-black uppercase tracking-widest border-slate-200 rounded-2xl"
                  disabled
                  title="Allowlist is managed via env vars"
                >
                  Managed via env
                </Button>
              </div>

              {/* Maintenance Mode */}
              <div
                className={cn(
                  "rounded-[2.5rem] p-10 shadow-sm",
                  settings.maintenanceMode
                    ? "bg-red-50/80 border border-red-200"
                    : "bg-red-50/50 border border-red-100"
                )}
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-red-100 flex items-center justify-center shadow-sm">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-black font-display text-red-900">Maintenance Mode</h3>
                </div>
                <p className="text-[13px] font-medium text-red-800 leading-relaxed mb-6 opacity-80">
                  When enabled, this flag is recorded in the platform settings document.
                  UI guards using this flag to lock down sessions can be added in a follow-up.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleToggleMaintenance}
                  disabled={isLoading || isSaving}
                  className={cn(
                    "w-full h-14 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all",
                    settings.maintenanceMode
                      ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                      : "bg-white text-red-600 border-red-100 hover:bg-red-50"
                  )}
                >
                  {settings.maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}
                </Button>
              </div>
            </MotionReveal>
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
