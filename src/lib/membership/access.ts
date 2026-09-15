import { PLAN_TIER_RANK } from "@/lib/membership/labels";
import type { PlanAccessLevel } from "@/types/plan";
import type { RequiredPlan } from "@/types/content";
import type { SubscriptionStatus } from "@/types/subscription";

/** Clock skew when comparing Stripe period end to local time. */
export const PERIOD_SKEW_MS = 2 * 60 * 1000;

export const CONSUME_STATUSES: readonly SubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
];

export type AccessSubscriptionSlice = {
  accessLevel: string | null | undefined;
  status: string | null | undefined;
  currentPeriodEnd?: Date | string | null;
};

export function asAccessLevel(value: string | null | undefined): PlanAccessLevel {
  if (value === "basic" || value === "premium") return value;
  return "free";
}

export function accessRank(level: string | null | undefined): number {
  return PLAN_TIER_RANK[asAccessLevel(level)] ?? 0;
}

export function rankMeetsRequired(
  accessLevel: string | null | undefined,
  requiredPlan: RequiredPlan
): boolean {
  return accessRank(accessLevel) >= accessRank(requiredPlan);
}

function periodEndMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Whether a local subscription row still grants paid (or free-follow) consumption.
 * `past_due` is Stripe's retry window only — not unpaid/canceled/expired.
 * Paid rows with a period end in the past are denied even if status was left active.
 */
export function subscriptionGrantsAccess(sub: AccessSubscriptionSlice): boolean {
  const status = (sub.status || "") as SubscriptionStatus;
  if (status === "canceled" || status === "expired") return false;
  if (!CONSUME_STATUSES.includes(status)) return false;

  const level = asAccessLevel(sub.accessLevel);
  if (level === "free") {
    return status === "active" || status === "trialing";
  }

  const end = periodEndMs(sub.currentPeriodEnd);
  if (end !== null && end + PERIOD_SKEW_MS < Date.now()) return false;
  return true;
}

export function subscriptionMeetsContent(
  sub: AccessSubscriptionSlice | null | undefined,
  requiredPlan: RequiredPlan
): boolean {
  if (requiredPlan === "free") return true;
  if (!sub || !subscriptionGrantsAccess(sub)) return false;
  return rankMeetsRequired(sub.accessLevel, requiredPlan);
}

export function formatAccessUntilDate(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const date = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function paidAccessCopy(input: {
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | Date | null;
  creatorName?: string;
}): string {
  const until = formatAccessUntilDate(input.currentPeriodEnd);
  const who = input.creatorName ? ` with ${input.creatorName}` : "";
  if (input.status === "past_due") {
    return until
      ? `Payment failed${who}. Update your card to keep access after ${until}.`
      : `Payment failed${who}. Update your card to keep access.`;
  }
  if (input.cancelAtPeriodEnd && until) {
    return `Cancellation is scheduled${who}. You keep access until ${until}.`;
  }
  return until ? `Current period ends ${until}.` : "";
}
