import type { PlanAccessLevel } from "@/types/plan";
import type { PaymentStatus } from "@/types/payment";
import type { SubscriptionStatus } from "@/types/subscription";
import type { NotificationCategory } from "@/types/notification";

export type AdminTrendPoint = {
  label: string;
  valueCents: number;
};

export type AdminAcquisitionPoint = {
  label: string;
  count: number;
};

export type AdminActivityType =
  | "subscription_started"
  | "subscription_canceled"
  | "payment_succeeded"
  | "payment_failed"
  | "content_published"
  | "user_joined";

export type AdminActivityItem = {
  id: string;
  type: AdminActivityType;
  text: string;
  occurredAt: string;
};

export type AdminOverviewMetrics = {
  totalUsers: number;
  activeSubscribers: number;
  activeCreators: number;
  monthlyRevenueCents: number;
  failedPayments: number;
  cancelledSubscribers30d: number;
  publishedContent: number;
  conversionRatePercent: number;
};

export type AdminOverviewResponse = {
  metrics: AdminOverviewMetrics;
  health: {
    paymentSuccessRatePercent: number;
    userRetentionRatePercent: number;
  };
  trend: AdminTrendPoint[];
  recentActivity: AdminActivityItem[];
};

export type AdminUserRow = {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: "subscriber" | "creator" | "admin";
  highestPlanLabel: "Free" | "Basic" | "Premium" | "—";
  status: "Active" | "Suspended" | "Deleted";
  joinedAt: string;
};

export type AdminUsersResponse = {
  metrics: {
    totalUsers: number;
    activeAccounts: number;
    suspended: number;
    deactivated: number;
  };
  users: AdminUserRow[];
};

export type AdminCreatorRow = {
  id: string;
  clerkUserId: string;
  creatorSlug: string;
  creatorName: string;
  email: string;
  avatarUrl: string;
  subscribersCount: number;
  paidSubscribersCount: number;
  contentCount: number;
  mrrCents: number;
  status: "Active" | "Review";
  createdAt: string;
};

export type AdminCreatorsResponse = {
  metrics: {
    totalCreators: number;
    totalCreatorMrrCents: number;
    avgAudience: number;
    pendingReview: number;
  };
  creators: AdminCreatorRow[];
};

export type AdminSubscriberRow = {
  subscriptionId: string;
  subscriberClerkUserId: string;
  name: string;
  email: string;
  avatarUrl: string;
  creatorName: string;
  creatorSlug: string;
  plan: "Free" | "Basic" | "Premium";
  accessLevel: PlanAccessLevel;
  status: SubscriptionStatus;
  renewalLabel: string;
  engagement: "High" | "Medium" | "Low";
  startedAt: string;
};

export type AdminSubscribersResponse = {
  metrics: {
    activeSubscribers: number;
    premiumRatioPercent: number;
    highEngagementCount: number;
    churnRiskCount: number;
  };
  subscribers: AdminSubscriberRow[];
  planDistribution: {
    freePercent: number;
    basicPercent: number;
    premiumPercent: number;
  };
};

export type AdminPlanGroup = {
  accessLevel: PlanAccessLevel;
  label: "Free" | "Basic" | "Premium";
  planCount: number;
  activePlanCount: number;
  totalSubscribers: number;
  averagePrice: number;
  totalMrrCents: number;
  topCreatorName: string;
};

export type AdminPlanRow = {
  id: string;
  creatorClerkUserId: string;
  creatorName: string;
  creatorSlug: string;
  name: string;
  accessLevel: PlanAccessLevel;
  priceMonthly: number;
  isActive: boolean;
  subscribersCount: number;
};

export type AdminPlansResponse = {
  metrics: {
    totalActivePlans: number;
    mostPopularLabel: string;
    topConversionLabel: string;
  };
  groups: AdminPlanGroup[];
  plans: AdminPlanRow[];
};

export type AdminContentRow = {
  id: string;
  title: string;
  contentType: "video" | "article" | "file";
  fileSubtype: "pdf" | "zip" | "rar" | "";
  accessLevel: PlanAccessLevel;
  status: "draft" | "published" | "archived";
  creatorName: string;
  creatorSlug: string;
  viewsCount: number;
  downloadsCount: number;
  createdAt: string;
};

