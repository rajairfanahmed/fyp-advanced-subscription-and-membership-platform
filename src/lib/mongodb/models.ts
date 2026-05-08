import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

const notificationPreferencesSchema = new Schema(
  {
    productUpdates: { type: Boolean, default: true },
    contentDigests: { type: Boolean, default: true },
    downloadAlerts: { type: Boolean, default: true },
    renewalReminders: { type: Boolean, default: true },
    paymentAlerts: { type: Boolean, default: true },
    accountNotices: { type: Boolean, default: true },
    creatorAnnouncements: { type: Boolean, default: false },
  },
  { _id: false }
);

const userProfileSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    fullName: { type: String, default: "" },
    displayName: { type: String, default: "" },
    role: { type: String, enum: ["subscriber", "creator"], default: "subscriber", required: true },
    accountStatus: { type: String, enum: ["active", "suspended", "deleted"], default: "active", required: true },
    avatarUrl: { type: String, default: "" },
    avatarKey: { type: String, default: "" },
    lastLoginAt: { type: Date, default: null },
    onboardingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const creatorWorkspaceAlertsSchema = new Schema(
  {
    newSubscriber: { type: Boolean, default: true },
    renewalSummary: { type: Boolean, default: true },
    failedPayment: { type: Boolean, default: false },
    engagementReport: { type: Boolean, default: true },
    weeklyRevenue: { type: Boolean, default: true },
  },
  { _id: false }
);

// Workspace defaults pre-populated on the creator's "Create Content"
// form so they don't have to re-pick the same access/visibility every
// time they upload. Editable from /creator/settings.
const creatorWorkspaceDefaultsSchema = new Schema(
  {
    defaultRequiredPlan: {
      type: String,
      enum: ["free", "basic", "premium"],
      default: "basic",
    },
    defaultStatus: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  { _id: false }
);

const creatorProfileSchema = new Schema(
  {
    userProfileId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    clerkUserId: { type: String, required: true, unique: true, index: true },
    creatorName: { type: String, required: true, trim: true },
    creatorSlug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    bio: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    avatarKey: { type: String, default: "" },
    bannerUrl: { type: String, default: "" },
    bannerKey: { type: String, default: "" },
    subscriberCount: { type: Number, default: 0 },
    contentCount: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    profileStatus: { type: String, enum: ["draft", "published"], default: "draft", required: true },
    creatorWorkspaceAlerts: {
      type: creatorWorkspaceAlertsSchema,
      default: () => ({
        newSubscriber: true,
        renewalSummary: true,
        failedPayment: false,
        engagementReport: true,
        weeklyRevenue: true,
      }),
    },
    workspaceDefaults: {
      type: creatorWorkspaceDefaultsSchema,
      default: () => ({
        defaultRequiredPlan: "basic",
        defaultStatus: "draft",
      }),
    },
  },
  { timestamps: true }
);

const subscriberProfileSchema = new Schema(
  {
    userProfileId: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true, index: true },
    clerkUserId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, default: "" },
    preferredContentTypes: { type: [String], default: ["Video", "Article", "PDF"] },
    notificationPreferences: { type: notificationPreferencesSchema, default: () => ({}) },
    currentPlanLabel: { type: String, default: "Free preview" },
  },
  { timestamps: true }
);

