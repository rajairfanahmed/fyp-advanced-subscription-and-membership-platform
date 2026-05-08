import { ensureCurrentUserProfile } from "@/lib/auth/profile-sync";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  ContentModel,
  CreatorProfileModel,
  PaymentModel,
  PlanModel,
  SubscriberProfileModel,
  SubscriptionModel,
  UserProfileModel,
  type CreatorProfileDocument,
} from "@/lib/mongodb/models";
import { serializePayment } from "@/lib/mongodb/payments";
import { listRecentSnapshotsForCreator } from "@/lib/mongodb/analytics-rollup";
import type {
  CreatorActivityItem,
  CreatorAnalyticsDailyPoint,
  CreatorAnalyticsResponse,
  CreatorOverviewResponse,
  CreatorPublishReadiness,
  CreatorRevenuePoint,
  CreatorRevenueResponse,
  CreatorSubscriberRow,
  CreatorSubscribersResponse,
  CreatorTopContentItem,
  CreatorAnalyticsTopContentItem,
} from "@/types/creator-stats";

type CreatorContext = {
  clerkUserId: string;
  creatorProfile: CreatorProfileDocument;
};

async function requireCreatorContext(): Promise<CreatorContext> {
  const synced = await ensureCurrentUserProfile();
  if (!synced || synced.role !== "creator" || synced.isAdmin) {
    throw new Error("Only creator accounts can view creator stats.");
  }

  const creatorProfile = await CreatorProfileModel.findOne({
    clerkUserId: synced.user.id,
  });
  if (!creatorProfile) {
    throw new Error("Creator profile is missing. Open creator settings once, then try again.");
  }

  return { clerkUserId: synced.user.id, creatorProfile };
}

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function shortName(input?: string) {
  if (!input) return "Subscriber";
  return input.trim() || "Subscriber";
}

function classifyEngagement(accessLevel: string): "High" | "Medium" | "Low" {
  if (accessLevel === "premium") return "High";
  if (accessLevel === "basic") return "Medium";
  return "Low";
}

function planLabel(accessLevel: string): "Free" | "Basic" | "Premium" {
  if (accessLevel === "premium") return "Premium";
  if (accessLevel === "basic") return "Basic";
  return "Free";
}

function isoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
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
  if (opts.accessLevel === "free") return "No renewal";
  if (opts.cancelAtPeriodEnd && opts.currentPeriodEnd) {
    return `Ends ${formatDate(opts.currentPeriodEnd)}`;
  }
  if (opts.currentPeriodEnd) return `Renews ${formatDate(opts.currentPeriodEnd)}`;
  return "Renewal pending";
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

/**
 * Aggregate dashboard metrics for the current creator. Reads from
 * Subscription, Content, Payment, and CreatorProfile. Empty values
 * are surfaced as 0 (never missing) so the UI renders cleanly even
 * for a brand-new creator with zero data.
 */