export type AdminContentResponse = {
  metrics: {
    totalPublished: number;
    totalResources: number;
    totalViews: number;
    pendingReview: number;
  };
  content: AdminContentRow[];
};

export type AdminSubscriptionRow = {
  id: string;
  subscriberName: string;
  subscriberEmail: string;
  creatorName: string;
  creatorSlug: string;
  plan: "Free" | "Basic" | "Premium";
  accessLevel: PlanAccessLevel;
  status: SubscriptionStatus;
  startedAt: string;
  renewalLabel: string;
  priceMonthly: number;
};

export type AdminSubscriptionsResponse = {
  metrics: {
    activeSubscriptions: number;
    renewalsToday: number;
    failedCharges: number;
    pendingChurn: number;
  };
  subscriptions: AdminSubscriptionRow[];
  statusBreakdown: {
    active: number;
    cancelled: number;
    pastDue: number;
  };
};

export type AdminPaymentRow = {
  id: string;
  subscriberName: string;
  subscriberEmail: string;
  creatorName: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  accessLevel: PlanAccessLevel | null;
  paymentMethodLabel: string;
  paidAt: string | null;
  createdAt: string;
  receiptUrl: string;
  hasStripeReference: boolean;
};

export type AdminPaymentsResponse = {
  metrics: {
    volume30dCents: number;
    successRatePercent: number;
    failedCharges: number;
    refunds: number;
  };
  payments: AdminPaymentRow[];
  failed: {
    failedCount: number;
    atRiskCents: number;
    retryingCount: number;
    actionNeededCount: number;
  };
};

export type AdminNotificationRow = {
  id: string;
  category: NotificationCategory;
  title: string;
  recipientName: string;
  recipientClerkUserId: string;
  isRead: boolean;
  createdAt: string;
};

export type AdminNotificationsResponse = {
  metrics: {
    totalSystemAlerts: number;
    deliverySuccessPercent: number;
    failedDelivery: number;
  };
  notifications: AdminNotificationRow[];
};

export type AdminBroadcastInput = {
  audience: "all" | "subscribers" | "creators" | "admins";
  subject: string;
  body: string;
};

export type AdminBroadcastResult = {
  recipientsCount: number;
};

export type AdminAnalyticsTopContentItem = {
  id: string;
  title: string;
  primaryStat: string;
  creatorName: string;
};

export type AdminAnalyticsRange = "1m" | "3m" | "6m" | "12m";

export type AdminAnalyticsResponse = {
  metrics: {
    platformMrrCents: number;
    activeSubscribers: number;
    totalViews: number;
    premiumConversionPercent: number;
  };
  trend: AdminTrendPoint[];
  acquisition: AdminAcquisitionPoint[];
  topContent: AdminAnalyticsTopContentItem[];
  churnRatePercent: number;
  failedPaymentRatioPercent: number;
  range: AdminAnalyticsRange;
};

export type AdminUserSubscriptionRow = {
  id: string;
  creatorName: string;
  creatorSlug: string;
  plan: "Free" | "Basic" | "Premium";
  accessLevel: PlanAccessLevel;
  status: SubscriptionStatus;
  priceMonthly: number;
  startedAt: string;
  renewalLabel: string;
};

export type AdminUserPaymentRow = {
  id: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  paidAt: string | null;
  receiptUrl: string;
};

export type AdminUserDetailResponse = {
  user: AdminUserRow & {
    bio: string;
    fullName: string;
    displayName: string;
    accountStatus: "active" | "suspended" | "deleted";
  };
  metrics: {
    totalSpentCents: number;
    activeSubscriptions: number;
    paidSubscriptions: number;
    failedPayments: number;
  };
  subscriptions: AdminUserSubscriptionRow[];
  payments: AdminUserPaymentRow[];
};

export type AdminPlatformSettingsResponse = {
  platformDisplayName: string;
  supportEmail: string;
  defaultSubscriberTier: "free" | "pending";
  defaultCreatorStatus: "review" | "active";
  platformCurrency: "usd" | "eur" | "gbp";
  defaultBillingCycle: "monthly" | "annually";
  renewalReminderLeadDays: number;
  failureAlertCadence: "immediate" | "daily";
  maintenanceMode: boolean;
};

export type AdminPlatformSettingsInput = Partial<AdminPlatformSettingsResponse>;