const contentSchema = new Schema(
  {
    creatorClerkUserId: { type: String, required: true, index: true },
    creatorProfileId: { type: Schema.Types.ObjectId, ref: "CreatorProfile", default: null, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: "" },
    contentType: { type: String, enum: ["video", "article", "file"], required: true, index: true },
    requiredPlan: { type: String, enum: ["free", "basic", "premium"], required: true, default: "free", index: true },
    status: { type: String, enum: ["draft", "published", "archived"], required: true, default: "draft", index: true },
    thumbnailUrl: { type: String, default: "" },
    thumbnailKey: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    viewsCount: { type: Number, default: 0 },
    downloadsCount: { type: Number, default: 0 },
    // Watch-completion ingestion. We store the cumulative sum and the
    // event count so the average is `watchPercentSum / watchEventsCount`
    // without holding per-event rows. Free to read for analytics; never
    // exposed via public APIs.
    watchPercentSum: { type: Number, default: 0, min: 0 },
    watchEventsCount: { type: Number, default: 0, min: 0 },
    videoUrl: { type: String, default: "" },
    videoKey: { type: String, default: "" },
    videoDurationLabel: { type: String, default: "" },
    videoProvider: { type: String, enum: ["upload", "external"], default: "upload" },
    externalVideoUrl: { type: String, default: "" },
    articleBody: { type: String, default: "" },
    articleSummary: { type: String, default: "" },
    fileSubtype: { type: String, enum: ["pdf", "zip", "rar", ""], default: "" },
    fileUrl: { type: String, default: "" },
    fileKey: { type: String, default: "" },
    fileSizeLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

contentSchema.index({ creatorClerkUserId: 1, slug: 1 }, { unique: true });
contentSchema.index({ status: 1, createdAt: -1 });

const planSchema = new Schema(
  {
    creatorClerkUserId: { type: String, required: true, index: true },
    creatorProfileId: { type: Schema.Types.ObjectId, ref: "CreatorProfile", default: null, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: "" },
    priceMonthly: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, default: "usd", lowercase: true, trim: true },
    billingCycle: { type: String, enum: ["monthly"], default: "monthly", required: true },
    accessLevel: {
      type: String,
      enum: ["free", "basic", "premium"],
      required: true,
      index: true,
    },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    // Stripe linkage. `stripePriceId` is the only field a paid plan
    // actually needs to be checkout-able; product id is kept for
    // bookkeeping. Both stay empty until the creator (or platform)
    // syncs the plan to Stripe.
    stripePriceId: { type: String, default: "", trim: true, index: true },
    stripeProductId: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

planSchema.index({ creatorClerkUserId: 1, slug: 1 }, { unique: true });
planSchema.index({ creatorClerkUserId: 1, accessLevel: 1 });
planSchema.index({ creatorClerkUserId: 1, sortOrder: 1 });

// ──────────────────────────────────────────────────────────────
// Subscription
// One row per (subscriber → creator) relationship. The active plan
// is referenced via accessLevel + planId so historic plan changes
// are queryable. Stripe identifiers are optional and stay empty
// until the Stripe layer is wired up — no Stripe logic depends on
// the schema itself, this is just structure.
// ──────────────────────────────────────────────────────────────
const subscriptionSchema = new Schema(
  {
    subscriberClerkUserId: { type: String, required: true, index: true },
    subscriberProfileId: { type: Schema.Types.ObjectId, ref: "SubscriberProfile", default: null, index: true },
    creatorClerkUserId: { type: String, required: true, index: true },
    creatorProfileId: { type: Schema.Types.ObjectId, ref: "CreatorProfile", default: null, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", default: null, index: true },
    accessLevel: {
      type: String,
      enum: ["free", "basic", "premium"],
      required: true,
      default: "free",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled", "expired"],
      required: true,
      default: "active",
      index: true,
    },
    billingCycle: { type: String, enum: ["monthly"], default: "monthly", required: true },
    currency: { type: String, default: "usd", lowercase: true, trim: true },
    priceMonthly: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: () => new Date() },
    currentPeriodEnd: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, default: "" },
    // ── Tier-quota tracking ──────────────────────────────────────
    // Rolling 30-day download window enforced by the download API.
    // `quotaPeriodStart` resets to `now` whenever the window expires;
    // `monthlyDownloadCount` is incremented per successful download.
    // Free tier never increments these (downloads are blocked outright).
    quotaPeriodStart: { type: Date, default: () => new Date() },
    monthlyDownloadCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

subscriptionSchema.index(
  { subscriberClerkUserId: 1, creatorClerkUserId: 1 },
  { unique: true }
);
subscriptionSchema.index({ creatorClerkUserId: 1, status: 1, accessLevel: 1 });

// ──────────────────────────────────────────────────────────────
// Payment
// Append-only ledger of charges/refunds. Schema is ready for Stripe
// to populate via webhook handlers in a later task; nothing writes
// to this collection yet, but reads are safe everywhere.
// ──────────────────────────────────────────────────────────────
const paymentSchema = new Schema(
  {
    subscriberClerkUserId: { type: String, required: true, index: true },
    creatorClerkUserId: { type: String, required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", default: null, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "usd", lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["succeeded", "pending", "failed", "refunded"],
      required: true,
      index: true,
    },
    description: { type: String, default: "" },
    stripePaymentIntentId: { type: String, default: "", index: true },
    stripeChargeId: { type: String, default: "" },
    stripeInvoiceId: { type: String, default: "" },
    receiptUrl: { type: String, default: "" },
    paidAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

paymentSchema.index({ creatorClerkUserId: 1, paidAt: -1 });
paymentSchema.index({ subscriberClerkUserId: 1, paidAt: -1 });

// ──────────────────────────────────────────────────────────────
// Notification
// Inbox row delivered to a single Clerk user. `category` drives the
// icon/color in the UI; `link` (optional) lets the row deep-link
// into the relevant page when clicked.
// ──────────────────────────────────────────────────────────────
const notificationSchema = new Schema(
  {
    recipientClerkUserId: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: [
        "renewal",
        "payment",
        "content",
        "account",
        "locked",
        "creator",
        "system",
      ],
      required: true,
      default: "system",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, default: "" },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientClerkUserId: 1, createdAt: -1 });
notificationSchema.index({ recipientClerkUserId: 1, isRead: 1, createdAt: -1 });

// ──────────────────────────────────────────────────────────────
// Analytics
// Daily snapshot rollup per creator. Filled by future aggregation
// jobs; safe to read with empty results until that lands.
// ──────────────────────────────────────────────────────────────
const analyticsSchema = new Schema(
  {
    creatorClerkUserId: { type: String, required: true, index: true },
    creatorProfileId: { type: Schema.Types.ObjectId, ref: "CreatorProfile", default: null },
    snapshotDate: { type: Date, required: true, index: true },
    totalSubscribers: { type: Number, default: 0, min: 0 },
    activeSubscribers: { type: Number, default: 0, min: 0 },
    paidSubscribers: { type: Number, default: 0, min: 0 },
    totalRevenueCents: { type: Number, default: 0, min: 0 },
    monthlyRecurringCents: { type: Number, default: 0, min: 0 },
    totalViews: { type: Number, default: 0, min: 0 },
    totalDownloads: { type: Number, default: 0, min: 0 },
    contentCount: { type: Number, default: 0, min: 0 },
    newSubscribersToday: { type: Number, default: 0, min: 0 },
    churnedSubscribersToday: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

analyticsSchema.index(
  { creatorClerkUserId: 1, snapshotDate: 1 },
  { unique: true }
);

// ──────────────────────────────────────────────────────────────
// Contact
// Append-only inbox for marketing-site contact form submissions.
// We keep the row regardless of whether admin notifications were
// delivered so support staff have a permanent record of every
// inbound message.
// ──────────────────────────────────────────────────────────────
const contactSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    role: { type: String, default: "" },
    topic: { type: String, default: "" },
    message: { type: String, required: true, trim: true },
    submitterClerkUserId: { type: String, default: "", index: true },
    deliveredToAdminCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["new", "in_progress", "resolved", "spam"],
      default: "new",
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

contactSchema.index({ createdAt: -1 });
contactSchema.index({ email: 1, createdAt: -1 });

// ──────────────────────────────────────────────────────────────
// PlatformSettings
// Singleton document holding admin-configurable defaults. Loaded
// (and lazily created) by helpers in `src/lib/mongodb/admin-settings`.
// ──────────────────────────────────────────────────────────────
const platformSettingsSchema = new Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: "primary",
    },
    platformDisplayName: { type: String, default: "Nexora", trim: true },
    supportEmail: {
      type: String,
      default: "support@nexora.com",
      trim: true,
      lowercase: true,
    },
    defaultSubscriberTier: {
      type: String,
      enum: ["free", "pending"],
      default: "free",
    },
    defaultCreatorStatus: {
      type: String,
      enum: ["review", "active"],
      default: "review",
    },
    platformCurrency: {
      type: String,
      enum: ["usd", "eur", "gbp"],
      default: "usd",
      lowercase: true,
    },
    defaultBillingCycle: {
      type: String,
      enum: ["monthly", "annually"],
      default: "monthly",
    },
    renewalReminderLeadDays: { type: Number, default: 7, min: 0, max: 30 },
    failureAlertCadence: {
      type: String,
      enum: ["immediate", "daily"],
      default: "immediate",
    },
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type UserProfileDocument = InferSchemaType<typeof userProfileSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type CreatorProfileDocument = InferSchemaType<typeof creatorProfileSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriberProfileDocument = InferSchemaType<typeof subscriberProfileSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type ContentDocument = InferSchemaType<typeof contentSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type PlanDocument = InferSchemaType<typeof planSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriptionDocument = InferSchemaType<typeof subscriptionSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type PaymentDocument = InferSchemaType<typeof paymentSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type AnalyticsDocument = InferSchemaType<typeof analyticsSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type ContactDocument = InferSchemaType<typeof contactSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type PlatformSettingsDocument = InferSchemaType<typeof platformSettingsSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const UserProfileModel =
  (mongoose.models.UserProfile as Model<UserProfileDocument> | undefined) ||
  mongoose.model<UserProfileDocument>("UserProfile", userProfileSchema);

export const CreatorProfileModel =
  (mongoose.models.CreatorProfile as Model<CreatorProfileDocument> | undefined) ||
  mongoose.model<CreatorProfileDocument>("CreatorProfile", creatorProfileSchema);

export const SubscriberProfileModel =
  (mongoose.models.SubscriberProfile as Model<SubscriberProfileDocument> | undefined) ||
  mongoose.model<SubscriberProfileDocument>("SubscriberProfile", subscriberProfileSchema);

export const ContentModel =
  (mongoose.models.Content as Model<ContentDocument> | undefined) ||
  mongoose.model<ContentDocument>("Content", contentSchema);

export const PlanModel =
  (mongoose.models.Plan as Model<PlanDocument> | undefined) ||
  mongoose.model<PlanDocument>("Plan", planSchema);

export const SubscriptionModel =
  (mongoose.models.Subscription as Model<SubscriptionDocument> | undefined) ||
  mongoose.model<SubscriptionDocument>("Subscription", subscriptionSchema);

export const PaymentModel =
  (mongoose.models.Payment as Model<PaymentDocument> | undefined) ||
  mongoose.model<PaymentDocument>("Payment", paymentSchema);

export const NotificationModel =
  (mongoose.models.Notification as Model<NotificationDocument> | undefined) ||
  mongoose.model<NotificationDocument>("Notification", notificationSchema);

export const AnalyticsModel =
  (mongoose.models.Analytics as Model<AnalyticsDocument> | undefined) ||
  mongoose.model<AnalyticsDocument>("Analytics", analyticsSchema);

export const ContactModel =
  (mongoose.models.Contact as Model<ContactDocument> | undefined) ||
  mongoose.model<ContactDocument>("Contact", contactSchema);

export const PlatformSettingsModel =
  (mongoose.models.PlatformSettings as Model<PlatformSettingsDocument> | undefined) ||
  mongoose.model<PlatformSettingsDocument>(
    "PlatformSettings",
    platformSettingsSchema
  );
