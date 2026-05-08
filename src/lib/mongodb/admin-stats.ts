import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  AnalyticsModel,
  ContentModel,
  CreatorProfileModel,
  NotificationModel,
  PaymentModel,
  PlanModel,
  SubscriptionModel,
  UserProfileModel,
  type CreatorProfileDocument,
  type UserProfileDocument,
} from "@/lib/mongodb/models";
import { isAdminEmail } from "@/lib/auth/roles";
import type {
  AdminAnalyticsRange,
  AdminAnalyticsResponse,
  AdminContentResponse,
  AdminContentRow,
  AdminCreatorRow,
  AdminCreatorsResponse,
  AdminNotificationRow,
  AdminNotificationsResponse,
  AdminOverviewResponse,
  AdminPaymentRow,
  AdminPaymentsResponse,
  AdminPlanGroup,
  AdminPlanRow,
  AdminPlansResponse,
  AdminSubscriberRow,
  AdminSubscribersResponse,
  AdminSubscriptionRow,
  AdminSubscriptionsResponse,
  AdminUserDetailResponse,
  AdminUserPaymentRow,
  AdminUserRow,
  AdminUserSubscriptionRow,
  AdminUsersResponse,
} from "@/types/admin-stats";
import type { PlanAccessLevel } from "@/types/plan";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function planLabel(accessLevel: string): "Free" | "Basic" | "Premium" {
  if (accessLevel === "premium") return "Premium";
  if (accessLevel === "basic") return "Basic";
  return "Free";
}

function startOfMonthsAgo(months: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short" });
}

