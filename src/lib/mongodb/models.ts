import {
  AnalyticsPg,
  ContactPg,
  ContentPg,
  CreatorProfilePg,
  NotificationPg,
  PaymentPg,
  PlanPg,
  PlatformSettingsPg,
  SubscriberProfilePg,
  SubscriptionPg,
  UserProfilePg,
} from "@/lib/mongodb/pg-adapter";

type RecordId = { toString(): string };

type Timestamps = {
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<unknown>;
};

export type UserProfileDocument = Timestamps & {
  _id: RecordId;
  clerkUserId: string;
  email: string;
  fullName: string;
  displayName: string;
  role: "subscriber" | "creator";
  accountStatus: "active" | "suspended" | "deleted";
  avatarUrl: string;
  avatarKey: string;
  lastLoginAt: Date | null;
  onboardingCompleted: boolean;
};

export type CreatorProfileDocument = Timestamps & {
  _id: RecordId;
  userProfileId: RecordId;
  clerkUserId: string;
  creatorName: string;
  creatorSlug: string;
  bio: string;
  avatarUrl: string;
  avatarKey: string;
  bannerUrl: string;
  bannerKey: string;
  subscriberCount: number;
  contentCount: number;
  totalViews: number;
  profileStatus: "draft" | "published";
  creatorWorkspaceAlerts?: {
    newSubscriber: boolean;
    renewalSummary: boolean;
    failedPayment: boolean;
    engagementReport: boolean;
    weeklyRevenue: boolean;
  };
  workspaceDefaults?: {
    defaultRequiredPlan: string;
    defaultStatus: string;
  };
};

export type SubscriberProfileDocument = Timestamps & {
  _id: RecordId;
  userProfileId: RecordId;
  clerkUserId: string;
  displayName: string;
  preferredContentTypes: string[];
  notificationPreferences: {
    productUpdates: boolean;
    contentDigests: boolean;
    downloadAlerts: boolean;
    renewalReminders: boolean;
    paymentAlerts: boolean;
    accountNotices: boolean;
    creatorAnnouncements: boolean;
  };
  currentPlanLabel: string;
};

export type ContentDocument = Timestamps & {
  _id: RecordId;
  creatorClerkUserId: string;
  creatorProfileId: RecordId | null;
  title: string;
  slug: string;
  description: string;
  contentType: "video" | "article" | "file";
  requiredPlan: "free" | "basic" | "premium";
  status: "draft" | "published" | "archived";
  thumbnailUrl: string;
  thumbnailKey: string;
  publishedAt: Date | null;
  viewsCount: number;
  downloadsCount: number;
  watchPercentSum: number;
  watchEventsCount: number;
  videoUrl: string;
  videoKey: string;
  videoDurationLabel: string;
  videoProvider: "upload" | "external";
  externalVideoUrl: string;
  articleBody: string;
  articleSummary: string;
  fileSubtype: string;
  fileUrl: string;
  fileKey: string;
  fileSizeLabel: string;
};

export type PlanDocument = Timestamps & {
  _id: RecordId;
  creatorClerkUserId: string;
  creatorProfileId: RecordId | null;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  currency: string;
  billingCycle: string;
  accessLevel: "free" | "basic" | "premium";
  features: string[];
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  stripePriceId: string;
  stripeProductId: string;
};

export type SubscriptionDocument = Timestamps & {
  _id: RecordId;
  subscriberClerkUserId: string;
  subscriberProfileId: RecordId | null;
  creatorClerkUserId: string;
  creatorProfileId: RecordId | null;
  planId: RecordId | null;
  accessLevel: "free" | "basic" | "premium";
  status: "active" | "trialing" | "past_due" | "canceled" | "expired";
  billingCycle: string;
  currency: string;
  priceMonthly: number;
  startedAt: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  quotaPeriodStart: Date | null;
  monthlyDownloadCount: number;
};

export type PaymentDocument = Timestamps & {
  _id: RecordId;
  subscriberClerkUserId: string;
  creatorClerkUserId: string;
  subscriptionId: RecordId | null;
  planId: RecordId | null;
  amountCents: number;
  currency: string;
  status: string;
  description: string;
  stripePaymentIntentId: string;
  stripeChargeId: string;
  stripeInvoiceId: string;
  receiptUrl: string;
  paidAt: Date | null;
};