export async function getCreatorOverview(): Promise<CreatorOverviewResponse> {
  await connectToMongoDB();
  const ctx = await requireCreatorContext();
  const creatorClerkUserId = ctx.clerkUserId;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    subscriptions,
    contentDocs,
    cancelled30dCount,
    recentSubsRaw,
    recentPaymentsRaw,
    publishedContentCount,
    activePlanCount,
  ] = await Promise.all([
    SubscriptionModel.find({ creatorClerkUserId }),
    ContentModel.find(
      { creatorClerkUserId, status: { $ne: "archived" } },
      { title: 1, contentType: 1, viewsCount: 1, downloadsCount: 1, publishedAt: 1, createdAt: 1, status: 1 }
    )
      .sort({ viewsCount: -1, createdAt: -1 })
      .limit(5),
    SubscriptionModel.countDocuments({
      creatorClerkUserId,
      status: "canceled",
      canceledAt: { $gte: thirtyDaysAgo },
    }),
    SubscriptionModel.find({ creatorClerkUserId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(8),
    PaymentModel.find({ creatorClerkUserId, status: "succeeded" })
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(5),
    ContentModel.countDocuments({ creatorClerkUserId, status: "published" }),
    PlanModel.countDocuments({ creatorClerkUserId, isActive: true }),
  ]);

  const activeSubs = subscriptions.filter((s) =>
    ACTIVE_STATUSES.includes(s.status as (typeof ACTIVE_STATUSES)[number])
  );
  const paidSubs = activeSubs.filter((s) => s.accessLevel !== "free");

  const monthlyRevenueCents = paidSubs.reduce(
    (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
    0
  );
  const contentViews = contentDocs.reduce(
    (acc, c) => acc + asNumber(c.viewsCount),
    0
  );
  const conversionRatePercent =
    activeSubs.length > 0
      ? Math.round((paidSubs.length / activeSubs.length) * 1000) / 10
      : 0;

  const topContent: CreatorTopContentItem[] = contentDocs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    contentType: doc.contentType as "video" | "article" | "file",
    viewsCount: asNumber(doc.viewsCount),
    downloadsCount: asNumber(doc.downloadsCount),
    publishedAt: isoOrNull(doc.publishedAt),
  }));

  // Resolve subscriber names for the activity feed in a single round
  // trip rather than N queries.
  const subscriberIds = Array.from(
    new Set(recentSubsRaw.map((s) => s.subscriberClerkUserId))
  );
  const subscriberPayerIds = Array.from(
    new Set(recentPaymentsRaw.map((p) => p.subscriberClerkUserId))
  );
  const allSubscriberIds = Array.from(
    new Set([...subscriberIds, ...subscriberPayerIds])
  );

  const userProfiles = allSubscriberIds.length
    ? await UserProfileModel.find(
        { clerkUserId: { $in: allSubscriberIds } },
        { clerkUserId: 1, displayName: 1, fullName: 1, email: 1 }
      )
    : [];
  const nameByClerkId = new Map<string, string>();
  for (const profile of userProfiles) {
    nameByClerkId.set(
      profile.clerkUserId,
      shortName(profile.displayName || profile.fullName || profile.email)
    );
  }

  const activitySources: CreatorActivityItem[] = [];

  for (const sub of recentSubsRaw) {
    const name = nameByClerkId.get(sub.subscriberClerkUserId) ?? "A subscriber";
    if (sub.status === "canceled" && sub.canceledAt) {
      activitySources.push({
        id: `cancel-${sub._id.toString()}`,
        type: "cancelled",
        text: `${name} cancelled their ${planLabel(sub.accessLevel)} subscription`,
        occurredAt: sub.canceledAt.toISOString(),
      });
    } else if (sub.createdAt) {
      activitySources.push({
        id: `sub-${sub._id.toString()}`,
        type: "subscribed",
        text: `${name} subscribed to your ${planLabel(sub.accessLevel)} plan`,
        occurredAt: sub.createdAt.toISOString(),
      });
    }
  }

  for (const payment of recentPaymentsRaw) {
    const name = nameByClerkId.get(payment.subscriberClerkUserId) ?? "A subscriber";
    activitySources.push({
      id: `pay-${payment._id.toString()}`,
      type: "payment",
      text: `Payment of $${(asNumber(payment.amountCents) / 100).toFixed(2)} succeeded for ${name}`,
      occurredAt: (payment.paidAt ?? payment.createdAt).toISOString(),
    });
  }

  const recentActivity = activitySources
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .slice(0, 6);

  const profileStatus = ctx.creatorProfile.profileStatus as "draft" | "published";

  // Publish-readiness checklist: nudges new creators through the
  // minimum profile setup before they make /creators visible. Each
  // step is independent so the UI can render checkmarks live as the
  // creator fills things in.
  const hasCreatorName = (ctx.creatorProfile.creatorName?.trim().length ?? 0) > 0;
  const hasBio = (ctx.creatorProfile.bio?.trim().length ?? 0) >= 30;
  const hasAvatar = (ctx.creatorProfile.avatarUrl?.trim().length ?? 0) > 0;
  const hasPublishedContent = publishedContentCount > 0;
  const hasActivePlan = activePlanCount > 0;
  const isPublished = profileStatus === "published";

  const publishReadiness: CreatorPublishReadiness = {
    ready:
      hasCreatorName &&
      hasBio &&
      hasAvatar &&
      hasPublishedContent &&
      hasActivePlan,
    hasCreatorName,
    hasBio,
    hasAvatar,
    hasPublishedContent,
    hasActivePlan,
    isPublished,
  };

  return {
    creatorName: ctx.creatorProfile.creatorName,
    creatorSlug: ctx.creatorProfile.creatorSlug,
    profileStatus,
    metrics: {
      monthlyRevenueCents,
      activeSubscribers: activeSubs.length,
      paidSubscribers: paidSubs.length,
      contentViews,
      cancelledSubscribers30d: cancelled30dCount,
      conversionRatePercent,
    },
    topContent,
    recentActivity,
    publishReadiness,
  };
}