function shortName(value?: string) {
  if (!value) return "Unknown";
  return value.trim() || "Unknown";
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRenewalLabel(opts: {
  status: string;
  accessLevel: string;
  currentPeriodEnd: Date | null | undefined;
  canceledAt: Date | null | undefined;
  cancelAtPeriodEnd: boolean | null | undefined;
}): string {
  if (opts.status === "canceled") {
    return opts.canceledAt
      ? `Cancelled ${formatDate(opts.canceledAt)}`
      : "Cancelled";
  }
  if (opts.status === "expired") return "Expired";
  if (opts.status === "past_due") return "Attention needed";
  if (opts.accessLevel === "free") return "No renewal";
  if (opts.cancelAtPeriodEnd && opts.currentPeriodEnd) {
    return `Ends ${formatDate(opts.currentPeriodEnd)}`;
  }
  if (opts.currentPeriodEnd) return `Renews ${formatDate(opts.currentPeriodEnd)}`;
  return "Renewal pending";
}

function classifyEngagement(
  accessLevel: string
): "High" | "Medium" | "Low" {
  if (accessLevel === "premium") return "High";
  if (accessLevel === "basic") return "Medium";
  return "Low";
}

function buildUserNameMap(users: UserProfileDocument[]) {
  const byClerkId = new Map<
    string,
    { name: string; email: string; avatarUrl: string }
  >();
  for (const u of users) {
    byClerkId.set(u.clerkUserId, {
      name: shortName(u.displayName || u.fullName || u.email),
      email: u.email ?? "",
      avatarUrl: u.avatarUrl ?? "",
    });
  }
  return byClerkId;
}

function buildCreatorNameMap(creators: CreatorProfileDocument[]) {
  const byClerkId = new Map<
    string,
    { creatorName: string; creatorSlug: string }
  >();
  for (const c of creators) {
    byClerkId.set(c.clerkUserId, {
      creatorName: c.creatorName,
      creatorSlug: c.creatorSlug,
    });
  }
  return byClerkId;
}

// ──────────────────────────────────────────────────────────────
// /admin overview
// ──────────────────────────────────────────────────────────────
export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  await connectToMongoDB();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalUsers,
    activeCreators,
    activeSubsDocs,
    cancelled30d,
    publishedContent,
    failedPaymentCount,
    succeededPaymentCount,
    recentSubsRaw,
    recentPaymentsRaw,
    recentContentRaw,
  ] = await Promise.all([
    UserProfileModel.countDocuments({}),
    CreatorProfileModel.countDocuments({}),
    SubscriptionModel.find({
      status: { $in: [...ACTIVE_STATUSES] },
    }),
    SubscriptionModel.countDocuments({
      status: "canceled",
      canceledAt: { $gte: thirtyDaysAgo },
    }),
    ContentModel.countDocuments({ status: "published" }),
    PaymentModel.countDocuments({ status: "failed" }),
    PaymentModel.countDocuments({ status: "succeeded" }),
    SubscriptionModel.find({})
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(8),
    PaymentModel.find({})
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(8),
    ContentModel.find({ status: "published" })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(8),
  ]);

  const activeSubscriberIds = new Set(
    activeSubsDocs.map((s) => s.subscriberClerkUserId)
  );
  const paidSubsCount = activeSubsDocs.filter(
    (s) => s.accessLevel !== "free"
  ).length;

  const monthlyRevenueCents = activeSubsDocs
    .filter((s) => s.accessLevel !== "free")
    .reduce((acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100), 0);

  const conversionRatePercent =
    activeSubsDocs.length > 0
      ? Math.round((paidSubsCount / activeSubsDocs.length) * 1000) / 10
      : 0;

  const totalPayments = succeededPaymentCount + failedPaymentCount;
  const paymentSuccessRatePercent =
    totalPayments > 0
      ? Math.round((succeededPaymentCount / totalPayments) * 1000) / 10
      : 100;

  const userRetentionRatePercent =
    totalUsers > 0
      ? Math.round((activeSubscriberIds.size / totalUsers) * 1000) / 10
      : 0;

  // Build trend (last 6 months) by counting paid subscriptions whose
  // startedAt falls in each month.
  const paidActive = activeSubsDocs.filter((s) => s.accessLevel !== "free");
  const trend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const monthStart = startOfMonthsAgo(i);
    const monthEnd = startOfMonthsAgo(i - 1);
    const valueCents = paidActive
      .filter((s) => {
        const started = s.startedAt ?? s.createdAt;
        return started && started >= monthStart && started < monthEnd;
      })
      .reduce((acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100), 0);
    trend.push({ label: monthLabel(monthStart), valueCents });
  }

  // Resolve names for activity feed
  const subscriberIds = Array.from(
    new Set([
      ...recentSubsRaw.map((s) => s.subscriberClerkUserId),
      ...recentPaymentsRaw.map((p) => p.subscriberClerkUserId),
    ])
  );
  const creatorIds = Array.from(
    new Set([
      ...recentSubsRaw.map((s) => s.creatorClerkUserId),
      ...recentPaymentsRaw.map((p) => p.creatorClerkUserId),
      ...recentContentRaw.map((c) => c.creatorClerkUserId),
    ])
  );
  const [userProfiles, creatorProfiles] = await Promise.all([
    subscriberIds.length
      ? UserProfileModel.find({ clerkUserId: { $in: subscriberIds } })
      : [],
    creatorIds.length
      ? CreatorProfileModel.find({ clerkUserId: { $in: creatorIds } })
      : [],
  ]);
  const userMap = buildUserNameMap(userProfiles);
  const creatorMap = buildCreatorNameMap(creatorProfiles);

  type ActivityRow = AdminOverviewResponse["recentActivity"][number];
  const activity: ActivityRow[] = [];

  for (const sub of recentSubsRaw) {
    const subscriberName = userMap.get(sub.subscriberClerkUserId)?.name ?? "Subscriber";
    const creatorName = creatorMap.get(sub.creatorClerkUserId)?.creatorName ?? "a creator";
    if (sub.status === "canceled" && sub.canceledAt) {
      activity.push({
        id: `cancel-${sub._id.toString()}`,
        type: "subscription_canceled",
        text: `${subscriberName} cancelled their ${planLabel(sub.accessLevel)} subscription to ${creatorName}.`,
        occurredAt: sub.canceledAt.toISOString(),
      });
    } else if (sub.createdAt) {
      activity.push({
        id: `sub-${sub._id.toString()}`,
        type: "subscription_started",
        text: `${subscriberName} subscribed to ${creatorName} on the ${planLabel(sub.accessLevel)} plan.`,
        occurredAt: sub.createdAt.toISOString(),
      });
    }
  }
  for (const payment of recentPaymentsRaw) {
    const subscriberName = userMap.get(payment.subscriberClerkUserId)?.name ?? "Subscriber";
    const creatorName = creatorMap.get(payment.creatorClerkUserId)?.creatorName ?? "a creator";
    const amount = `$${(asNumber(payment.amountCents) / 100).toFixed(2)}`;
    activity.push({
      id: `pay-${payment._id.toString()}`,
      type: payment.status === "failed" ? "payment_failed" : "payment_succeeded",
      text:
        payment.status === "failed"
          ? `Payment of ${amount} failed for ${subscriberName} → ${creatorName}.`
          : `Payment of ${amount} succeeded for ${subscriberName} → ${creatorName}.`,
      occurredAt: (payment.paidAt ?? payment.createdAt).toISOString(),
    });
  }
  for (const content of recentContentRaw) {
    const creatorName = creatorMap.get(content.creatorClerkUserId)?.creatorName ?? "A creator";
    activity.push({
      id: `content-${content._id.toString()}`,
      type: "content_published",
      text: `${creatorName} published "${content.title}".`,
      occurredAt: (content.publishedAt ?? content.createdAt).toISOString(),
    });
  }

  const recentActivity = activity
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .slice(0, 8);

  return {
    metrics: {
      totalUsers,
      activeSubscribers: activeSubscriberIds.size,
      activeCreators,
      monthlyRevenueCents,
      failedPayments: failedPaymentCount,
      cancelledSubscribers30d: cancelled30d,
      publishedContent,
      conversionRatePercent,
    },
    health: {
      paymentSuccessRatePercent,
      userRetentionRatePercent,
    },
    trend,
    recentActivity,
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/users
// ──────────────────────────────────────────────────────────────
export async function getAdminUsers(): Promise<AdminUsersResponse> {
  await connectToMongoDB();

  const [users, activeSubs] = await Promise.all([
    UserProfileModel.find({}).sort({ createdAt: -1 }),
    SubscriptionModel.find({
      status: { $in: [...ACTIVE_STATUSES] },
    }),
  ]);

  // Map subscriber -> highest active plan held across all creators.
  // Premium > Basic > Free precedence.
  const planRank: Record<PlanAccessLevel, number> = {
    free: 0,
    basic: 1,
    premium: 2,
  };
  const highestPlan = new Map<string, PlanAccessLevel>();
  for (const sub of activeSubs) {
    const current = highestPlan.get(sub.subscriberClerkUserId);
    const incoming = sub.accessLevel as PlanAccessLevel;
    if (!current || planRank[incoming] > planRank[current]) {
      highestPlan.set(sub.subscriberClerkUserId, incoming);
    }
  }

  const rows: AdminUserRow[] = users.map((u) => {
    const access = highestPlan.get(u.clerkUserId);
    const isAdmin = isAdminEmail(u.email);
    const status: AdminUserRow["status"] =
      u.accountStatus === "deleted"
        ? "Deleted"
        : u.accountStatus === "suspended"
          ? "Suspended"
          : "Active";
    return {
      id: u._id.toString(),
      clerkUserId: u.clerkUserId,
      name: shortName(u.displayName || u.fullName || u.email),
      email: u.email ?? "",
      avatarUrl: u.avatarUrl ?? "",
      role: isAdmin ? "admin" : (u.role as "subscriber" | "creator"),
      highestPlanLabel: access ? planLabel(access) : "—",
      status,
      joinedAt: u.createdAt.toISOString(),
    };
  });

  const activeAccounts = rows.filter((r) => r.status === "Active").length;
  const suspended = rows.filter((r) => r.status === "Suspended").length;
  const deactivated = rows.filter((r) => r.status === "Deleted").length;

  return {
    metrics: {
      totalUsers: rows.length,
      activeAccounts,
      suspended,
      deactivated,
    },
    users: rows,
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/users/[id]
// ──────────────────────────────────────────────────────────────
export async function getAdminUserDetail(
  userIdOrClerkId: string
): Promise<AdminUserDetailResponse | null> {
  await connectToMongoDB();
  if (!userIdOrClerkId) return null;

  // Accept either the Mongo `_id` or the Clerk `clerkUserId` so the
  // route can take whichever the UI has.
  const isObjectId = /^[a-f0-9]{24}$/i.test(userIdOrClerkId);
  const profile = isObjectId
    ? await UserProfileModel.findById(userIdOrClerkId)
    : await UserProfileModel.findOne({ clerkUserId: userIdOrClerkId });
  if (!profile) return null;

  const clerkUserId = profile.clerkUserId;

  const [subscriptions, payments, creators] = await Promise.all([
    SubscriptionModel.find({ subscriberClerkUserId: clerkUserId }).sort({
      updatedAt: -1,
      createdAt: -1,
    }),
    PaymentModel.find({ subscriberClerkUserId: clerkUserId }).sort({
      paidAt: -1,
      createdAt: -1,
    }),
    CreatorProfileModel.find({}),
  ]);
  const creatorMap = buildCreatorNameMap(creators);

  const subscriptionRows: AdminUserSubscriptionRow[] = subscriptions.map(
    (sub) => ({
      id: sub._id.toString(),
      creatorName:
        creatorMap.get(sub.creatorClerkUserId)?.creatorName ?? "Unknown creator",
      creatorSlug: creatorMap.get(sub.creatorClerkUserId)?.creatorSlug ?? "",
      plan: planLabel(sub.accessLevel),
      accessLevel: (sub.accessLevel as PlanAccessLevel) ?? "free",
      status: sub.status as AdminUserSubscriptionRow["status"],
      priceMonthly: asNumber(sub.priceMonthly),
      startedAt: (sub.startedAt ?? sub.createdAt).toISOString(),
      renewalLabel: formatRenewalLabel({
        status: sub.status,
        accessLevel: sub.accessLevel,
        currentPeriodEnd: sub.currentPeriodEnd,
        canceledAt: sub.canceledAt,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      }),
    })
  );

  const paymentRows: AdminUserPaymentRow[] = payments.map((p) => ({
    id: p._id.toString(),
    amountCents: asNumber(p.amountCents),
    currency: p.currency,
    status: p.status as AdminUserPaymentRow["status"],
    description: p.description ?? "",
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    receiptUrl: p.receiptUrl ?? "",
  }));

  const isAdmin = isAdminEmail(profile.email);
  const status: AdminUserRow["status"] =
    profile.accountStatus === "deleted"
      ? "Deleted"
      : profile.accountStatus === "suspended"
        ? "Suspended"
        : "Active";

  // Highest plan held across all active subscriptions.
  const planRank: Record<PlanAccessLevel, number> = {
    free: 0,
    basic: 1,
    premium: 2,
  };
  let highestActive: PlanAccessLevel | null = null;
  for (const sub of subscriptions) {
    if (
      ACTIVE_STATUSES.includes(sub.status as (typeof ACTIVE_STATUSES)[number])
    ) {
      const lvl = sub.accessLevel as PlanAccessLevel;
      if (!highestActive || planRank[lvl] > planRank[highestActive]) {
        highestActive = lvl;
      }
    }
  }

  const totalSpentCents = payments
    .filter((p) => p.status === "succeeded")
    .reduce((acc, p) => acc + asNumber(p.amountCents), 0);
  const activeSubscriptions = subscriptions.filter((s) =>
    ACTIVE_STATUSES.includes(s.status as (typeof ACTIVE_STATUSES)[number])
  ).length;
  const paidSubscriptions = subscriptions.filter(
    (s) =>
      ACTIVE_STATUSES.includes(s.status as (typeof ACTIVE_STATUSES)[number]) &&
      s.accessLevel !== "free"
  ).length;
  const failedPayments = payments.filter((p) => p.status === "failed").length;

  // Look up the creator profile for bio (only set when this user is a creator)
  const creatorProfile = creators.find((c) => c.clerkUserId === clerkUserId);

  return {
    user: {
      id: profile._id.toString(),
      clerkUserId,
      name: shortName(profile.displayName || profile.fullName || profile.email),
      email: profile.email ?? "",
      avatarUrl: profile.avatarUrl ?? "",
      role: isAdmin ? "admin" : (profile.role as "subscriber" | "creator"),
      highestPlanLabel: highestActive ? planLabel(highestActive) : "—",
      status,
      joinedAt: profile.createdAt.toISOString(),
      bio: creatorProfile?.bio ?? "",
      fullName: profile.fullName ?? "",
      displayName: profile.displayName ?? "",
      accountStatus:
        (profile.accountStatus as "active" | "suspended" | "deleted") ??
        "active",
    },
    metrics: {
      totalSpentCents,
      activeSubscriptions,
      paidSubscriptions,
      failedPayments,
    },
    subscriptions: subscriptionRows,
    payments: paymentRows,
  };
}

/**
 * Update a user's `accountStatus`. The admin can only flip between
 * `active` and `suspended` via this helper; deletion is a separate
 * destructive flow that has to live behind a different surface.
 */
export async function updateAdminUserStatus(input: {
  userIdOrClerkId: string;
  accountStatus: "active" | "suspended";
}): Promise<AdminUserDetailResponse | null> {
  await connectToMongoDB();
  if (!input.userIdOrClerkId) return null;

  const isObjectId = /^[a-f0-9]{24}$/i.test(input.userIdOrClerkId);
  const filter = isObjectId
    ? { _id: input.userIdOrClerkId }
    : { clerkUserId: input.userIdOrClerkId };

  const updated = await UserProfileModel.findOneAndUpdate(
    filter,
    { $set: { accountStatus: input.accountStatus } },
    { returnDocument: "after" }
  );
  if (!updated) return null;

  return getAdminUserDetail(updated.clerkUserId);
}

// ──────────────────────────────────────────────────────────────
// /admin/creators
// ──────────────────────────────────────────────────────────────
export async function getAdminCreators(): Promise<AdminCreatorsResponse> {
  await connectToMongoDB();

  const [creators, allSubs, contentDocs] = await Promise.all([
    CreatorProfileModel.find({}).sort({ createdAt: -1 }),
    SubscriptionModel.find({
      status: { $in: [...ACTIVE_STATUSES] },
    }),
    ContentModel.find(
      { status: { $ne: "archived" } },
      { creatorClerkUserId: 1 }
    ),
  ]);

  const creatorClerkIds = creators.map((c) => c.clerkUserId);
  const userProfiles = creatorClerkIds.length
    ? await UserProfileModel.find(
        { clerkUserId: { $in: creatorClerkIds } },
        { clerkUserId: 1, email: 1, avatarUrl: 1 }
      )
    : [];
  const emailByClerkId = new Map(
    userProfiles.map((u) => [u.clerkUserId, u.email ?? ""])
  );
  const avatarByClerkId = new Map(
    userProfiles.map((u) => [u.clerkUserId, u.avatarUrl ?? ""])
  );

  const subsByCreator = new Map<string, typeof allSubs>();
  for (const sub of allSubs) {
    const list = subsByCreator.get(sub.creatorClerkUserId) ?? [];
    list.push(sub);
    subsByCreator.set(sub.creatorClerkUserId, list);
  }

  const contentByCreator = new Map<string, number>();
  for (const c of contentDocs) {
    contentByCreator.set(
      c.creatorClerkUserId,
      (contentByCreator.get(c.creatorClerkUserId) ?? 0) + 1
    );
  }

  const rows: AdminCreatorRow[] = creators.map((creator) => {
    const subs = subsByCreator.get(creator.clerkUserId) ?? [];
    const paidSubs = subs.filter((s) => s.accessLevel !== "free");
    const mrrCents = paidSubs.reduce(
      (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
      0
    );
    return {
      id: creator._id.toString(),
      clerkUserId: creator.clerkUserId,
      creatorSlug: creator.creatorSlug,
      creatorName: creator.creatorName,
      email: emailByClerkId.get(creator.clerkUserId) ?? "",
      avatarUrl:
        creator.avatarUrl || avatarByClerkId.get(creator.clerkUserId) || "",
      subscribersCount: subs.length,
      paidSubscribersCount: paidSubs.length,
      contentCount: contentByCreator.get(creator.clerkUserId) ?? 0,
      mrrCents,
      status: creator.profileStatus === "published" ? "Active" : "Review",
      createdAt: creator.createdAt.toISOString(),
    };
  });

  const totalCreatorMrrCents = rows.reduce((acc, r) => acc + r.mrrCents, 0);
  const totalSubs = rows.reduce((acc, r) => acc + r.subscribersCount, 0);
  const avgAudience = rows.length ? Math.round(totalSubs / rows.length) : 0;
  const pendingReview = rows.filter((r) => r.status === "Review").length;

  return {
    metrics: {
      totalCreators: rows.length,
      totalCreatorMrrCents,
      avgAudience,
      pendingReview,
    },
    creators: rows,
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/subscribers
// ──────────────────────────────────────────────────────────────
export async function getAdminSubscribers(): Promise<AdminSubscribersResponse> {
  await connectToMongoDB();

  const subscriptions = await SubscriptionModel.find({}).sort({
    updatedAt: -1,
    createdAt: -1,
  });

  const subscriberIds = Array.from(
    new Set(subscriptions.map((s) => s.subscriberClerkUserId))
  );
  const creatorIds = Array.from(
    new Set(subscriptions.map((s) => s.creatorClerkUserId))
  );

  const [userProfiles, creatorProfiles] = await Promise.all([
    subscriberIds.length
      ? UserProfileModel.find({ clerkUserId: { $in: subscriberIds } })
      : [],
    creatorIds.length
      ? CreatorProfileModel.find({ clerkUserId: { $in: creatorIds } })
      : [],
  ]);
  const userMap = buildUserNameMap(userProfiles);
  const creatorMap = buildCreatorNameMap(creatorProfiles);

  const rows: AdminSubscriberRow[] = subscriptions.map((sub) => {
    const userInfo = userMap.get(sub.subscriberClerkUserId);
    const creatorInfo = creatorMap.get(sub.creatorClerkUserId);
    return {
      subscriptionId: sub._id.toString(),
      subscriberClerkUserId: sub.subscriberClerkUserId,
      name: userInfo?.name ?? "Unknown",
      email: userInfo?.email ?? "",
      avatarUrl: userInfo?.avatarUrl ?? "",
      creatorName: creatorInfo?.creatorName ?? "Unknown creator",
      creatorSlug: creatorInfo?.creatorSlug ?? "",
      plan: planLabel(sub.accessLevel),
      accessLevel: (sub.accessLevel as PlanAccessLevel) ?? "free",
      status: sub.status as AdminSubscriberRow["status"],
      renewalLabel: formatRenewalLabel({
        status: sub.status,
        accessLevel: sub.accessLevel,
        currentPeriodEnd: sub.currentPeriodEnd,
        canceledAt: sub.canceledAt,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      }),
      engagement: classifyEngagement(sub.accessLevel),
      startedAt: (sub.startedAt ?? sub.createdAt).toISOString(),
    };
  });

  const activeRows = rows.filter((r) =>
    ACTIVE_STATUSES.includes(r.status as (typeof ACTIVE_STATUSES)[number])
  );
  const premiumActive = activeRows.filter((r) => r.accessLevel === "premium");
  const basicActive = activeRows.filter((r) => r.accessLevel === "basic");
  const freeActive = activeRows.filter((r) => r.accessLevel === "free");
  const highEngagement = activeRows.filter((r) => r.engagement === "High");
  const churnRisk = rows.filter(
    (r) =>
      r.status === "past_due" ||
      r.status === "canceled" ||
      r.status === "expired"
  );

  const total = activeRows.length || 1;

  return {
    metrics: {
      activeSubscribers: activeRows.length,
      premiumRatioPercent:
        Math.round((premiumActive.length / total) * 1000) / 10,
      highEngagementCount: highEngagement.length,
      churnRiskCount: churnRisk.length,
    },
    subscribers: rows,
    planDistribution: {
      freePercent: Math.round((freeActive.length / total) * 1000) / 10,
      basicPercent: Math.round((basicActive.length / total) * 1000) / 10,
      premiumPercent: Math.round((premiumActive.length / total) * 1000) / 10,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/plans
// ──────────────────────────────────────────────────────────────
export async function getAdminPlans(): Promise<AdminPlansResponse> {
  await connectToMongoDB();

  const [plans, activeSubs, creators] = await Promise.all([
    PlanModel.find({}).sort({ createdAt: -1 }),
    SubscriptionModel.find({ status: { $in: [...ACTIVE_STATUSES] } }),
    CreatorProfileModel.find({}),
  ]);

  const creatorMap = buildCreatorNameMap(creators);

  const subscribersByPlanId = new Map<string, number>();
  const subscribersByAccessLevel: Record<PlanAccessLevel, number> = {
    free: 0,
    basic: 0,
    premium: 0,
  };
  for (const sub of activeSubs) {
    if (sub.planId) {
      const key = sub.planId.toString();
      subscribersByPlanId.set(key, (subscribersByPlanId.get(key) ?? 0) + 1);
    }
    const access = sub.accessLevel as PlanAccessLevel;
    subscribersByAccessLevel[access] += 1;
  }

  const planRows: AdminPlanRow[] = plans.map((plan) => ({
    id: plan._id.toString(),
    creatorClerkUserId: plan.creatorClerkUserId,
    creatorName: creatorMap.get(plan.creatorClerkUserId)?.creatorName ?? "Unknown creator",
    creatorSlug: creatorMap.get(plan.creatorClerkUserId)?.creatorSlug ?? "",
    name: plan.name,
    accessLevel: plan.accessLevel as PlanAccessLevel,
    priceMonthly: asNumber(plan.priceMonthly),
    isActive: plan.isActive ?? false,
    subscribersCount: subscribersByPlanId.get(plan._id.toString()) ?? 0,
  }));

  const groups: AdminPlanGroup[] = (
    ["free", "basic", "premium"] as PlanAccessLevel[]
  ).map((accessLevel) => {
    const planSubset = plans.filter((p) => p.accessLevel === accessLevel);
    const activePlans = planSubset.filter((p) => p.isActive);
    const totalSubscribers = subscribersByAccessLevel[accessLevel];
    const totalMrrCents = activeSubs
      .filter((s) => s.accessLevel === accessLevel)
      .reduce((acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100), 0);
    const averagePrice = activePlans.length
      ? Math.round(
          (activePlans.reduce((acc, p) => acc + asNumber(p.priceMonthly), 0) /
            activePlans.length) *
            100
        ) / 100
      : 0;
    const planSubsCounts = planSubset
      .map((p) => ({
        creator: creatorMap.get(p.creatorClerkUserId)?.creatorName ?? "—",
        count: subscribersByPlanId.get(p._id.toString()) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
    return {
      accessLevel,
      label: planLabel(accessLevel),
      planCount: planSubset.length,
      activePlanCount: activePlans.length,
      totalSubscribers,
      averagePrice,
      totalMrrCents,
      topCreatorName: planSubsCounts[0]?.creator ?? "—",
    };
  });

  const totalActivePlans = plans.filter((p) => p.isActive).length;

  // Most popular = group with the most active subscribers
  const mostPopular = [...groups].sort(
    (a, b) => b.totalSubscribers - a.totalSubscribers
  )[0];
  // Top conversion = group with the highest paid/total ratio (approximate
  // by looking at premium subscriber share among paid). We just surface
  // "Premium" by convention when at least one premium sub exists, else "—".
  const topConversion =
    subscribersByAccessLevel.premium > 0
      ? "Premium"
      : subscribersByAccessLevel.basic > 0
        ? "Basic"
        : "—";

  return {
    metrics: {
      totalActivePlans,
      mostPopularLabel: mostPopular?.label ?? "—",
      topConversionLabel: topConversion,
    },
    groups,
    plans: planRows,
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/content
// ──────────────────────────────────────────────────────────────
export async function getAdminContent(): Promise<AdminContentResponse> {
  await connectToMongoDB();

  const [contentDocs, creators] = await Promise.all([
    ContentModel.find({}).sort({ createdAt: -1 }),
    CreatorProfileModel.find({}),
  ]);
  const creatorMap = buildCreatorNameMap(creators);

  const rows: AdminContentRow[] = contentDocs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    contentType: doc.contentType as "video" | "article" | "file",
    fileSubtype: (doc.fileSubtype ?? "") as "pdf" | "zip" | "rar" | "",
    accessLevel: doc.requiredPlan as PlanAccessLevel,
    status: doc.status as "draft" | "published" | "archived",
    creatorName: creatorMap.get(doc.creatorClerkUserId)?.creatorName ?? "Unknown creator",
    creatorSlug: creatorMap.get(doc.creatorClerkUserId)?.creatorSlug ?? "",
    viewsCount: asNumber(doc.viewsCount),
    downloadsCount: asNumber(doc.downloadsCount),
    createdAt: doc.createdAt.toISOString(),
  }));

  const totalPublished = rows.filter((r) => r.status === "published").length;
  const totalResources = rows.filter((r) => r.contentType === "file").length;
  const totalViews = rows.reduce((acc, r) => acc + r.viewsCount, 0);
  const pendingReview = rows.filter((r) => r.status === "draft").length;

  return {
    metrics: {
      totalPublished,
      totalResources,
      totalViews,
      pendingReview,
    },
    content: rows,
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/subscriptions
// ──────────────────────────────────────────────────────────────
export async function getAdminSubscriptions(): Promise<AdminSubscriptionsResponse> {
  await connectToMongoDB();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [subscriptions, failedCharges, renewalsToday] = await Promise.all([
    SubscriptionModel.find({}).sort({ updatedAt: -1, createdAt: -1 }),
    PaymentModel.countDocuments({ status: "failed" }),
    SubscriptionModel.countDocuments({
      currentPeriodEnd: { $gte: todayStart, $lte: todayEnd },
      status: { $in: [...ACTIVE_STATUSES] },
    }),
  ]);

  const subscriberIds = Array.from(
    new Set(subscriptions.map((s) => s.subscriberClerkUserId))
  );
  const creatorIds = Array.from(
    new Set(subscriptions.map((s) => s.creatorClerkUserId))
  );
  const [userProfiles, creators] = await Promise.all([
    subscriberIds.length
      ? UserProfileModel.find({ clerkUserId: { $in: subscriberIds } })
      : [],
    creatorIds.length
      ? CreatorProfileModel.find({ clerkUserId: { $in: creatorIds } })
      : [],
  ]);
  const userMap = buildUserNameMap(userProfiles);
  const creatorMap = buildCreatorNameMap(creators);

  const rows: AdminSubscriptionRow[] = subscriptions.map((sub) => {
    const u = userMap.get(sub.subscriberClerkUserId);
    const c = creatorMap.get(sub.creatorClerkUserId);
    return {
      id: sub._id.toString(),
      subscriberName: u?.name ?? "Unknown",
      subscriberEmail: u?.email ?? "",
      creatorName: c?.creatorName ?? "Unknown",
      creatorSlug: c?.creatorSlug ?? "",
      plan: planLabel(sub.accessLevel),
      accessLevel: (sub.accessLevel as PlanAccessLevel) ?? "free",
      status: sub.status as AdminSubscriptionRow["status"],
      startedAt: (sub.startedAt ?? sub.createdAt).toISOString(),
      renewalLabel: formatRenewalLabel({
        status: sub.status,
        accessLevel: sub.accessLevel,
        currentPeriodEnd: sub.currentPeriodEnd,
        canceledAt: sub.canceledAt,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      }),
      priceMonthly: asNumber(sub.priceMonthly),
    };
  });

  const active = rows.filter((r) =>
    ACTIVE_STATUSES.includes(r.status as (typeof ACTIVE_STATUSES)[number])
  );
  const cancelled = rows.filter((r) => r.status === "canceled").length;
  const pastDue = rows.filter((r) => r.status === "past_due").length;

  return {
    metrics: {
      activeSubscriptions: active.length,
      renewalsToday,
      failedCharges,
      pendingChurn: cancelled,
    },
    subscriptions: rows,
    statusBreakdown: {
      active: active.length,
      cancelled,
      pastDue,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/payments
// ──────────────────────────────────────────────────────────────
export async function getAdminPayments(): Promise<AdminPaymentsResponse> {
  await connectToMongoDB();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [paymentDocs, failedDocs] = await Promise.all([
    PaymentModel.find({}).sort({ paidAt: -1, createdAt: -1 }).limit(100),
    PaymentModel.find({ status: "failed" }).sort({ createdAt: -1 }),
  ]);

  const subscriberIds = Array.from(
    new Set(paymentDocs.map((p) => p.subscriberClerkUserId))
  );
  const creatorIds = Array.from(
    new Set(paymentDocs.map((p) => p.creatorClerkUserId))
  );
  const [userProfiles, creators] = await Promise.all([
    subscriberIds.length
      ? UserProfileModel.find({ clerkUserId: { $in: subscriberIds } })
      : [],
    creatorIds.length
      ? CreatorProfileModel.find({ clerkUserId: { $in: creatorIds } })
      : [],
  ]);
  const userMap = buildUserNameMap(userProfiles);
  const creatorMap = buildCreatorNameMap(creators);

  const rows: AdminPaymentRow[] = paymentDocs.map((doc) => ({
    id: doc._id.toString(),
    subscriberName: userMap.get(doc.subscriberClerkUserId)?.name ?? "Unknown",
    subscriberEmail: userMap.get(doc.subscriberClerkUserId)?.email ?? "",
    creatorName: creatorMap.get(doc.creatorClerkUserId)?.creatorName ?? "Unknown",
    amountCents: asNumber(doc.amountCents),
    currency: doc.currency,
    status: doc.status as AdminPaymentRow["status"],
    paymentMethodLabel: doc.stripeChargeId || doc.stripePaymentIntentId ? "Stripe" : "—",
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    receiptUrl: doc.receiptUrl ?? "",
    hasStripeReference: Boolean(
      doc.stripePaymentIntentId || doc.stripeChargeId || doc.stripeInvoiceId
    ),
  }));

  const recentSucceeded = await PaymentModel.countDocuments({
    status: "succeeded",
    paidAt: { $gte: thirtyDaysAgo },
  });
  const recentFailed = await PaymentModel.countDocuments({
    status: "failed",
    createdAt: { $gte: thirtyDaysAgo },
  });
  const recentTotal = recentSucceeded + recentFailed;

  const volume30dCents = await PaymentModel.aggregate<{
    _id: null;
    total: number;
  }>([
    {
      $match: {
        status: "succeeded",
        paidAt: { $gte: thirtyDaysAgo },
      },
    },
    { $group: { _id: null, total: { $sum: "$amountCents" } } },
  ]);

  const successRatePercent =
    recentTotal > 0
      ? Math.round((recentSucceeded / recentTotal) * 1000) / 10
      : 100;

  const refunds = await PaymentModel.countDocuments({ status: "refunded" });

  const failedCount = failedDocs.length;
  const atRiskCents = failedDocs.reduce(
    (acc, p) => acc + asNumber(p.amountCents),
    0
  );

  return {
    metrics: {
      volume30dCents: volume30dCents[0]?.total ?? 0,
      successRatePercent,
      failedCharges: failedCount,
      refunds,
    },
    payments: rows,
    failed: {
      failedCount,
      atRiskCents,
      retryingCount: 0,
      actionNeededCount: failedCount,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/notifications
// ──────────────────────────────────────────────────────────────
export async function getAdminNotifications(): Promise<AdminNotificationsResponse> {
  await connectToMongoDB();

  const notificationDocs = await NotificationModel.find({})
    .sort({ createdAt: -1 })
    .limit(150);

  const recipientIds = Array.from(
    new Set(notificationDocs.map((n) => n.recipientClerkUserId))
  );
  const userProfiles = recipientIds.length
    ? await UserProfileModel.find({ clerkUserId: { $in: recipientIds } })
    : [];
  const userMap = buildUserNameMap(userProfiles);

  const rows: AdminNotificationRow[] = notificationDocs.map((doc) => ({
    id: doc._id.toString(),
    category: doc.category as AdminNotificationRow["category"],
    title: doc.title,
    recipientName: userMap.get(doc.recipientClerkUserId)?.name ?? "Unknown",
    recipientClerkUserId: doc.recipientClerkUserId,
    isRead: doc.isRead ?? false,
    createdAt: doc.createdAt.toISOString(),
  }));

  const totalSystemAlerts = await NotificationModel.countDocuments({});

  return {
    metrics: {
      totalSystemAlerts,
      // Once we add a delivery channel that can fail (e.g. email),
      // this becomes the fraction of successfully delivered events.
      // Today every Mongo write that creates a notification is a
      // successful in-app delivery, so 100% is honest.
      deliverySuccessPercent: 100,
      failedDelivery: 0,
    },
    notifications: rows,
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/analytics
// ──────────────────────────────────────────────────────────────
const RANGE_BUCKETS: Record<AdminAnalyticsRange, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

export async function getAdminAnalytics(
  range: AdminAnalyticsRange = "6m"
): Promise<AdminAnalyticsResponse> {
  await connectToMongoDB();

  const buckets = RANGE_BUCKETS[range] ?? 6;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [activeSubs, content, allSubs, creators, paymentsSucceeded, paymentsFailed] =
    await Promise.all([
      SubscriptionModel.find({ status: { $in: [...ACTIVE_STATUSES] } }),
      ContentModel.find(
        { status: { $ne: "archived" } },
        { title: 1, contentType: 1, viewsCount: 1, downloadsCount: 1, creatorClerkUserId: 1 }
      ),
      SubscriptionModel.find({}),
      CreatorProfileModel.find({}),
      PaymentModel.countDocuments({ status: "succeeded" }),
      PaymentModel.countDocuments({ status: "failed" }),
    ]);

  const creatorMap = buildCreatorNameMap(creators);

  const paidActive = activeSubs.filter((s) => s.accessLevel !== "free");
  const platformMrrCents = paidActive.reduce(
    (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
    0
  );
  const totalActiveSubscribers = new Set(
    activeSubs.map((s) => s.subscriberClerkUserId)
  ).size;
  const totalViews = content.reduce(
    (acc, c) => acc + asNumber(c.viewsCount),
    0
  );
  const premiumConversionPercent = activeSubs.length
    ? Math.round((paidActive.length / activeSubs.length) * 1000) / 10
    : 0;

  // Pull rolled-up daily snapshots once and group them by month so we
  // can read MRR + acquisition counts straight from the Analytics
  // collection. Falls back to live computation if no snapshots exist
  // for a given month yet (cron hasn't run, or cron started recently).
  const earliestMonthStart = startOfMonthsAgo(buckets - 1);
  const dailySnapshots = await AnalyticsModel.find({
    snapshotDate: { $gte: earliestMonthStart },
  })
    .sort({ snapshotDate: 1 })
    .select(
      "snapshotDate monthlyRecurringCents newSubscribersToday creatorClerkUserId"
    )
    .lean();

  type RolledSnapshot = {
    snapshotDate: Date;
    monthlyRecurringCents: number;
    newSubscribersToday: number;
  };
  const rolled: RolledSnapshot[] = dailySnapshots.map((doc) => ({
    snapshotDate: new Date(
      (doc as { snapshotDate: Date }).snapshotDate
    ),
    monthlyRecurringCents: asNumber(
      (doc as { monthlyRecurringCents?: number }).monthlyRecurringCents
    ),
    newSubscribersToday: asNumber(
      (doc as { newSubscribersToday?: number }).newSubscribersToday
    ),
  }));

  // Trend (revenue) — bucketed by month over the requested range.
  const trend = [];
  for (let i = buckets - 1; i >= 0; i -= 1) {
    const monthStart = startOfMonthsAgo(i);
    const monthEnd = startOfMonthsAgo(i - 1);
    const inMonth = rolled.filter(
      (s) => s.snapshotDate >= monthStart && s.snapshotDate < monthEnd
    );
    let valueCents = 0;
    if (inMonth.length > 0) {
      // Sum the latest snapshot per creator for that month so the
      // platform MRR totals all creators correctly.
      const latestPerCreator = new Map<string, number>();
      for (const doc of dailySnapshots) {
        const creatorId = (doc as { creatorClerkUserId?: string }).creatorClerkUserId ?? "";
        const date = new Date((doc as { snapshotDate: Date }).snapshotDate);
        if (date < monthStart || date >= monthEnd) continue;
        latestPerCreator.set(
          creatorId,
          asNumber((doc as { monthlyRecurringCents?: number }).monthlyRecurringCents)
        );
      }
      valueCents = [...latestPerCreator.values()].reduce(
        (acc, v) => acc + v,
        0
      );
    } else {
      valueCents = paidActive
        .filter((s) => {
          const started = s.startedAt ?? s.createdAt;
          return started && started >= monthStart && started < monthEnd;
        })
        .reduce(
          (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
          0
        );
    }
    trend.push({ label: monthLabel(monthStart), valueCents });
  }

  // Acquisition — count of NEW subscriptions per month (any tier).
  // Prefer rolled-up `newSubscribersToday` summed over the month; fall
  // back to counting from the raw Subscription collection.
  const acquisition = [];
  for (let i = buckets - 1; i >= 0; i -= 1) {
    const monthStart = startOfMonthsAgo(i);
    const monthEnd = startOfMonthsAgo(i - 1);
    const inMonth = rolled.filter(
      (s) => s.snapshotDate >= monthStart && s.snapshotDate < monthEnd
    );
    let count = 0;
    if (inMonth.length > 0) {
      count = inMonth.reduce((acc, s) => acc + s.newSubscribersToday, 0);
    } else {
      count = allSubs.filter((s) => {
        const created = s.createdAt;
        return created && created >= monthStart && created < monthEnd;
      }).length;
    }
    acquisition.push({ label: monthLabel(monthStart), count });
  }

  // Top content (platform-wide)
  const topContent = [...content]
    .sort((a, b) => {
      const aMetric =
        a.contentType === "file"
          ? asNumber(a.downloadsCount)
          : asNumber(a.viewsCount);
      const bMetric =
        b.contentType === "file"
          ? asNumber(b.downloadsCount)
          : asNumber(b.viewsCount);
      return bMetric - aMetric;
    })
    .slice(0, 5)
    .map((doc) => {
      const isFile = doc.contentType === "file";
      const stat = isFile
        ? `${asNumber(doc.downloadsCount).toLocaleString()} downloads`
        : `${asNumber(doc.viewsCount).toLocaleString()} views`;
      return {
        id: doc._id.toString(),
        title: doc.title,
        primaryStat: stat,
        creatorName:
          creatorMap.get(doc.creatorClerkUserId)?.creatorName ?? "Unknown",
      };
    });

  const cancelled30d = allSubs.filter(
    (s) =>
      s.status === "canceled" &&
      s.canceledAt &&
      s.canceledAt >= thirtyDaysAgo
  ).length;
  const churnRatePercent =
    allSubs.length > 0
      ? Math.round((cancelled30d / allSubs.length) * 1000) / 10
      : 0;

  const totalPayments = paymentsSucceeded + paymentsFailed;
  const failedPaymentRatioPercent =
    totalPayments > 0
      ? Math.round((paymentsFailed / totalPayments) * 1000) / 10
      : 0;

  return {
    metrics: {
      platformMrrCents,
      activeSubscribers: totalActiveSubscribers,
      totalViews,
      premiumConversionPercent,
    },
    trend,
    acquisition,
    topContent,
    churnRatePercent,
    failedPaymentRatioPercent,
    range,
  };
}

