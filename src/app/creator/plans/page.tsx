"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CheckCircle2,
  PlusCircle,
  Globe,
  Lock,
  Zap,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { serializeTierLimits } from "@/config/tier-limits";
import {
  fetchWithTimeout,
  readJsonSafe,
  RequestTimeoutError,
} from "@/lib/http/fetch-timeout";
import { useInFlightLock } from "@/lib/ui/useInFlightLock";
import type { PlanAccessLevel, PlanResponse } from "@/types/plan";

const ACCESS_ICON: Record<PlanAccessLevel, React.ReactNode> = {
  free: <Globe className="w-4 h-4" />,
  basic: <Lock className="w-4 h-4" />,
  premium: <Zap className="w-4 h-4" />,
};

const TIER_ORDER: Record<PlanAccessLevel, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

const fieldClass =
  "w-full px-4 py-3.5 bg-white border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all font-bold text-slate-950 placeholder:text-slate-400 placeholder:font-medium";
const labelClass = "text-[11px] font-black text-slate-700 uppercase tracking-[0.2em]";

function featuresToText(features: string[]) {
  return features.join("\n");
}

function textToFeatures(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function formatPrice(amount: number, accessLevel: PlanAccessLevel) {
  if (accessLevel === "free" || !amount) return "Free";
  const rounded = Number(amount);
  if (!Number.isFinite(rounded)) return "$0";
  return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

function sortPlans(plans: PlanResponse[]) {
  return [...plans].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.isDefault && b.isDefault) {
      return TIER_ORDER[a.accessLevel] - TIER_ORDER[b.accessLevel];
    }
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [featuresText, setFeaturesText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const mutationLock = useInFlightLock();
  const [isCreating, setIsCreating] = useState(false);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraName, setExtraName] = useState("");
  const [extraAccess, setExtraAccess] = useState<PlanAccessLevel>("basic");
  const [extraPrice, setExtraPrice] = useState(9);
  const [priceError, setPriceError] = useState("");
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const orderedPlans = useMemo(() => sortPlans(plans), [plans]);
  const editingPlan = useMemo(
    () => orderedPlans.find((plan) => plan.id === editingId) ?? null,
    [orderedPlans, editingId]
  );
  const isFreePlan = editingPlan?.accessLevel === "free";
  const isPaidPlan = Boolean(editingPlan && editingPlan.accessLevel !== "free");

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        const res = await fetch("/api/plans", { cache: "no-store" });
        const data = (await res.json()) as { plans?: PlanResponse[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Plans could not be loaded.");
        if (cancelled) return;
        const list = sortPlans(data.plans ?? []);
        setPlans(list);
        if (list.length > 0) {
          setEditingId((current) => current ?? list[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Plans could not be loaded. Please refresh and try again."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editingPlan) {
      setName("");
      setDescription("");
      setPriceMonthly(0);
      setFeaturesText("");
      return;
    }
    setName(editingPlan.name);
    setDescription(editingPlan.description);
    setPriceMonthly(editingPlan.priceMonthly);
    setFeaturesText(featuresToText(editingPlan.features));
  }, [editingPlan]);

  function selectPlan(planId: string) {
    setEditingId(planId);
    setMessage("");
    setError("");
    setPriceError("");
    setShowExtraForm(false);
  }

  function validatePaidPrice(value: number): string {
    if (!Number.isFinite(value)) return "Enter a valid monthly price.";
    if (value < 1) return "Paid plans must be at least $1.00 per month.";
    if (value > 9999) return "Monthly price cannot exceed $9,999.00.";
    return "";
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editingPlan) return;
    if (!mutationLock.begin()) return;

    setIsSaving(true);
    setMessage("");
    setError("");
    setPriceError("");

    try {
      const payload: Record<string, unknown> = {
        name,
        description,
        features: textToFeatures(featuresText),
      };
      if (!isFreePlan) {
        const nextPrice = Number.isFinite(priceMonthly) ? priceMonthly : 0;
        const priceIssue = validatePaidPrice(nextPrice);
        if (priceIssue) {
          setPriceError(priceIssue);
          throw new Error(priceIssue);
        }
        payload.priceMonthly = nextPrice;
      }

      const res = await fetchWithTimeout(`/api/plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: 15_000,
      });
      const data = await readJsonSafe<{ plan?: PlanResponse; error?: string }>(res);
      if (!res.ok || !data.plan) throw new Error(data.error || "Plan could not be saved.");

      setPlans((current) =>
        current.map((plan) => (plan.id === data.plan!.id ? data.plan! : plan))
      );
      setMessage(`${data.plan.name} saved.`);
    } catch (err) {
      setError(
        err instanceof RequestTimeoutError
          ? "The plan could not be saved because the request timed out. Try again."
          : err instanceof Error
            ? err.message
            : "Plan could not be saved."
      );
    } finally {
      setIsSaving(false);
      mutationLock.end();
    }
  }

  async function toggleActive() {
    if (!editingPlan) return;
    if (!mutationLock.begin()) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetchWithTimeout(`/api/plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !editingPlan.isActive }),
        timeoutMs: 15_000,
      });
      const data = await readJsonSafe<{ plan?: PlanResponse; error?: string }>(res);
      if (!res.ok || !data.plan)
        throw new Error(data.error || "Plan status could not be updated.");

      setPlans((current) =>
        current.map((plan) => (plan.id === data.plan!.id ? data.plan! : plan))
      );
      setMessage(
        data.plan.isActive
          ? `${data.plan.name} is now offered to subscribers.`
          : `${data.plan.name} is hidden from new subscribers.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Plan status could not be updated."
      );
    } finally {
      setIsSaving(false);
      mutationLock.end();
    }
  }

  async function handleDeletePlan(planId: string, planName: string) {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Delete "${planName}"? Default Free, Basic, and Premium plans cannot be deleted — hide them instead.`
      );
      if (!ok) return;
    }
    if (!mutationLock.begin()) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetchWithTimeout(`/api/plans/${planId}?hard=true`, {
        method: "DELETE",
        timeoutMs: 15_000,
      });
      const data = await readJsonSafe<{
        deleted?: boolean;
        error?: string;
      }>(res);
      if (!res.ok || !data.deleted) {
        throw new Error(data.error || "Plan could not be deleted.");
      }

      const remaining = sortPlans(plans.filter((p) => p.id !== planId));
      setPlans(remaining);
      if (editingId === planId) setEditingId(remaining[0]?.id ?? null);
      setMessage(`${planName} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan could not be deleted.");
    } finally {
      setIsSaving(false);
      mutationLock.end();
    }
  }

  async function handleSyncStripe() {
    if (!mutationLock.begin()) return;
    setIsSyncingStripe(true);
    setMessage("");
    setError("");
    try {
      const res = await fetchWithTimeout("/api/creator/stripe-sync", {
        method: "POST",
        timeoutMs: 30_000,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        synced?: number;
        skipped?: number;
        failed?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not connect checkout.");
      }
      const reloaded = await fetch("/api/plans", { cache: "no-store" });
      const reloadedData = (await reloaded.json().catch(() => ({}))) as {
        plans?: PlanResponse[];
      };
      if (reloaded.ok && reloadedData.plans) setPlans(reloadedData.plans);
      const failed = data.failed ?? 0;
      setMessage(
        failed > 0
          ? `Connected ${data.synced ?? 0} paid plans (${failed} still need attention).`
          : "Paid plans are ready for checkout."
      );
    } catch (err) {
      setError(
        err instanceof RequestTimeoutError
          ? "Connecting checkout timed out. Try again."
          : err instanceof Error
            ? err.message
            : "Could not connect checkout."
      );
    } finally {
      setIsSyncingStripe(false);
      mutationLock.end();
    }
  }

  async function handleCreatePlan(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmedName = extraName.trim();
    if (!trimmedName) {
      setError("Give the extra plan a name.");
      return;
    }
    if (extraAccess !== "free") {
      const priceIssue = validatePaidPrice(extraPrice);
      if (priceIssue) {
        setPriceError(priceIssue);
        setError(priceIssue);
        return;
      }
    }
    if (!mutationLock.begin()) return;

    setIsCreating(true);
    setMessage("");
    setError("");
    setPriceError("");

    try {
      const res = await fetchWithTimeout("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName.slice(0, 80),
          description: "",
          priceMonthly: extraAccess === "free" ? 0 : extraPrice,
          accessLevel: extraAccess,
          features: [],
          isActive: false,
        }),
        timeoutMs: 15_000,
      });
      const data = await readJsonSafe<{ plan?: PlanResponse; error?: string }>(res);
      if (!res.ok || !data.plan) throw new Error(data.error || "Plan could not be created.");

      setPlans((current) => [...current, data.plan!]);
      setEditingId(data.plan.id);
      setShowExtraForm(false);
      setExtraName("");
      setExtraAccess("basic");
      setExtraPrice(9);
      setMessage("Extra plan created. Edit the details, then turn it on when you are ready.");
    } catch (err) {
      setError(
        err instanceof RequestTimeoutError
          ? "The plan could not be created because the request timed out. Try again."
          : err instanceof Error
            ? err.message
            : "Plan could not be created."
      );
    } finally {
      setIsCreating(false);
      mutationLock.end();
    }
  }

  return (
    <CreatorShell>
      <div className="space-y-8 min-w-0">
        <DashboardHeader
          eyebrow="Membership"
          title="Subscription Plans"
          subtitle="Pick a plan, then edit it on the right. Free, Basic, and Premium are your default tiers."
          action={
            <Button
              variant="primary"
              icon={<PlusCircle className="w-4 h-4 ml-1" />}
              onClick={() => {
                setShowExtraForm(true);
                setError("");
                setMessage("");
                setPriceError("");
              }}
              disabled={isCreating || isLoading}
            >
              {isCreating ? "Adding…" : "Add extra plan"}
            </Button>
          }
        />

        {(error || message) && (
          <div
            role={error ? "alert" : "status"}
            className={cn(
              "rounded-2xl border p-4 text-sm font-bold",
              error
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            )}
          >
            {error || message}
          </div>
        )}

        {showExtraForm && (
          <form
            onSubmit={handleCreatePlan}
            className="bg-white rounded-[2rem] border border-slate-200 p-5 sm:p-8 space-y-6 min-w-0"
          >
            <div>
              <h2 className="text-xl font-black font-display text-slate-900">Add extra plan</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Choose the access tier first. The platform quotas for that tier stay fixed even if you write different marketing copy.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="extra-plan-name" className={labelClass}>
                  Plan name
                </label>
                <input
                  id="extra-plan-name"
                  type="text"
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  required
                  maxLength={80}
                  placeholder="e.g. Studio Plus"
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="extra-plan-tier" className={labelClass}>
                  Access tier
                </label>
                <select
                  id="extra-plan-tier"
                  value={extraAccess}
                  onChange={(e) => setExtraAccess(e.target.value as PlanAccessLevel)}
                  className={cn(fieldClass, "appearance-none")}
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="extra-plan-price" className={labelClass}>
                  Monthly price
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                    $
                  </span>
                  <input
                    id="extra-plan-price"
                    type="number"
                    inputMode="decimal"
                    min={extraAccess === "free" ? 0 : 1}
                    step="0.01"
                    value={extraAccess === "free" ? 0 : extraPrice}
                    onChange={(e) => {
                      setExtraPrice(Number(e.target.value) || 0);
                      setPriceError("");
                    }}
                    disabled={extraAccess === "free"}
                    className={cn(
                      fieldClass,
                      "pl-8",
                      extraAccess === "free" && "bg-slate-50 text-slate-400 cursor-not-allowed",
                      priceError && extraAccess !== "free" && "border-red-400"
                    )}
                  />
                </div>
                {priceError && extraAccess !== "free" ? (
                  <p className="text-xs font-medium text-red-600">{priceError}</p>
                ) : (
                  <p className="text-xs font-medium text-slate-500">
                    {extraAccess === "free" ? "Free stays at $0." : "Minimum $1.00 for paid plans."}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="primary" disabled={isCreating}>
                {isCreating ? "Adding…" : "Create extra plan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowExtraForm(false);
                  setPriceError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-5 sm:p-8 lg:p-10 text-sm font-bold text-slate-500">
            Loading plans…
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-5 sm:p-8 lg:p-10">
            <p className="text-lg font-black text-slate-800 mb-2">No plans yet</p>
            <p className="text-sm font-medium text-slate-500 mb-6">
              Default Free, Basic, and Premium plans should appear automatically. Create one to get started.
            </p>
            <Button variant="primary" onClick={() => setShowExtraForm(true)} disabled={isCreating}>
              {isCreating ? "Adding…" : "Add a plan"}
            </Button>
          </div>
        ) : (
          <MotionReveal className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6 lg:gap-8 items-start min-w-0">
            <aside className="bg-white rounded-[2rem] border border-slate-200 p-3 sm:p-4 min-w-0 w-full">
              <p className="px-3 pt-2 pb-3 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                Your plans
              </p>
              <div className="flex flex-col gap-2 min-w-0">
                {orderedPlans.map((plan) => {
                  const selected = plan.id === editingId;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => selectPlan(plan.id)}
                      className={cn(
                        "w-full min-w-0 text-left rounded-2xl border px-4 py-3.5 transition-all",
                        selected
                          ? "border-teal-400 bg-teal-50/70 ring-2 ring-teal-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                              selected
                                ? "bg-white text-teal-600 border-teal-100"
                                : "bg-slate-50 text-slate-500 border-slate-100"
                            )}
                          >
                            {ACCESS_ICON[plan.accessLevel]}
                          </span>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 truncate">{plan.name}</p>
                            <p className="text-xs font-bold text-slate-500 mt-0.5">
                              {formatPrice(plan.priceMonthly, plan.accessLevel)}
                              {plan.accessLevel !== "free" ? "/mo" : ""}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="default"
                          className={cn(
                            "shrink-0 border text-[10px]",
                            plan.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-amber-50 text-amber-800 border-amber-100"
                          )}
                        >
                          {plan.isActive ? "On" : "Off"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 capitalize">
                          {plan.accessLevel}
                        </span>
                        {plan.isDefault ? (
                          <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md">
                            Default
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                            Extra
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="bg-white rounded-[2rem] border border-slate-200 p-5 sm:p-8 min-w-0 w-full overflow-hidden">
              {editingPlan ? (
                <form onSubmit={handleSave} className="space-y-7 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black font-display text-slate-900 break-words">
                        Edit {editingPlan.name}
                      </h2>
                      <p className="text-sm font-medium text-slate-500 mt-1 leading-relaxed break-words">
                        {editingPlan.isDefault
                          ? "This is a default tier. You can rename it and change what it includes."
                          : "This is an extra plan. You can delete it if nobody is subscribed to it."}
                      </p>
                    </div>
                    <Badge
                      variant="default"
                      className={cn(
                        "border self-start",
                        editingPlan.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-amber-50 text-amber-800 border-amber-100"
                      )}
                    >
                      {editingPlan.isActive ? "Offered to subscribers" : "Hidden from subscribers"}
                    </Badge>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label htmlFor="plan-name" className={labelClass}>
                        Plan name
                      </label>
                      <input
                        id="plan-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={80}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="plan-price" className={labelClass}>
                        Monthly price
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                          $
                        </span>
                        <input
                          id="plan-price"
                          type="number"
                          inputMode="decimal"
                          min={isFreePlan ? 0 : 1}
                          step="0.01"
                          value={isFreePlan ? 0 : priceMonthly}
                          onChange={(e) => {
                            setPriceMonthly(Number(e.target.value) || 0);
                            setPriceError("");
                          }}
                          disabled={isFreePlan}
                          aria-invalid={Boolean(priceError) && !isFreePlan}
                          className={cn(
                            fieldClass,
                            "pl-8",
                            isFreePlan && "bg-slate-50 text-slate-400 cursor-not-allowed",
                            priceError && !isFreePlan && "border-red-400"
                          )}
                        />
                      </div>
                      {priceError && !isFreePlan ? (
                        <p id="plan-price-error" className="text-xs font-medium text-red-600">
                          {priceError}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-slate-500">
                          {isFreePlan
                            ? "Free stays at $0."
                            : "New checkouts use this price. Existing members keep their current price until they change plan."}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <p className={labelClass}>Access tier</p>
                      <div className="px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 capitalize">
                        {editingPlan.accessLevel}
                        <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Locked
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-500 leading-relaxed break-words">
                        Controls which content this plan can unlock. Download quotas are set by the platform for this tier.
                      </p>
                      {(() => {
                        const limits = serializeTierLimits(editingPlan.accessLevel);
                        return (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-slate-50 text-slate-600 border-slate-200">
                              {limits.monthlyDownloads === null
                                ? "Unlimited downloads"
                                : `${limits.monthlyDownloads} downloads / 30 days`}
                            </span>
                            {limits.features.slice(0, 2).map((feature) => (
                              <span
                                key={feature}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border bg-white text-slate-600 border-slate-200"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="plan-description" className={labelClass}>
                        Short description
                      </label>
                      <textarea
                        id="plan-description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={600}
                        placeholder="One or two sentences subscribers will see."
                        className={cn(fieldClass, "resize-none font-medium min-h-[88px]")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="plan-features" className={labelClass}>
                      What’s included (one line each)
                    </label>
                    <textarea
                      id="plan-features"
                      rows={8}
                      value={featuresText}
                      onChange={(e) => setFeaturesText(e.target.value)}
                      placeholder={"Full video library.\nPremium downloads.\nTemplates."}
                      className={cn(fieldClass, "resize-y font-medium min-h-[180px]")}
                    />
                    <p className="text-xs font-medium text-slate-500 leading-relaxed break-words">
                      Marketing copy for subscribers. Platform limits for this tier still apply even if a line here says otherwise.
                    </p>
                    {textToFeatures(featuresText).length > 0 && (
                      <ul className="pt-2 space-y-2">
                        {textToFeatures(featuresText).slice(0, 6).map((feature, i) => (
                          <li key={`${feature}-${i}`} className="flex items-start gap-2 text-sm font-medium text-slate-600 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="break-words min-w-0">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {isPaidPlan && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 space-y-3">
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">
                        Saving a paid price updates checkout for new subscribers. Existing members keep
                        their current price until they change plan.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={cn(
                            "text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                            editingPlan.stripePriceId
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-amber-50 text-amber-800 border-amber-100"
                          )}
                        >
                          {editingPlan.stripePriceId ? "Checkout ready" : "Checkout not ready"}
                        </span>
                        <button
                          type="button"
                          onClick={handleSyncStripe}
                          disabled={isSyncingStripe || isSaving}
                          className="text-sm font-black text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          {isSyncingStripe ? "Syncing…" : "Sync checkout"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 pt-2 border-t border-slate-100">
                    <Button type="submit" variant="primary" disabled={isSaving} className="w-full sm:w-auto">
                      {isSaving ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={toggleActive}
                      disabled={isSaving}
                      className="w-full sm:w-auto"
                    >
                      {editingPlan.isActive ? "Hide from subscribers" : "Offer this plan"}
                    </Button>
                    {!editingPlan.isDefault && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleDeletePlan(editingPlan.id, editingPlan.name)}
                        disabled={isSaving}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 w-full sm:w-auto"
                        icon={<Trash2 className="w-4 h-4" />}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </form>
              ) : (
                <p className="text-sm font-bold text-slate-500">Select a plan to edit it.</p>
              )}
            </section>
          </MotionReveal>
        )}
      </div>
    </CreatorShell>
  );
}
