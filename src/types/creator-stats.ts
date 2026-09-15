import type { PlanAccessLevel } from "@/types/plan";
import type { PaymentResponse } from "@/types/payment";
import type { SubscriptionStatus } from "@/types/subscription";

export type CreatorOverviewMetrics = {
  monthlyRevenueCents: number;
  activeSubscribers: number;
  paidSubscribers: number;
  freeSubscribers: number;
  basicSubscribers: number;
  premiumSubscribers: number;
  contentViews: number;
  cancelledSubscribers30d: number;
  pendingCancellations: number;
  conversionRatePercent: number;
};

export type CreatorTopContentItem = {
  id: string;
  title: string;
  contentType: "video" | "article" | "file";
  viewsCount: number;
  downloadsCount: number;
  publishedAt: string | null;
};

export type CreatorActivityItem = {
  id: string;
  type: "subscribed" | "payment" | "cancelled";
  text: string;
  occurredAt: string;
};

export type CreatorPublishReadiness = {
  /** True only when every required step below is satisfied. */
  ready: boolean;
  hasCreatorName: boolean;
  hasBio: boolean;
  hasAvatar: boolean;
  hasPublishedContent: boolean;
  hasActivePlan: boolean;
  /** True once the creator flips Profile Status from draft to published. */
  isPublished: boolean;
};

export type CreatorOverviewResponse = {
  creatorName: string;
  creatorSlug: string;
  profileStatus: "draft" | "published";
  metrics: CreatorOverviewMetrics;
  topContent: CreatorTopContentItem[];
  recentActivity: CreatorActivityItem[];
  publishReadiness: CreatorPublishReadiness;
};

export type CreatorMembershipLifecycle =
  | "following"
  | "active"
  | "trialing"
  | "cancel_scheduled"
  | "past_due"
  | "canceled"
  | "expired";

export type CreatorSubscriberRow = {
  subscriptionId: string;
  subscriberClerkUserId: string;
  name: string;
  email: string;
  avatarUrl: string;
  plan: "Free" | "Basic" | "Premium";
  accessLevel: PlanAccessLevel;
  priceMonthly: number;
  status: SubscriptionStatus;
  lifecycle: CreatorMembershipLifecycle;
  renewalLabel: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
  daysRemainingLabel: string;
  quotaUsed: number;
  quotaLimit: number | null;
  quotaLabel: string;
  canScheduleCancel: boolean;
  canKeepMembership: boolean;
  canRemoveFollower: boolean;
  startedAt: string;
};

export type CreatorSubscribersResponse = {
  metrics: {
    totalSubscribers: number;
    freeSubscribers: number;
    basicSubscribers: number;
    premiumSubscribers: number;
    paidSubscribers: number;
    scheduledCancellations: number;
    pastDue: number;
    churnRisk: number;
  };
  subscribers: CreatorSubscriberRow[];
};

export type CreatorRevenuePoint = {
  label: string;
  valueCents: number;
};

export type CreatorRevenueTierBreakdown = {
  basicMembers: number;
  basicMrrCents: number;
  premiumMembers: number;
  premiumMrrCents: number;
};

export type CreatorRevenueResponse = {
  metrics: {
    mrrCents: number;
    arpuCents: number;
    failedPayments: number;
    failedPayments30d: number;
    failedPaymentsAllTime: number;
    churnRatePercent: number;
  };
  mrrByTier: CreatorRevenueTierBreakdown;
  trend: CreatorRevenuePoint[];
  recentPayments: PaymentResponse[];
  forecast: {
    upcomingRenewalsCount: number;
    forecastedRevenueCents: number;
    windowDays: number;
  };
};

export type CreatorAnalyticsTopContentItem = {
  id: string;
  title: string;
  primaryStat: string;
};

export type CreatorAnalyticsDailyPoint = {
  /** ISO date (UTC midnight) for the snapshot day. */
  date: string;
  /** Day label, e.g. "Apr 12". Convenience for chart labels. */
  label: string;
  totalSubscribers: number;
  paidSubscribers: number;
  monthlyRecurringCents: number;
  newSubscribersToday: number;
  churnedSubscribersToday: number;
  totalViews: number;
  totalDownloads: number;
};

export type CreatorAnalyticsResponse = {
  metrics: {
    totalContentViews: number;
    totalDownloads: number;
    fileDownloadRatePercent: number;
    premiumConversionPercent: number;
    averageWatchCompletionPercent: number | null;
  };
  topContent: CreatorAnalyticsTopContentItem[];
  formatSplit: {
    videos: number;
    files: number;
    articles: number;
  };
  /**
   * Up to 30 days of daily Analytics snapshots, oldest-first. Empty
   * when the rollup job hasn't produced any data for this creator yet.
   */
  daily: CreatorAnalyticsDailyPoint[];
};