export async function getCreatorSubscribers(): Promise<CreatorSubscribersResponse> {
  await connectToMongoDB();
  const ctx = await requireCreatorContext();
  const creatorClerkUserId = ctx.clerkUserId;

  const subscriptions = await SubscriptionModel.find({ creatorClerkUserId }).sort({
    updatedAt: -1,
    createdAt: -1,
  });

  const subscriberIds = Array.from(
    new Set(subscriptions.map((s) => s.subscriberClerkUserId))
  );

  const [userProfiles, subscriberProfiles] = await Promise.all([
    subscriberIds.length
      ? UserProfileModel.find(
          { clerkUserId: { $in: subscriberIds } },
          { clerkUserId: 1, displayName: 1, fullName: 1, email: 1, avatarUrl: 1 }
        )
      : [],
    subscriberIds.length
      ? SubscriberProfileModel.find(
          { clerkUserId: { $in: subscriberIds } },
          { clerkUserId: 1, displayName: 1 }
        )
      : [],
  ]);

  const userByClerkId = new Map(
    userProfiles.map((p) => [p.clerkUserId, p])
  );
  const subscriberByClerkId = new Map(
    subscriberProfiles.map((p) => [p.clerkUserId, p])
  );

  const rows: CreatorSubscriberRow[] = subscriptions.map((sub) => {
    const userProfile = userByClerkId.get(sub.subscriberClerkUserId);
    const subscriberProfile = subscriberByClerkId.get(sub.subscriberClerkUserId);
    const name = shortName(
      subscriberProfile?.displayName ||
        userProfile?.displayName ||
        userProfile?.fullName ||
        userProfile?.email
    );
    return {
      subscriptionId: sub._id.toString(),
      subscriberClerkUserId: sub.subscriberClerkUserId,
      name,
      email: userProfile?.email ?? "",
      avatarUrl: userProfile?.avatarUrl ?? "",
      plan: planLabel(sub.accessLevel),
      accessLevel: (sub.accessLevel as "free" | "basic" | "premium") ?? "free",
      status: sub.status as CreatorSubscriberRow["status"],
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
  const paidRows = activeRows.filter((r) => r.accessLevel !== "free");
  const highRows = activeRows.filter((r) => r.engagement === "High");
  const churnRiskRows = rows.filter(
    (r) =>
      r.status === "past_due" ||
      r.status === "canceled" ||
      r.status === "expired"
  );

  const highEngagementPercent =
    activeRows.length > 0
      ? Math.round((highRows.length / activeRows.length) * 1000) / 10
      : 0;

  return {
    metrics: {
      totalSubscribers: activeRows.length,
      paidSubscribers: paidRows.length,
      highEngagementPercent,
      churnRisk: churnRiskRows.length,
    },
    subscribers: rows,
  };
}

export async function getCreatorRevenue(): Promise<CreatorRevenueResponse> {
  await connectToMongoDB();
  const ctx = await requireCreatorContext();
  const creatorClerkUserId = ctx.clerkUserId;

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [activeSubs, recentPaymentsDocs, failedPaymentCount, upcomingRenewals, allSubs] =
    await Promise.all([
      SubscriptionModel.find({
        creatorClerkUserId,
        status: { $in: [...ACTIVE_STATUSES] },
      }),
      PaymentModel.find({ creatorClerkUserId })
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(8),
      PaymentModel.countDocuments({ creatorClerkUserId, status: "failed" }),
      SubscriptionModel.find({
        creatorClerkUserId,
        status: { $in: [...ACTIVE_STATUSES] },
        accessLevel: { $ne: "free" },
        currentPeriodEnd: { $gte: new Date(), $lte: sevenDaysFromNow },
      }),
      SubscriptionModel.find({
        creatorClerkUserId,
      }),
    ]);

  const paidActive = activeSubs.filter((s) => s.accessLevel !== "free");
  const mrrCents = paidActive.reduce(
    (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
    0
  );
  const arpuCents = paidActive.length
    ? Math.round(mrrCents / paidActive.length)
    : 0;

  const cancelledRecently = allSubs.filter(
    (s) =>
      s.status === "canceled" &&
      s.canceledAt &&
      s.canceledAt.getTime() >= thirtyDaysAgo.getTime()
  ).length;
  const activeAtStart = allSubs.length - cancelledRecently;
  const churnRatePercent =
    activeAtStart > 0
      ? Math.round((cancelledRecently / activeAtStart) * 1000) / 10
      : 0;

  // Pull up to ~6 months of daily Analytics rollups so the trend chart
  // reflects history once the cron job has been running. When the
  // rollup hasn't run yet (or this creator is brand-new) we fall back
  // to the live-snapshot estimate computed below.
  const dailySnapshots = await listRecentSnapshotsForCreator(
    creatorClerkUserId,
    180
  );
  const trend: CreatorRevenuePoint[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const monthStart = startOfMonthsAgo(i);
    const monthEnd = startOfMonthsAgo(i - 1);
    const inMonth = dailySnapshots.filter(
      (snap) => snap.snapshotDate >= monthStart && snap.snapshotDate < monthEnd
    );
    let valueCents = 0;
    if (inMonth.length > 0) {
      // Use the latest snapshot in the month as the MRR datapoint —
      // analytics is a snapshot, not a sum, so the latest is what
      // reflects "where this creator stood at end of month".
      const latest = inMonth[inMonth.length - 1];
      valueCents = latest.monthlyRecurringCents;
    } else {
      // Fallback: estimate from current paid subs whose startedAt
      // falls in this month.
      const subsInMonth = paidActive.filter((s) => {
        const started = s.startedAt ?? s.createdAt;
        return started && started >= monthStart && started < monthEnd;
      });
      valueCents = subsInMonth.reduce(
        (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
        0
      );
    }
    trend.push({ label: monthLabel(monthStart), valueCents });
  }

  const forecastedRevenueCents = upcomingRenewals.reduce(
    (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
    0
  );

  const recentPayments = await Promise.all(
    recentPaymentsDocs.map((doc) => serializePayment(doc))
  );

  return {
    metrics: {
      mrrCents,
      arpuCents,
      failedPayments: failedPaymentCount,
      churnRatePercent,
    },
    trend,
    recentPayments,
    forecast: {
      upcomingRenewalsCount: upcomingRenewals.length,
      forecastedRevenueCents,
    },
  };
}

export async function getCreatorAnalytics(): Promise<CreatorAnalyticsResponse> {
  await connectToMongoDB();
  const ctx = await requireCreatorContext();
  const creatorClerkUserId = ctx.clerkUserId;

  const [content, subs, plans] = await Promise.all([
    ContentModel.find(
      { creatorClerkUserId, status: { $ne: "archived" } },
      {
        title: 1,
        contentType: 1,
        viewsCount: 1,
        downloadsCount: 1,
        createdAt: 1,
        watchPercentSum: 1,
        watchEventsCount: 1,
      }
    ),
    SubscriptionModel.find({
      creatorClerkUserId,
      status: { $in: [...ACTIVE_STATUSES] },
    }),
    PlanModel.find({ creatorClerkUserId }),
  ]);

  // Defensively avoid divide-by-zero everywhere.
  const totalContentViews = content.reduce(
    (acc, c) => acc + asNumber(c.viewsCount),
    0
  );
  const totalDownloads = content.reduce(
    (acc, c) => acc + asNumber(c.downloadsCount),
    0
  );
  const fileItems = content.filter((c) => c.contentType === "file");
  const fileViews = fileItems.reduce(
    (acc, c) => acc + asNumber(c.viewsCount),
    0
  );
  const fileDownloadRatePercent = fileViews
    ? Math.round((totalDownloads / fileViews) * 1000) / 10
    : 0;

  const paidSubs = subs.filter((s) => s.accessLevel !== "free");
  const premiumConversionPercent = subs.length
    ? Math.round((paidSubs.length / subs.length) * 1000) / 10
    : 0;

  const topContentSorted = [...content]
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
    .slice(0, 4);

  const topContent: CreatorAnalyticsTopContentItem[] = topContentSorted.map(
    (doc) => {
      const isFile = doc.contentType === "file";
      const stat = isFile
        ? `${asNumber(doc.downloadsCount).toLocaleString()} downloads`
        : `${asNumber(doc.viewsCount).toLocaleString()} views`;
      const created = doc.createdAt ?? new Date();
      const ageDays =
        (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      // Without time-series data we can only infer a soft trend from
      // recency: < 7 days → "up", < 30 days → "steady", else "down".
      const trend: "up" | "down" | "steady" =
        ageDays < 7 ? "up" : ageDays < 30 ? "steady" : "down";
      return {
        id: doc._id.toString(),
        title: doc.title,
        primaryStat: stat,
        trend,
      };
    }
  );

  const totalContent = content.length || 1;
  const videos = content.filter((c) => c.contentType === "video").length;
  const files = content.filter((c) => c.contentType === "file").length;
  const articles = content.filter((c) => c.contentType === "article").length;

  const formatSplit = {
    videos: Math.round((videos / totalContent) * 100),
    files: Math.round((files / totalContent) * 100),
    articles: Math.round((articles / totalContent) * 100),
  };

  // Touch `plans` so eslint doesn't flag it; reserved for a future
  // "conversion by plan" breakdown without forcing an extra query later.
  void plans;

  // Average watch completion across all video content. We aggregate
  // the cumulative sum and event count we keep on each content row
  // (populated by `POST /api/content/[id]/event`). Returns null when
  // no events have been ingested yet so the UI can show "Not tracked".
  const videoContent = content.filter((c) => c.contentType === "video");
  const totalWatchEvents = videoContent.reduce(
    (acc, c) => acc + asNumber(c.watchEventsCount),
    0
  );
  const totalWatchPercent = videoContent.reduce(
    (acc, c) => acc + asNumber(c.watchPercentSum),
    0
  );
  const averageWatchCompletionPercent =
    totalWatchEvents > 0
      ? Math.round((totalWatchPercent / totalWatchEvents) * 10) / 10
      : null;

  // Pull up to 30 days of rolled-up daily snapshots so the UI can
  // chart engagement instead of just current totals.
  const daily30 = await listRecentSnapshotsForCreator(creatorClerkUserId, 30);
  const daily: CreatorAnalyticsDailyPoint[] = daily30.map((snap) => ({
    date: snap.snapshotDate.toISOString(),
    label: snap.snapshotDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    totalSubscribers: snap.totalSubscribers,
    paidSubscribers: snap.paidSubscribers,
    monthlyRecurringCents: snap.monthlyRecurringCents,
    newSubscribersToday: snap.newSubscribersToday,
    churnedSubscribersToday: snap.churnedSubscribersToday,
    totalViews: snap.totalViews,
    totalDownloads: snap.totalDownloads,
  }));

  return {
    metrics: {
      totalContentViews,
      totalDownloads,
      fileDownloadRatePercent,
      premiumConversionPercent,
      averageWatchCompletionPercent,
    },
    topContent,
    formatSplit,
    daily,
  };
}