export type NotificationDocument = Timestamps & {
  _id: RecordId;
  recipientClerkUserId: string;
  category: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  readAt: Date | null;
  metadata: Record<string, unknown>;
};

export type AnalyticsDocument = Timestamps & {
  _id: RecordId;
  creatorClerkUserId: string;
  creatorProfileId: RecordId | null;
  snapshotDate: Date;
  totalSubscribers: number;
  activeSubscribers: number;
  paidSubscribers: number;
  totalRevenueCents: number;
  monthlyRecurringCents: number;
  totalViews: number;
  totalDownloads: number;
  contentCount: number;
  newSubscribersToday: number;
  churnedSubscribersToday: number;
};

export type ContactDocument = Timestamps & {
  _id: RecordId;
  fullName: string;
  email: string;
  role: string;
  topic: string;
  message: string;
  submitterClerkUserId: string;
  deliveredToAdminCount: number;
  status: string;
  metadata: Record<string, unknown>;
};

export type PlatformSettingsDocument = Timestamps & {
  _id: RecordId;
  singletonKey: string;
  platformDisplayName: string;
  supportEmail: string;
  defaultSubscriberTier: string;
  defaultCreatorStatus: string;
  platformCurrency: string;
  defaultBillingCycle: string;
  renewalReminderLeadDays: number;
  failureAlertCadence: string;
  maintenanceMode: boolean;
  platformFeeBps: number;
};

type QueryLike<T> = Promise<T[]> & {
  sort: (spec?: unknown) => QueryLike<T>;
  limit: (n?: number) => QueryLike<T>;
  skip: (n?: number) => QueryLike<T>;
  select: (fields?: unknown) => QueryLike<T>;
  lean: () => QueryLike<T>;
};

type ThenableDoc<T> = Promise<T | null> & {
  lean: () => Promise<T | null>;
  select: (fields?: unknown) => ThenableDoc<T>;
  sort: (spec?: unknown) => ThenableDoc<T>;
  limit: (n?: number) => ThenableDoc<T>;
  skip: (n?: number) => ThenableDoc<T>;
};

type CompatModel<T> = {
  find: (filter?: unknown, projection?: unknown) => QueryLike<T>;
  findOne: (filter?: unknown, projection?: unknown) => ThenableDoc<T>;
  findById: (id?: unknown) => Promise<T | null>;
  exists: (filter?: unknown) => Promise<unknown>;
  countDocuments: (filter?: unknown) => Promise<number>;
  create: (data?: unknown) => Promise<T>;
  insertMany: (docs?: unknown[], options?: unknown) => Promise<T[]>;
  updateOne: (filter?: unknown, update?: unknown) => Promise<{ modifiedCount?: number }>;
  updateMany: (filter?: unknown, update?: unknown) => Promise<{ modifiedCount?: number }>;
  findByIdAndUpdate: (id?: unknown, update?: unknown) => Promise<T | null>;
  findOneAndUpdate: (
    filter?: unknown,
    update?: unknown,
    options?: unknown
  ) => Promise<T | null>;
  findOneAndDelete: (filter?: unknown) => Promise<T | null>;
  deleteOne: (filter?: unknown) => Promise<{ deletedCount?: number }>;
  deleteMany: (filter?: unknown) => Promise<{ deletedCount?: number }>;
  aggregate: <R = Record<string, unknown>>(pipeline?: unknown[]) => Promise<R[]>;
};

export const UserProfileModel = UserProfilePg as unknown as CompatModel<UserProfileDocument>;
export const CreatorProfileModel = CreatorProfilePg as unknown as CompatModel<CreatorProfileDocument>;
export const SubscriberProfileModel = SubscriberProfilePg as unknown as CompatModel<SubscriberProfileDocument>;
export const ContentModel = ContentPg as unknown as CompatModel<ContentDocument>;
export const PlanModel = PlanPg as unknown as CompatModel<PlanDocument>;
export const SubscriptionModel = SubscriptionPg as unknown as CompatModel<SubscriptionDocument>;
export const PaymentModel = PaymentPg as unknown as CompatModel<PaymentDocument>;
export const NotificationModel = NotificationPg as unknown as CompatModel<NotificationDocument>;
export const AnalyticsModel = AnalyticsPg as unknown as CompatModel<AnalyticsDocument>;
export const ContactModel = ContactPg as unknown as CompatModel<ContactDocument>;
export const PlatformSettingsModel = PlatformSettingsPg as unknown as CompatModel<PlatformSettingsDocument>;
