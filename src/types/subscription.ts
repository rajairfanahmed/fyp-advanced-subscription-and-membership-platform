import type { PlanAccessLevel, PlanBillingCycle } from "@/types/plan";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired";

export type SubscriptionDownloadQuota = {
  /** Total downloads allowed in the current 30-day window. `null` = unlimited. */
  monthlyLimit: number | null;
  /** Downloads consumed in the current window. */
  usedThisPeriod: number;
  /** Downloads still available before the cap kicks in. `null` = unlimited. */
  remaining: number | null;
  /** ISO timestamp when the current window ends and counters reset. */
  windowEnd: string;
};

export type SubscriptionResponse = {
  id: string;
  subscriberClerkUserId: string;
  subscriberProfileId: string | null;
  creatorClerkUserId: string;
  creatorProfileId: string | null;
  creatorName: string;
  creatorSlug: string;
  creatorAvatarUrl: string;
  planId: string | null;
  planName: string;
  accessLevel: PlanAccessLevel;
  status: SubscriptionStatus;
  billingCycle: PlanBillingCycle;
  currency: string;
  priceMonthly: number;
  startedAt: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  /** Snapshot of the 30-day download quota for this (subscriber → creator) pair. */
  downloadQuota: SubscriptionDownloadQuota;
  createdAt: string;
  updatedAt: string;
};

/** Body of POST /api/subscriptions (free-tier subscribe). */
export type SubscriptionFreeSubscribeInput = {
  creatorClerkUserId?: unknown;
  creatorSlug?: unknown;
};

/** Body of PATCH /api/subscriptions/[id]. */
export type SubscriptionUpdateInput = {
  cancel?: unknown;
  reactivate?: unknown;
};
