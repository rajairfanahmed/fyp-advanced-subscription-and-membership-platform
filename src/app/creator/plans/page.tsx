"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MotionReveal } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CreditCard,
  CheckCircle2,
  PlusCircle,
  Edit3,
  ShieldAlert,
  Globe,
  Lock,
  Zap,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanAccessLevel, PlanResponse } from "@/types/plan";

const ACCESS_ICON: Record<PlanAccessLevel, React.ReactNode> = {
  free: <Globe className="w-6 h-6 text-slate-500" />,
  basic: <Lock className="w-6 h-6 text-teal-500" />,
  premium: <Zap className="w-6 h-6 text-sky-500" />,
};

function featuresToText(features: string[]) {
  return features.join("\n");
}

function textToFeatures(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [featuresText, setFeaturesText] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "features">("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editingPlan = useMemo(
    () => plans.find((plan) => plan.id === editingId) ?? null,
    [plans, editingId]
  );
  const isFreePlan = editingPlan?.accessLevel === "free";

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        const res = await fetch("/api/plans", { cache: "no-store" });
        const data = (await res.json()) as { plans?: PlanResponse[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Plans could not be loaded.");
        if (cancelled) return;
        const list = data.plans ?? [];
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
    setActiveTab("overview");
    setMessage("");
    setError("");
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editingPlan) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const payload: Record<string, unknown> = {
        name,
        description,
        features: textToFeatures(featuresText),
      };
      if (!isFreePlan) {
        payload.priceMonthly = Number.isFinite(priceMonthly) ? priceMonthly : 0;
      }

      const res = await fetch(`/api/plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { plan?: PlanResponse; error?: string };
      if (!res.ok || !data.plan) throw new Error(data.error || "Plan could not be saved.");

      setPlans((current) =>
        current.map((plan) => (plan.id === data.plan!.id ? data.plan! : plan))
      );
      setMessage(`${data.plan.name} plan saved successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive() {
    if (!editingPlan) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !editingPlan.isActive }),
      });
      const data = (await res.json()) as { plan?: PlanResponse; error?: string };
      if (!res.ok || !data.plan)
        throw new Error(data.error || "Plan status could not be updated.");

      setPlans((current) =>
        current.map((plan) => (plan.id === data.plan!.id ? data.plan! : plan))
      );
      setMessage(
        data.plan.isActive
          ? `${data.plan.name} plan reactivated.`
          : `${data.plan.name} plan deactivated.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Plan status could not be updated."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeletePlan(planId: string, planName: string) {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Delete the "${planName}" plan? This cannot be undone. (Default Free, Basic, and Premium tiers can't be deleted — only deactivated.)`
      );
      if (!ok) return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/plans/${planId}?hard=true`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        deleted?: boolean;
        error?: string;
      };
      if (!res.ok || !data.deleted) {
        throw new Error(data.error || "Plan could not be deleted.");
      }

      setPlans((current) => current.filter((p) => p.id !== planId));
      if (editingId === planId) {
        setEditingId(null);
      }
      setMessage(`${planName} plan deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan could not be deleted.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSyncStripe() {
    setIsSyncingStripe(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/creator/stripe-sync", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        synced?: number;
        skipped?: number;
        failed?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Stripe sync failed.");
      }
      const reloaded = await fetch("/api/plans", { cache: "no-store" });
      const reloadedData = (await reloaded.json().catch(() => ({}))) as {
        plans?: PlanResponse[];
      };
      if (reloaded.ok && reloadedData.plans) setPlans(reloadedData.plans);
      const failed = data.failed ?? 0;
      setMessage(
        failed > 0
          ? `Synced ${data.synced ?? 0} plans (${failed} failed — check Stripe keys).`
          : `Synced ${data.synced ?? 0} paid plans to Stripe.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stripe sync failed.");
    } finally {
      setIsSyncingStripe(false);
    }
  }

  async function handleCreatePlan() {
    setIsCreating(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Plan",
          description: "",
          priceMonthly: 9,
          accessLevel: "premium",
          features: [],
          isActive: false,
        }),
      });
      const data = (await res.json()) as { plan?: PlanResponse; error?: string };
      if (!res.ok || !data.plan) throw new Error(data.error || "Plan could not be created.");

      setPlans((current) => [...current, data.plan!]);
      setEditingId(data.plan.id);
      setActiveTab("overview");
      setMessage("New plan created. Edit the details and activate it when ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan could not be created.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <CreatorShell>
      <div className="space-y-12">

        <DashboardHeader
          eyebrow="Revenue Model"
          title="Subscription Plans"
          subtitle="Create and manage Free, Basic, and Premium tiers for your paid content membership."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSyncStripe}
                disabled={isSyncingStripe || isLoading}
                title="Reconnect every paid plan to Stripe (creates products and prices for any plans missing one)."
              >
                {isSyncingStripe ? "Syncing…" : "Reconnect Stripe"}
              </Button>
              <Button
                variant="primary"
                icon={<PlusCircle className="w-4 h-4 ml-1" />}
                onClick={handleCreatePlan}
                disabled={isCreating || isLoading}
              >
                {isCreating ? "Creating..." : "Create New Plan"}
              </Button>
            </div>
          }
        />

        {(error || message) && (
          <div
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

        {isLoading ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 text-sm font-bold text-slate-500">
            Loading subscription plans...
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10">
            <p className="text-lg font-black text-slate-700 mb-2">No plans yet</p>
            <p className="text-sm font-medium text-slate-500 mb-6">
              We could not auto-create the default Free, Basic, and Premium plans. Try
              refreshing or click below to create a starter plan.
            </p>
            <Button variant="primary" onClick={handleCreatePlan} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create A Plan"}
            </Button>
          </div>
        ) : (
          <>
            {/* ── Plan Cards ── */}
            <MotionReveal className="grid lg:grid-cols-3 gap-6 md:gap-10">
              {plans.map((plan) => {
                const isEditing = plan.id === editingId;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "bg-white rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col relative group transition-all",
                      isEditing
                        ? "border-teal-400 ring-2 ring-teal-200"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {plan.accessLevel === "premium" && (
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-violet-400" />
                    )}
                    {plan.accessLevel === "basic" && (
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-teal-400" />
                    )}

                    <div className="p-10 pb-8 border-b border-slate-50 relative">
                      <div className="flex items-start justify-between mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
                          {ACCESS_ICON[plan.accessLevel]}
                        </div>
                        <Badge
                          variant="default"
                          className={cn(
                            "border",
                            plan.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          )}
                        >
                          {plan.isActive ? "Active" : "Paused"}
                        </Badge>
                      </div>

                      <h2 className="text-2xl font-black font-display text-slate-900 mb-2">
                        {plan.name}
                      </h2>
                      <p className="text-sm text-slate-400 font-medium h-12 line-clamp-2 leading-relaxed">
                        {plan.description || "Edit this plan to add a short description."}
                      </p>

                      <div className="mt-8 flex items-baseline gap-1">
                        <span className="text-4xl font-black font-display text-slate-900">
                          ${plan.priceMonthly}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {plan.accessLevel === "free" ? "forever" : "per month"}
                        </span>
                      </div>

                      <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50/80 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Tier
                        </span>
                        <span className="text-xs font-black text-slate-900 capitalize">
                          {plan.accessLevel}
                        </span>
                        {plan.isDefault && (
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md uppercase tracking-widest">
                            Default
                          </span>
                        )}
                      </div>

                      {plan.accessLevel !== "free" && plan.priceMonthly > 0 && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest"
                          style={
                            plan.stripePriceId
                              ? { background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)", color: "#047857" }
                              : { background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)", color: "#92400e" }
                          }
                        >
                          {plan.stripePriceId ? "Stripe connected" : "Stripe pending"}
                        </div>
                      )}
                    </div>

                    <div className="p-10 pt-8 flex-1 flex flex-col bg-slate-50/30">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 block">
                        Included Features
                      </h3>
                      <ul className="space-y-5 mb-10 flex-1">
                        {plan.features.length === 0 ? (
                          <li className="text-sm font-medium text-slate-400">
                            No features added yet.
                          </li>
                        ) : (
                          plan.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-4">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span className="text-[13px] font-bold text-slate-600 leading-tight">
                                {feature}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>
                      <div className="pt-6 border-t border-slate-100/60 mt-auto flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 bg-white text-[11px] font-black uppercase tracking-widest h-12 rounded-xl"
                          icon={<Edit3 className="w-3.5 h-3.5 mr-2" />}
                          onClick={() => selectPlan(plan.id)}
                        >
                          {isEditing ? "Editing" : "Edit Plan"}
                        </Button>
                        {!plan.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeletePlan(plan.id, plan.name)}
                            disabled={isSaving}
                            className="h-12 w-12 rounded-xl border border-rose-100 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            aria-label={`Delete ${plan.name} plan`}
                            title={`Delete ${plan.name} plan`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </MotionReveal>

            {/* ── Plan Editor ── */}
            {editingPlan && (
              <MotionReveal>
                <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 border-b border-slate-50 pb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                        <CreditCard className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black font-display text-slate-900">
                          Manage Pricing Settings
                        </h2>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest opacity-80">
                          Editing: {editingPlan.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-100">
                      <button
                        type="button"
                        onClick={() => setActiveTab("overview")}
                        className={cn(
                          "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                          activeTab === "overview"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        General
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("features")}
                        className={cn(
                          "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                          activeTab === "features"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        Features
                      </button>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSave}
                    className="grid lg:grid-cols-2 gap-12"
                  >
                    <div className="space-y-8">
                      {activeTab === "overview" ? (
                        <>
                          <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                              Plan Name
                            </label>
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required
                              maxLength={80}
                              className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-bold text-slate-900"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Monthly Price ($)
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                value={priceMonthly}
                                onChange={(e) =>
                                  setPriceMonthly(Number(e.target.value) || 0)
                                }
                                disabled={isFreePlan}
                                className={cn(
                                  "w-full px-5 py-4 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-bold",
                                  isFreePlan
                                    ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-50/50 border-slate-100 focus:bg-white text-slate-900"
                                )}
                              />
                              {isFreePlan && (
                                <p className="text-[11px] font-medium text-slate-400">
                                  Free plans are always priced at $0.
                                </p>
                              )}
                            </div>
                            <div className="space-y-3">
                              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Access Tier
                              </label>
                              <div className="w-full px-5 py-4 bg-slate-100 border border-slate-100 rounded-2xl font-bold text-slate-500 capitalize flex items-center justify-between">
                                {editingPlan.accessLevel}
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Read-only
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                              Description
                            </label>
                            <textarea
                              rows={3}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              maxLength={600}
                              placeholder="Short summary shown on plan cards."
                              className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-900 resize-none"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            Features (one per line)
                          </label>
                          <textarea
                            rows={10}
                            value={featuresText}
                            onChange={(e) => setFeaturesText(e.target.value)}
                            placeholder={"Full video library.\nPremium downloads.\nTemplates."}
                            className="w-full px-5 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-900 resize-y min-h-[220px]"
                          />
                          <p className="text-[11px] font-medium text-slate-400">
                            Empty lines are removed. Up to 24 features per plan.
                          </p>
                        </div>
                      )}

                      <div className="pt-6 flex flex-wrap gap-4">
                        <Button
                          type="submit"
                          variant="primary"
                          className="h-14 px-8 rounded-2xl"
                          disabled={isSaving}
                        >
                          {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-14 px-8 rounded-2xl font-black text-[11px] uppercase tracking-widest",
                            editingPlan.isActive
                              ? "text-red-600 border-red-100 hover:bg-red-50"
                              : "text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                          )}
                          onClick={toggleActive}
                          disabled={isSaving}
                        >
                          {editingPlan.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </div>

                    <div className="bg-emerald-50/60 rounded-[2rem] border border-emerald-100 p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-5 h-5 text-emerald-700" />
                        </div>
                        <h3 className="font-black text-emerald-900 uppercase tracking-wider text-sm">
                          Stripe Integration Notice
                        </h3>
                      </div>
                      <p className="text-[13px] font-medium text-emerald-900 leading-relaxed mb-6 opacity-90">
                        Stripe is connected. Saving a price change creates a new Stripe
                        Price and links it to this plan. Existing members keep their
                        original price until they renew (Stripe Prices are immutable
                        for active subscribers — that&apos;s by design).
                      </p>
                      <div className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.15em]">
                        Stripe checkout is live.
                      </div>
                    </div>
                  </form>
                </div>
              </MotionReveal>
            )}
          </>
        )}
      </div>
    </CreatorShell>
  );
}
