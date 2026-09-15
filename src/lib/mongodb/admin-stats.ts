import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  ContentModel,
  CreatorProfileModel,
  PaymentModel,
  PlanModel,
  SubscriptionModel,
  UserProfileModel,
  type CreatorProfileDocument,
  type UserProfileDocument,
} from "@/lib/mongodb/models";
import { isAdminEmail, getAdminEmails } from "@/lib/auth/roles";
import { isRecordId } from "@/lib/db/ids";
import {
  adminPageMeta,
  ilikeContains,
  type AdminListQuery,
} from "@/lib/auth/admin-list-query";
import { loadPlatformSettings } from "@/lib/mongodb/admin-settings";
import { pgQuery } from "@/lib/db/pool";
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

async function sqlCount(sql: string, params: unknown[] = []): Promise<number> {
  const res = await pgQuery<{ count: string }>(sql, params);
  return Number(res.rows[0]?.count ?? 0);
}

async function sqlSum(sql: string, params: unknown[] = []): Promise<number> {
  const res = await pgQuery<{ sum: string }>(sql, params);
  return Number(res.rows[0]?.sum ?? 0);
}

function emptyListQuery(): AdminListQuery {
  return { q: "", page: 1, pageSize: 25, skip: 0, csv: false };
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
  const settings = await loadPlatformSettings();
  const feeBps = settings.platformFeeBps;

  const [
    totalUsers,
    activeCreators,
    activeSubscriberCount,
    activeSubCount,
    paidSubCount,
    grossMrrCents,
    cancelled30d,
    publishedContent,
    failedPaymentCount30d,
    succeededPaymentCount,
    failedPaymentCountAll,
    collected30dCents,
    recentSubsRaw,
    recentPaymentsRaw,
    recentContentRaw,
  ] = await Promise.all([
    sqlCount(`SELECT COUNT(*)::text AS count FROM user_profiles`),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM creator_profiles WHERE profile_status = 'published'`
    ),
    sqlCount(
      `SELECT COUNT(DISTINCT subscriber_clerk_user_id)::text AS count
       FROM subscriptions
       WHERE status IN ('active','trialing','past_due')`
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count
       FROM subscriptions
       WHERE status IN ('active','trialing','past_due')`
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count
       FROM subscriptions
       WHERE status IN ('active','trialing','past_due')
         AND access_level IS DISTINCT FROM 'free'`
    ),
    sqlSum(
      `SELECT COALESCE(SUM(ROUND(price_monthly * 100)),0)::text AS sum
       FROM subscriptions
       WHERE status IN ('active','trialing','past_due')
         AND access_level IS DISTINCT FROM 'free'`
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM subscriptions
       WHERE status = 'canceled' AND canceled_at >= $1`,
      [thirtyDaysAgo]
    ),
    sqlCount(`SELECT COUNT(*)::text AS count FROM content WHERE status = 'published'`),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM payments WHERE status = 'failed' AND created_at >= $1`,
      [thirtyDaysAgo]
    ),
    sqlCount(`SELECT COUNT(*)::text AS count FROM payments WHERE status = 'succeeded'`),
    sqlCount(`SELECT COUNT(*)::text AS count FROM payments WHERE status = 'failed'`),
    sqlSum(
      `SELECT COALESCE(SUM(amount_cents),0)::text AS sum
       FROM payments WHERE status = 'succeeded' AND paid_at >= $1`,
      [thirtyDaysAgo]
    ),
    SubscriptionModel.find({}).sort({ updatedAt: -1, createdAt: -1 }).limit(8),
    PaymentModel.find({}).sort({ paidAt: -1, createdAt: -1 }).limit(8),
    ContentModel.find({ status: "published" }).sort({ publishedAt: -1, createdAt: -1 }).limit(8),
  ]);

  const conversionRatePercent =
    activeSubCount > 0 ? Math.round((paidSubCount / activeSubCount) * 1000) / 10 : 0;
  const totalPayments = succeededPaymentCount + failedPaymentCountAll;
  const paymentSuccessRatePercent =
    totalPayments > 0
      ? Math.round((succeededPaymentCount / totalPayments) * 1000) / 10
      : 100;
  const userRetentionRatePercent =
    totalUsers > 0 ? Math.round((activeSubscriberCount / totalUsers) * 1000) / 10 : 0;
  const platformTakeCents = Math.round((collected30dCents * feeBps) / 10000);

  const trend: AdminOverviewResponse["trend"] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const monthStart = startOfMonthsAgo(i);
    const monthEnd = startOfMonthsAgo(i - 1);
    const valueCents = await sqlSum(
      `SELECT COALESCE(SUM(amount_cents),0)::text AS sum
       FROM payments
       WHERE status = 'succeeded'
         AND paid_at >= $1 AND paid_at < $2`,
      [monthStart, monthEnd]
    );
    trend.push({ label: monthLabel(monthStart), valueCents });
  }

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
      activeSubscribers: activeSubscriberCount,
      activeCreators,
      monthlyRevenueCents: grossMrrCents,
      grossMrrCents,
      collected30dCents,
      platformTakeCents,
      platformFeeBps: feeBps,
      failedPayments: failedPaymentCount30d,
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
export async function getAdminUsers(
  list: AdminListQuery = emptyListQuery(),
  roleFilter: "all" | "subscriber" | "creator" | "admin" = "all"
): Promise<AdminUsersResponse> {
  await connectToMongoDB();
  const adminEmails = getAdminEmails();
  const params: unknown[] = [];
  const where: string[] = ["TRUE"];

  if (list.q) {
    params.push(ilikeContains(list.q));
    const i = params.length;
    where.push(
      `(COALESCE(display_name,'') ILIKE $${i} OR COALESCE(full_name,'') ILIKE $${i} OR COALESCE(email,'') ILIKE $${i} OR clerk_user_id ILIKE $${i})`
    );
  }
  if (roleFilter === "creator") {
    where.push(`role = 'creator'`);
    if (adminEmails.length) {
      params.push(adminEmails);
      where.push(`NOT (LOWER(email) = ANY($${params.length}::text[]))`);
    }
  } else if (roleFilter === "subscriber") {
    where.push(`role = 'subscriber'`);
    if (adminEmails.length) {
      params.push(adminEmails);
      where.push(`NOT (LOWER(email) = ANY($${params.length}::text[]))`);
    }
  } else if (roleFilter === "admin") {
    if (adminEmails.length === 0) {
      where.push("FALSE");
    } else {
      params.push(adminEmails);
      where.push(`LOWER(email) = ANY($${params.length}::text[])`);
    }
  }

  const whereSql = where.join(" AND ");
  const total = await sqlCount(
    `SELECT COUNT(*)::text AS count FROM user_profiles WHERE ${whereSql}`,
    params
  );
  const pageParams = [...params, list.pageSize, list.skip];
  const pageRes = await pgQuery(
    `SELECT * FROM user_profiles WHERE ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams
  );
  const users = pageRes.rows.map((row) => {
    const doc = {
      _id: { toString: () => String(row.id) },
      clerkUserId: String(row.clerk_user_id ?? ""),
      email: String(row.email ?? ""),
      displayName: String(row.display_name ?? ""),
      fullName: String(row.full_name ?? ""),
      role: row.role as "subscriber" | "creator",
      accountStatus: String(row.account_status ?? "active"),
      avatarUrl: String(row.avatar_url ?? ""),
      createdAt: new Date(String(row.created_at)),
    };
    return doc;
  });

  const clerkIds = users.map((u) => u.clerkUserId).filter(Boolean);
  const activeSubs = clerkIds.length
    ? await SubscriptionModel.find({
        subscriberClerkUserId: { $in: clerkIds },
        status: { $in: [...ACTIVE_STATUSES] },
      })
    : [];

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

  const [activeAccounts, suspended, deactivated, totalUsers] = await Promise.all([
    sqlCount(`SELECT COUNT(*)::text AS count FROM user_profiles WHERE account_status = 'active'`),
    sqlCount(`SELECT COUNT(*)::text AS count FROM user_profiles WHERE account_status = 'suspended'`),
    sqlCount(`SELECT COUNT(*)::text AS count FROM user_profiles WHERE account_status = 'deleted'`),
    sqlCount(`SELECT COUNT(*)::text AS count FROM user_profiles`),
  ]);

  return {
    metrics: {
      totalUsers,
      activeAccounts,
      suspended,
      deactivated,
    },
    users: rows,
    page: adminPageMeta(total, list),
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

  // Accept either the Postgres `_id` or the Clerk `clerkUserId` so the
  // route can take whichever the UI has.
  const profile = isRecordId(userIdOrClerkId)
    ? await UserProfileModel.findById(userIdOrClerkId)
    : await UserProfileModel.findOne({ clerkUserId: userIdOrClerkId });
  if (!profile) return null;

  const clerkUserId = profile.clerkUserId;

  const [subscriptions, payments] = await Promise.all([
    SubscriptionModel.find({ subscriberClerkUserId: clerkUserId })
      .sort({
        updatedAt: -1,
        createdAt: -1,
      })
      .limit(50),
    PaymentModel.find({ subscriberClerkUserId: clerkUserId })
      .sort({
        paidAt: -1,
        createdAt: -1,
      })
      .limit(50),
  ]);
  const creatorIds = Array.from(
    new Set([clerkUserId, ...subscriptions.map((s) => s.creatorClerkUserId)])
  );
  const creators = creatorIds.length
    ? await CreatorProfileModel.find({ clerkUserId: { $in: creatorIds } })
    : [];
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

  const filter = isRecordId(input.userIdOrClerkId)
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
export async function getAdminCreators(
  list: AdminListQuery = emptyListQuery()
): Promise<AdminCreatorsResponse> {
  await connectToMongoDB();

  const params: unknown[] = [];
  let where = "TRUE";
  if (list.q) {
    params.push(ilikeContains(list.q));
    where = `(cp.creator_name ILIKE $1 OR cp.creator_slug ILIKE $1 OR COALESCE(up.email,'') ILIKE $1)`;
  }
  const total = await sqlCount(
    `SELECT COUNT(*)::text AS count
     FROM creator_profiles cp
     LEFT JOIN user_profiles up ON up.clerk_user_id = cp.clerk_user_id
     WHERE ${where}`,
    params
  );
  const pageParams = [...params, list.pageSize, list.skip];
  const lim = pageParams.length - 1;
  const off = pageParams.length;
  const pageRes = await pgQuery(
    `SELECT cp.* FROM creator_profiles cp
     LEFT JOIN user_profiles up ON up.clerk_user_id = cp.clerk_user_id
     WHERE ${where}
     ORDER BY cp.created_at DESC
     LIMIT $${lim} OFFSET $${off}`,
    pageParams
  );

  const creators = pageRes.rows;
  const creatorClerkIds = creators.map((c) => String(c.clerk_user_id ?? "")).filter(Boolean);
  const allSubs = creatorClerkIds.length
    ? await SubscriptionModel.find({
        creatorClerkUserId: { $in: creatorClerkIds },
        status: { $in: [...ACTIVE_STATUSES] },
      })
    : [];
  const contentCounts = creatorClerkIds.length
    ? await pgQuery<{ creator_clerk_user_id: string; n: string }>(
        `SELECT creator_clerk_user_id, COUNT(*)::text AS n
         FROM content
         WHERE creator_clerk_user_id = ANY($1::text[])
           AND status IS DISTINCT FROM 'archived'
         GROUP BY creator_clerk_user_id`,
        [creatorClerkIds]
      )
    : { rows: [] as Array<{ creator_clerk_user_id: string; n: string }> };

  const userProfiles = creatorClerkIds.length
    ? await UserProfileModel.find({ clerkUserId: { $in: creatorClerkIds } })
    : [];
  const emailByClerkId = new Map(userProfiles.map((u) => [u.clerkUserId, u.email ?? ""]));
  const avatarByClerkId = new Map(userProfiles.map((u) => [u.clerkUserId, u.avatarUrl ?? ""]));
  const contentByCreator = new Map(
    contentCounts.rows.map((r) => [r.creator_clerk_user_id, Number(r.n)])
  );
  const subsByCreator = new Map<string, typeof allSubs>();
  for (const sub of allSubs) {
    const listFor = subsByCreator.get(sub.creatorClerkUserId) ?? [];
    listFor.push(sub);
    subsByCreator.set(sub.creatorClerkUserId, listFor);
  }

  const rows: AdminCreatorRow[] = creators.map((row) => {
    const clerkUserId = String(row.clerk_user_id ?? "");
    const subs = subsByCreator.get(clerkUserId) ?? [];
    const paidSubs = subs.filter((s) => s.accessLevel !== "free");
    const mrrCents = paidSubs.reduce(
      (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
      0
    );
    return {
      id: String(row.id),
      clerkUserId,
      creatorSlug: String(row.creator_slug ?? ""),
      creatorName: String(row.creator_name ?? ""),
      email: emailByClerkId.get(clerkUserId) ?? "",
      avatarUrl: String(row.avatar_url ?? "") || avatarByClerkId.get(clerkUserId) || "",
      subscribersCount: subs.length,
      paidSubscribersCount: paidSubs.length,
      contentCount: contentByCreator.get(clerkUserId) ?? 0,
      mrrCents,
      status: String(row.profile_status) === "published" ? "Active" : "Review",
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  });

  const [totalCreators, pendingReview, totalCreatorMrrCents, totalActiveSubs] = await Promise.all([
    sqlCount(`SELECT COUNT(*)::text AS count FROM creator_profiles`),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM creator_profiles WHERE profile_status IS DISTINCT FROM 'published'`
    ),
    sqlSum(
      `SELECT COALESCE(SUM(ROUND(price_monthly * 100)),0)::text AS sum
       FROM subscriptions
       WHERE status IN ('active','trialing','past_due')
         AND access_level IS DISTINCT FROM 'free'`
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM subscriptions WHERE status IN ('active','trialing','past_due')`
    ),
  ]);
  const avgAudience = totalCreators ? Math.round(totalActiveSubs / totalCreators) : 0;

  return {
    metrics: {
      totalCreators,
      totalCreatorMrrCents,
      avgAudience,
      pendingReview,
    },
    creators: rows,
    page: adminPageMeta(total, list),
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/subscribers
// ──────────────────────────────────────────────────────────────
export async function getAdminSubscribers(
  list: AdminListQuery = emptyListQuery()
): Promise<AdminSubscribersResponse> {
  await connectToMongoDB();

  const params: unknown[] = [];
  let where = "TRUE";
  if (list.q) {
    params.push(ilikeContains(list.q));
    where = `(COALESCE(up.display_name,'') ILIKE $1 OR COALESCE(up.full_name,'') ILIKE $1 OR COALESCE(up.email,'') ILIKE $1 OR COALESCE(cp.creator_name,'') ILIKE $1 OR s.access_level ILIKE $1 OR s.status ILIKE $1)`;
  }

  const [pageRes, total, activeCount, premiumCount, basicCount, freeCount, highCount, churnRiskCount] =
    await Promise.all([
      pgQuery<{
        id: string;
        subscriber_clerk_user_id: string;
        access_level: string;
        status: string;
        started_at: string | null;
        created_at: string;
        current_period_end: string | null;
        canceled_at: string | null;
        cancel_at_period_end: boolean;
        subscriber_name: string;
        subscriber_email: string;
        avatar_url: string;
        creator_name: string;
        creator_slug: string;
      }>(
        `SELECT s.id::text AS id, s.subscriber_clerk_user_id, s.access_level, s.status,
                s.started_at, s.created_at, s.current_period_end, s.canceled_at,
                s.cancel_at_period_end,
                COALESCE(up.display_name, up.full_name, up.email, 'Unknown') AS subscriber_name,
                COALESCE(up.email, '') AS subscriber_email,
                COALESCE(up.avatar_url, '') AS avatar_url,
                COALESCE(cp.creator_name, 'Unknown creator') AS creator_name,
                COALESCE(cp.creator_slug, '') AS creator_slug
         FROM subscriptions s
         LEFT JOIN user_profiles up ON up.clerk_user_id = s.subscriber_clerk_user_id
         LEFT JOIN creator_profiles cp ON cp.clerk_user_id = s.creator_clerk_user_id
         WHERE ${where}
         ORDER BY s.updated_at DESC, s.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, list.pageSize, list.skip]
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count
         FROM subscriptions s
         LEFT JOIN user_profiles up ON up.clerk_user_id = s.subscriber_clerk_user_id
         LEFT JOIN creator_profiles cp ON cp.clerk_user_id = s.creator_clerk_user_id
         WHERE ${where}`,
        params
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count FROM subscriptions WHERE status IN ('active','trialing','past_due')`
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count FROM subscriptions WHERE status IN ('active','trialing','past_due') AND access_level = 'premium'`
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count FROM subscriptions WHERE status IN ('active','trialing','past_due') AND access_level = 'basic'`
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count FROM subscriptions WHERE status IN ('active','trialing','past_due') AND access_level = 'free'`
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count FROM subscriptions WHERE status IN ('active','trialing','past_due') AND access_level = 'premium'`
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count FROM subscriptions WHERE status IN ('past_due','canceled','expired')`
      ),
    ]);

  const rows: AdminSubscriberRow[] = pageRes.rows.map((sub) => ({
    subscriptionId: sub.id,
    subscriberClerkUserId: sub.subscriber_clerk_user_id,
    name: shortName(sub.subscriber_name),
    email: sub.subscriber_email,
    avatarUrl: sub.avatar_url,
    creatorName: sub.creator_name,
    creatorSlug: sub.creator_slug,
    plan: planLabel(sub.access_level),
    accessLevel: (sub.access_level as PlanAccessLevel) ?? "free",
    status: sub.status as AdminSubscriberRow["status"],
    renewalLabel: formatRenewalLabel({
      status: sub.status,
      accessLevel: sub.access_level,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at) : null,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    }),
    engagement: classifyEngagement(sub.access_level),
    startedAt: new Date(sub.started_at ?? sub.created_at).toISOString(),
  }));

  const denom = activeCount || 1;

  return {
    metrics: {
      activeSubscribers: activeCount,
      premiumRatioPercent: Math.round((premiumCount / denom) * 1000) / 10,
      highEngagementCount: highCount,
      churnRiskCount,
    },
    subscribers: rows,
    planDistribution: {
      freePercent: Math.round((freeCount / denom) * 1000) / 10,
      basicPercent: Math.round((basicCount / denom) * 1000) / 10,
      premiumPercent: Math.round((premiumCount / denom) * 1000) / 10,
    },
    page: adminPageMeta(total, list),
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/plans
// ──────────────────────────────────────────────────────────────
export async function getAdminPlans(
  list: AdminListQuery = emptyListQuery()
): Promise<AdminPlansResponse> {
  await connectToMongoDB();

  const params: unknown[] = [];
  let where = "TRUE";
  if (list.q) {
    params.push(ilikeContains(list.q));
    where = `(p.name ILIKE $1 OR COALESCE(cp.creator_name,'') ILIKE $1 OR p.access_level ILIKE $1)`;
  }

  const [total, pageRes, planAgg, subAgg, topCreators, totalActivePlans] = await Promise.all([
    sqlCount(
      `SELECT COUNT(*)::text AS count
       FROM plans p
       LEFT JOIN creator_profiles cp ON cp.clerk_user_id = p.creator_clerk_user_id
       WHERE ${where}`,
      params
    ),
    pgQuery<{
      id: string;
      creator_clerk_user_id: string;
      name: string;
      access_level: string;
      price_monthly: string | number;
      is_active: boolean;
      creator_name: string;
      creator_slug: string;
    }>(
      `SELECT p.id::text AS id, p.creator_clerk_user_id, p.name, p.access_level,
              p.price_monthly, p.is_active,
              COALESCE(cp.creator_name, 'Unknown creator') AS creator_name,
              COALESCE(cp.creator_slug, '') AS creator_slug
       FROM plans p
       LEFT JOIN creator_profiles cp ON cp.clerk_user_id = p.creator_clerk_user_id
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, list.pageSize, list.skip]
    ),
    pgQuery<{
      access_level: string;
      plan_count: string;
      active_plan_count: string;
      avg_price: string;
    }>(
      `SELECT access_level,
              COUNT(*)::text AS plan_count,
              COUNT(*) FILTER (WHERE is_active)::text AS active_plan_count,
              COALESCE(AVG(price_monthly) FILTER (WHERE is_active), 0)::text AS avg_price
       FROM plans
       GROUP BY access_level`
    ),
    pgQuery<{ access_level: string; n: string; mrr: string }>(
      `SELECT access_level, COUNT(*)::text AS n,
              COALESCE(SUM(ROUND(price_monthly * 100)),0)::text AS mrr
       FROM subscriptions
       WHERE status IN ('active','trialing','past_due')
       GROUP BY access_level`
    ),
    pgQuery<{ access_level: string; creator_name: string }>(
      `SELECT DISTINCT ON (access_level) access_level, creator_name
       FROM (
         SELECT s.access_level, COALESCE(cp.creator_name, '—') AS creator_name, COUNT(*) AS n
         FROM subscriptions s
         LEFT JOIN creator_profiles cp ON cp.clerk_user_id = s.creator_clerk_user_id
         WHERE s.status IN ('active','trialing','past_due')
         GROUP BY s.access_level, COALESCE(cp.creator_name, '—')
       ) ranked
       ORDER BY access_level, n DESC`
    ),
    sqlCount(`SELECT COUNT(*)::text AS count FROM plans WHERE is_active IS TRUE`),
  ]);

  const planIds = pageRes.rows.map((row) => row.id).filter(Boolean);
  const subCounts =
    planIds.length > 0
      ? await pgQuery<{ plan_id: string; n: string }>(
          `SELECT plan_id::text AS plan_id, COUNT(*)::text AS n
           FROM subscriptions
           WHERE status IN ('active','trialing','past_due')
             AND plan_id = ANY($1::uuid[])
           GROUP BY plan_id`,
          [planIds]
        )
      : { rows: [] as Array<{ plan_id: string; n: string }> };
  const subscribersByPlanId = new Map(
    subCounts.rows.map((row) => [row.plan_id, Number(row.n)])
  );

  const planRows: AdminPlanRow[] = pageRes.rows.map((row) => ({
    id: row.id,
    creatorClerkUserId: row.creator_clerk_user_id,
    creatorName: row.creator_name,
    creatorSlug: row.creator_slug,
    name: row.name,
    accessLevel: row.access_level as PlanAccessLevel,
    priceMonthly: asNumber(row.price_monthly),
    isActive: Boolean(row.is_active),
    subscribersCount: subscribersByPlanId.get(row.id) ?? 0,
  }));

  const planAggByLevel = new Map(planAgg.rows.map((row) => [row.access_level, row]));
  const subAggByLevel = new Map(subAgg.rows.map((row) => [row.access_level, row]));
  const topByLevel = new Map(topCreators.rows.map((row) => [row.access_level, row.creator_name]));
  const subscribersByAccessLevel: Record<PlanAccessLevel, number> = {
    free: Number(subAggByLevel.get("free")?.n ?? 0),
    basic: Number(subAggByLevel.get("basic")?.n ?? 0),
    premium: Number(subAggByLevel.get("premium")?.n ?? 0),
  };

  const groups: AdminPlanGroup[] = (["free", "basic", "premium"] as PlanAccessLevel[]).map(
    (accessLevel) => {
      const agg = planAggByLevel.get(accessLevel);
      return {
        accessLevel,
        label: planLabel(accessLevel),
        planCount: Number(agg?.plan_count ?? 0),
        activePlanCount: Number(agg?.active_plan_count ?? 0),
        totalSubscribers: subscribersByAccessLevel[accessLevel],
        averagePrice: Math.round(asNumber(agg?.avg_price) * 100) / 100,
        totalMrrCents: Number(subAggByLevel.get(accessLevel)?.mrr ?? 0),
        topCreatorName: topByLevel.get(accessLevel) ?? "—",
      };
    }
  );

  const mostPopular = [...groups].sort((a, b) => b.totalSubscribers - a.totalSubscribers)[0];
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
    page: adminPageMeta(total, list),
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/content
// ──────────────────────────────────────────────────────────────
export async function getAdminContent(
  list: AdminListQuery = emptyListQuery()
): Promise<AdminContentResponse> {
  await connectToMongoDB();

  const params: unknown[] = [];
  let where = "TRUE";
  if (list.q) {
    params.push(ilikeContains(list.q));
    where = `(c.title ILIKE $1 OR COALESCE(c.slug,'') ILIKE $1 OR COALESCE(cp.creator_name,'') ILIKE $1)`;
  }

  const [contentRows, total, totalPublished, totalResources, pendingReview, viewsRow] =
    await Promise.all([
      pgQuery<{
        id: string;
        title: string;
        content_type: string;
        file_subtype: string | null;
        required_plan: string;
        status: string;
        views_count: string | number;
        downloads_count: string | number;
        created_at: string;
        creator_name: string;
        creator_slug: string;
      }>(
        `SELECT c.id::text AS id, c.title, c.content_type, c.file_subtype, c.required_plan,
                c.status, c.views_count, c.downloads_count, c.created_at,
                COALESCE(cp.creator_name, 'Unknown creator') AS creator_name,
                COALESCE(cp.creator_slug, '') AS creator_slug
         FROM content c
         LEFT JOIN creator_profiles cp ON cp.clerk_user_id = c.creator_clerk_user_id
         WHERE ${where}
         ORDER BY c.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, list.pageSize, list.skip]
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count
         FROM content c
         LEFT JOIN creator_profiles cp ON cp.clerk_user_id = c.creator_clerk_user_id
         WHERE ${where}`,
        params
      ),
      ContentModel.countDocuments({ status: "published" }),
      ContentModel.countDocuments({ contentType: "file" }),
      ContentModel.countDocuments({ status: "draft" }),
      sqlSum(`SELECT COALESCE(SUM(views_count),0)::text AS sum FROM content`),
    ]);

  const rows: AdminContentRow[] = contentRows.rows.map((doc) => ({
    id: doc.id,
    title: doc.title,
    contentType: doc.content_type as "video" | "article" | "file",
    fileSubtype: (doc.file_subtype ?? "") as "pdf" | "zip" | "rar" | "",
    accessLevel: doc.required_plan as PlanAccessLevel,
    status: doc.status as "draft" | "published" | "archived",
    creatorName: doc.creator_name,
    creatorSlug: doc.creator_slug,
    viewsCount: asNumber(doc.views_count),
    downloadsCount: asNumber(doc.downloads_count),
    createdAt: new Date(doc.created_at).toISOString(),
  }));

  return {
    metrics: {
      totalPublished,
      totalResources,
      totalViews: viewsRow,
      pendingReview,
    },
    content: rows,
    page: adminPageMeta(total, list),
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/subscriptions
// ──────────────────────────────────────────────────────────────
export async function getAdminSubscriptions(
  list: AdminListQuery = emptyListQuery()
): Promise<AdminSubscriptionsResponse> {
  await connectToMongoDB();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const params: unknown[] = [];
  let where = "TRUE";
  if (list.q) {
    params.push(ilikeContains(list.q));
    where = `(COALESCE(up.display_name,'') ILIKE $1 OR COALESCE(up.full_name,'') ILIKE $1 OR COALESCE(up.email,'') ILIKE $1 OR COALESCE(cp.creator_name,'') ILIKE $1 OR s.access_level ILIKE $1 OR s.status ILIKE $1)`;
  }

  const [pageRes, failedCharges, renewalsToday, total, activeCount, cancelled, pastDue] =
    await Promise.all([
      pgQuery<{
        id: string;
        access_level: string;
        status: string;
        started_at: string | null;
        created_at: string;
        current_period_end: string | null;
        canceled_at: string | null;
        cancel_at_period_end: boolean;
        price_monthly: string | number;
        subscriber_name: string;
        subscriber_email: string;
        creator_name: string;
        creator_slug: string;
      }>(
        `SELECT s.id::text AS id, s.access_level, s.status, s.started_at, s.created_at,
                s.current_period_end, s.canceled_at, s.cancel_at_period_end, s.price_monthly,
                COALESCE(up.display_name, up.full_name, up.email, 'Unknown') AS subscriber_name,
                COALESCE(up.email, '') AS subscriber_email,
                COALESCE(cp.creator_name, 'Unknown') AS creator_name,
                COALESCE(cp.creator_slug, '') AS creator_slug
         FROM subscriptions s
         LEFT JOIN user_profiles up ON up.clerk_user_id = s.subscriber_clerk_user_id
         LEFT JOIN creator_profiles cp ON cp.clerk_user_id = s.creator_clerk_user_id
         WHERE ${where}
         ORDER BY s.updated_at DESC, s.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, list.pageSize, list.skip]
      ),
      PaymentModel.countDocuments({ status: "failed" }),
      SubscriptionModel.countDocuments({
        currentPeriodEnd: { $gte: todayStart, $lte: todayEnd },
        status: { $in: [...ACTIVE_STATUSES] },
      }),
      sqlCount(
        `SELECT COUNT(*)::text AS count
         FROM subscriptions s
         LEFT JOIN user_profiles up ON up.clerk_user_id = s.subscriber_clerk_user_id
         LEFT JOIN creator_profiles cp ON cp.clerk_user_id = s.creator_clerk_user_id
         WHERE ${where}`,
        params
      ),
      SubscriptionModel.countDocuments({ status: { $in: [...ACTIVE_STATUSES] } }),
      SubscriptionModel.countDocuments({ status: "canceled" }),
      SubscriptionModel.countDocuments({ status: "past_due" }),
    ]);

  const rows: AdminSubscriptionRow[] = pageRes.rows.map((sub) => ({
    id: sub.id,
    subscriberName: sub.subscriber_name,
    subscriberEmail: sub.subscriber_email,
    creatorName: sub.creator_name,
    creatorSlug: sub.creator_slug,
    plan: planLabel(sub.access_level),
    accessLevel: (sub.access_level as PlanAccessLevel) ?? "free",
    status: sub.status as AdminSubscriptionRow["status"],
    startedAt: new Date(sub.started_at ?? sub.created_at).toISOString(),
    renewalLabel: formatRenewalLabel({
      status: sub.status,
      accessLevel: sub.access_level,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at) : null,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    }),
    priceMonthly: asNumber(sub.price_monthly),
  }));

  return {
    metrics: {
      activeSubscriptions: activeCount,
      renewalsToday,
      failedCharges,
      pendingChurn: cancelled,
    },
    subscriptions: rows,
    statusBreakdown: {
      active: activeCount,
      cancelled,
      pastDue,
    },
    page: adminPageMeta(total, list),
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/payments
// ──────────────────────────────────────────────────────────────
export async function getAdminPayments(
  list: AdminListQuery = emptyListQuery()
): Promise<AdminPaymentsResponse> {
  await connectToMongoDB();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const params: unknown[] = [];
  let where = "TRUE";
  if (list.q) {
    params.push(ilikeContains(list.q));
    where = `(COALESCE(up.display_name,'') ILIKE $1 OR COALESCE(up.email,'') ILIKE $1 OR COALESCE(cp.creator_name,'') ILIKE $1 OR p.status ILIKE $1 OR COALESCE(p.stripe_invoice_id,'') ILIKE $1)`;
  }

  const [pageRes, total] = await Promise.all([
    pgQuery<{
      id: string;
      subscriber_clerk_user_id: string;
      creator_clerk_user_id: string;
      plan_id: string | null;
      amount_cents: string | number;
      currency: string;
      status: string;
      stripe_charge_id: string | null;
      stripe_payment_intent_id: string | null;
      stripe_invoice_id: string | null;
      paid_at: string | null;
      created_at: string;
      receipt_url: string | null;
      subscriber_name: string;
      subscriber_email: string;
      creator_name: string;
    }>(
      `SELECT p.id::text AS id, p.subscriber_clerk_user_id, p.creator_clerk_user_id, p.plan_id::text AS plan_id,
              p.amount_cents, p.currency, p.status, p.stripe_charge_id, p.stripe_payment_intent_id,
              p.stripe_invoice_id, p.paid_at, p.created_at, p.receipt_url,
              COALESCE(up.display_name, up.full_name, up.email, 'Unknown') AS subscriber_name,
              COALESCE(up.email, '') AS subscriber_email,
              COALESCE(cp.creator_name, 'Unknown') AS creator_name
       FROM payments p
       LEFT JOIN user_profiles up ON up.clerk_user_id = p.subscriber_clerk_user_id
       LEFT JOIN creator_profiles cp ON cp.clerk_user_id = p.creator_clerk_user_id
       WHERE ${where}
       ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, list.pageSize, list.skip]
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count
       FROM payments p
       LEFT JOIN user_profiles up ON up.clerk_user_id = p.subscriber_clerk_user_id
       LEFT JOIN creator_profiles cp ON cp.clerk_user_id = p.creator_clerk_user_id
       WHERE ${where}`,
      params
    ),
  ]);

  const planIds = Array.from(
    new Set(pageRes.rows.map((p) => p.plan_id).filter(Boolean))
  ) as string[];
  const plans = planIds.length ? await PlanModel.find({ _id: { $in: planIds } }) : [];
  const planLevelById = new Map(
    plans.map((plan) => [plan._id.toString(), plan.accessLevel as AdminPaymentRow["accessLevel"]])
  );

  const rows: AdminPaymentRow[] = pageRes.rows.map((doc) => ({
    id: doc.id,
    subscriberName: doc.subscriber_name,
    subscriberEmail: doc.subscriber_email,
    creatorName: doc.creator_name,
    amountCents: asNumber(doc.amount_cents),
    currency: doc.currency,
    status: doc.status as AdminPaymentRow["status"],
    accessLevel: doc.plan_id ? planLevelById.get(doc.plan_id) ?? null : null,
    paymentMethodLabel: doc.stripe_charge_id || doc.stripe_payment_intent_id ? "Stripe" : "—",
    paidAt: doc.paid_at ? new Date(doc.paid_at).toISOString() : null,
    createdAt: new Date(doc.created_at).toISOString(),
    receiptUrl: doc.receipt_url ?? "",
    hasStripeReference: Boolean(
      doc.stripe_payment_intent_id || doc.stripe_charge_id || doc.stripe_invoice_id
    ),
  }));

  const [
    recentSucceeded,
    recentFailed,
    volume30dCents,
    refunds,
    failedCount,
    atRiskCents,
  ] = await Promise.all([
    PaymentModel.countDocuments({
      status: "succeeded",
      paidAt: { $gte: thirtyDaysAgo },
    }),
    PaymentModel.countDocuments({
      status: "failed",
      createdAt: { $gte: thirtyDaysAgo },
    }),
    sqlSum(
      `SELECT COALESCE(SUM(amount_cents),0)::text AS sum
       FROM payments WHERE status = 'succeeded' AND paid_at >= $1`,
      [thirtyDaysAgo]
    ),
    PaymentModel.countDocuments({ status: "refunded" }),
    PaymentModel.countDocuments({ status: "failed" }),
    sqlSum(
      `SELECT COALESCE(SUM(amount_cents),0)::text AS sum
       FROM payments WHERE status = 'failed'`
    ),
  ]);
  const recentTotal = recentSucceeded + recentFailed;

  const successRatePercent =
    recentTotal > 0
      ? Math.round((recentSucceeded / recentTotal) * 1000) / 10
      : 100;

  return {
    metrics: {
      volume30dCents,
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
    page: adminPageMeta(total, list),
  };
}

// ──────────────────────────────────────────────────────────────
// /admin/notifications
// ──────────────────────────────────────────────────────────────
export async function getAdminNotifications(
  list: AdminListQuery = emptyListQuery()
): Promise<AdminNotificationsResponse> {
  await connectToMongoDB();

  const params: unknown[] = [];
  let where = "TRUE";
  if (list.q) {
    params.push(ilikeContains(list.q));
    where = `(n.title ILIKE $1 OR COALESCE(n.message,'') ILIKE $1 OR COALESCE(up.display_name,'') ILIKE $1 OR COALESCE(up.email,'') ILIKE $1 OR n.category ILIKE $1)`;
  }

  const [pageRes, totalSystemAlerts] = await Promise.all([
    pgQuery<{
      id: string;
      category: string;
      title: string;
      recipient_clerk_user_id: string;
      is_read: boolean;
      created_at: string;
      recipient_name: string;
    }>(
      `SELECT n.id::text AS id, n.category, n.title, n.recipient_clerk_user_id, n.is_read, n.created_at,
              COALESCE(up.display_name, up.full_name, up.email, 'Unknown') AS recipient_name
       FROM notifications n
       LEFT JOIN user_profiles up ON up.clerk_user_id = n.recipient_clerk_user_id
       WHERE ${where}
       ORDER BY n.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, list.pageSize, list.skip]
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count
       FROM notifications n
       LEFT JOIN user_profiles up ON up.clerk_user_id = n.recipient_clerk_user_id
       WHERE ${where}`,
      params
    ),
  ]);

  const rows: AdminNotificationRow[] = pageRes.rows.map((doc) => ({
    id: doc.id,
    category: doc.category as AdminNotificationRow["category"],
    title: doc.title,
    recipientName: doc.recipient_name,
    recipientClerkUserId: doc.recipient_clerk_user_id,
    isRead: doc.is_read ?? false,
    createdAt: new Date(doc.created_at).toISOString(),
  }));

  return {
    metrics: {
      totalSystemAlerts,
      deliverySuccessPercent: 100,
      failedDelivery: 0,
    },
    notifications: rows,
    page: adminPageMeta(totalSystemAlerts, list),
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
  const settings = await loadPlatformSettings();
  const feeBps = settings.platformFeeBps;

  const [
    grossMrrCents,
    activeSubCount,
    paidSubCount,
    activeSubscriberCount,
    totalViews,
    cancelled30d,
    succeeded30d,
    failed30d,
    collected30dCents,
  ] = await Promise.all([
    sqlSum(
      `SELECT COALESCE(SUM(ROUND(price_monthly * 100)),0)::text AS sum
       FROM subscriptions
       WHERE status IN ('active','trialing','past_due')
         AND access_level IS DISTINCT FROM 'free'`
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM subscriptions
       WHERE status IN ('active','trialing','past_due')`
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM subscriptions
       WHERE status IN ('active','trialing','past_due')
         AND access_level IS DISTINCT FROM 'free'`
    ),
    sqlCount(
      `SELECT COUNT(DISTINCT subscriber_clerk_user_id)::text AS count
       FROM subscriptions WHERE status IN ('active','trialing','past_due')`
    ),
    sqlSum(`SELECT COALESCE(SUM(views_count),0)::text AS sum FROM content`),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM subscriptions
       WHERE status = 'canceled' AND canceled_at >= $1`,
      [thirtyDaysAgo]
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM payments
       WHERE status = 'succeeded' AND paid_at >= $1`,
      [thirtyDaysAgo]
    ),
    sqlCount(
      `SELECT COUNT(*)::text AS count FROM payments
       WHERE status = 'failed' AND created_at >= $1`,
      [thirtyDaysAgo]
    ),
    sqlSum(
      `SELECT COALESCE(SUM(amount_cents),0)::text AS sum
       FROM payments WHERE status = 'succeeded' AND paid_at >= $1`,
      [thirtyDaysAgo]
    ),
  ]);

  const premiumConversionPercent = activeSubCount
    ? Math.round((paidSubCount / activeSubCount) * 1000) / 10
    : 0;
  const churnDenom = activeSubCount + cancelled30d;
  const churnRatePercent = churnDenom
    ? Math.round((cancelled30d / churnDenom) * 1000) / 10
    : 0;
  const paymentDenom = succeeded30d + failed30d;
  const failedPaymentRatioPercent = paymentDenom
    ? Math.round((failed30d / paymentDenom) * 1000) / 10
    : 0;
  const platformTakeCents = Math.round((collected30dCents * feeBps) / 10000);

  const trend: AdminAnalyticsResponse["trend"] = [];
  const acquisition: AdminAnalyticsResponse["acquisition"] = [];
  for (let i = buckets - 1; i >= 0; i -= 1) {
    const monthStart = startOfMonthsAgo(i);
    const monthEnd = startOfMonthsAgo(i - 1);
    const [valueCents, count] = await Promise.all([
      sqlSum(
        `SELECT COALESCE(SUM(amount_cents),0)::text AS sum
         FROM payments
         WHERE status = 'succeeded' AND paid_at >= $1 AND paid_at < $2`,
        [monthStart, monthEnd]
      ),
      sqlCount(
        `SELECT COUNT(*)::text AS count FROM subscriptions
         WHERE created_at >= $1 AND created_at < $2`,
        [monthStart, monthEnd]
      ),
    ]);
    trend.push({ label: monthLabel(monthStart), valueCents });
    acquisition.push({ label: monthLabel(monthStart), count });
  }

  const topRes = await pgQuery<{
    id: string;
    title: string;
    content_type: string;
    views_count: string | number;
    downloads_count: string | number;
    creator_clerk_user_id: string;
  }>(
    `SELECT id::text, title, content_type, views_count, downloads_count, creator_clerk_user_id
     FROM content
     WHERE status IS DISTINCT FROM 'archived'
     ORDER BY GREATEST(COALESCE(views_count,0), COALESCE(downloads_count,0)) DESC
     LIMIT 5`
  );
  const topCreatorIds = Array.from(
    new Set(topRes.rows.map((row) => row.creator_clerk_user_id).filter(Boolean))
  );
  const topCreators = topCreatorIds.length
    ? await CreatorProfileModel.find({ clerkUserId: { $in: topCreatorIds } })
    : [];
  const creatorMap = buildCreatorNameMap(topCreators);
  const topContent = topRes.rows.map((row) => {
    const isFile = row.content_type === "file";
    const downloads = asNumber(row.downloads_count);
    const views = asNumber(row.views_count);
    return {
      id: String(row.id),
      title: row.title,
      primaryStat: isFile
        ? `${downloads.toLocaleString()} downloads`
        : `${views.toLocaleString()} views`,
      creatorName: creatorMap.get(row.creator_clerk_user_id)?.creatorName ?? "Unknown",
    };
  });

  return {
    metrics: {
      platformMrrCents: grossMrrCents,
      grossMrrCents,
      collected30dCents,
      platformTakeCents,
      platformFeeBps: feeBps,
      activeSubscribers: activeSubscriberCount,
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

