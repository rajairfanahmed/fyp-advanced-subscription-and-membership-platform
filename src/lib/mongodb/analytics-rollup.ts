import { connectToMongoDB } from "@/lib/mongodb/connect";
import { notifyIfAllowed } from "@/lib/mongodb/notifications";
import {
  AnalyticsModel,
  ContentModel,
  CreatorProfileModel,
  NotificationModel,
  PaymentModel,
  SubscriptionModel,
  type CreatorProfileDocument,
} from "@/lib/mongodb/models";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

function startOfDayUtc(input?: Date): Date {
  const d = input ? new Date(input) : new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDayUtc(input?: Date): Date {
  const d = startOfDayUtc(input);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export type AnalyticsRollupSnapshot = {
  creatorClerkUserId: string;
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

/**
 * Build a single day's analytics snapshot for the supplied creator
 * profile. Pure aggregation — does not write to the database.
 */
export async function buildCreatorDailySnapshot(
  creator: CreatorProfileDocument,
  forDate: Date = new Date()
): Promise<AnalyticsRollupSnapshot> {
  const dayStart = startOfDayUtc(forDate);
  const dayEnd = endOfDayUtc(forDate);

  const creatorClerkUserId = creator.clerkUserId;

  const [allSubs, activeSubs, succeededPayments, content] = await Promise.all([
    SubscriptionModel.find({ creatorClerkUserId }).select(
      "accessLevel status priceMonthly startedAt canceledAt"
    ),
    SubscriptionModel.find({
      creatorClerkUserId,
      status: { $in: [...ACTIVE_STATUSES] },
    }).select("accessLevel priceMonthly"),
    PaymentModel.find({
      creatorClerkUserId,
      status: "succeeded",
    }).select("amountCents"),
    ContentModel.find({
      creatorClerkUserId,
      status: { $ne: "archived" },
    }).select("viewsCount downloadsCount"),
  ]);

  const paidActive = activeSubs.filter((s) => s.accessLevel !== "free");
  const monthlyRecurringCents = paidActive.reduce(
    (acc, s) => acc + Math.round(asNumber(s.priceMonthly) * 100),
    0
  );
  const totalRevenueCents = succeededPayments.reduce(
    (acc, p) => acc + asNumber((p as { amountCents?: number }).amountCents),
    0
  );

  const newSubscribersToday = allSubs.filter((s) => {
    const started = (s as { startedAt?: Date }).startedAt;
    return started && started >= dayStart && started < dayEnd;
  }).length;

  const churnedSubscribersToday = allSubs.filter((s) => {
    if (s.status !== "canceled") return false;
    const canceled = (s as { canceledAt?: Date | null }).canceledAt;
    return canceled && canceled >= dayStart && canceled < dayEnd;
  }).length;

  const totalViews = content.reduce(
    (acc, c) => acc + asNumber((c as { viewsCount?: number }).viewsCount),
    0
  );
  const totalDownloads = content.reduce(
    (acc, c) => acc + asNumber((c as { downloadsCount?: number }).downloadsCount),
    0
  );

  return {
    creatorClerkUserId,
    snapshotDate: dayStart,
    totalSubscribers: allSubs.length,
    activeSubscribers: activeSubs.length,
    paidSubscribers: paidActive.length,
    totalRevenueCents,
    monthlyRecurringCents,
    totalViews,
    totalDownloads,
    contentCount: content.length,
    newSubscribersToday,
    churnedSubscribersToday,
  };
}

/**
 * Run the rollup for every creator profile (regardless of publish
 * status — we still want analytics history for drafts). Returns a
 * summary the caller can log or expose to an admin dashboard.
 */
export async function runDailyAnalyticsRollup(forDate: Date = new Date()): Promise<{
  snapshotDate: string;
  creatorsProcessed: number;
  creatorsFailed: number;
}> {
  await connectToMongoDB();

  const dayStart = startOfDayUtc(forDate);
  const creators = await CreatorProfileModel.find({}).select(
    "clerkUserId _id"
  );

  let processed = 0;
  let failed = 0;

  for (const creator of creators) {
    try {
      const snapshot = await buildCreatorDailySnapshot(creator, forDate);
      await AnalyticsModel.findOneAndUpdate(
        {
          creatorClerkUserId: snapshot.creatorClerkUserId,
          snapshotDate: dayStart,
        },
        {
          $set: {
            ...snapshot,
            creatorProfileId: creator._id,
          },
        },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      try {
        await notifyCreatorDigests(snapshot, dayStart);
      } catch (error) {
        console.warn("[analytics-rollup:notify]", creator.clerkUserId, error);
      }
      processed += 1;
    } catch (err) {
      failed += 1;
      console.error(
        "[analytics-rollup] failed for",
        creator.clerkUserId,
        err
      );
    }
  }

  return {
    snapshotDate: dayStart.toISOString(),
    creatorsProcessed: processed,
    creatorsFailed: failed,
  };
}

function formatCents(cents: number) {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

async function alreadySentDigest(clerkUserId: string, digestKey: string) {
  const recent = await NotificationModel.find({
    recipientClerkUserId: clerkUserId,
    category: "creator",
  })
    .sort({ createdAt: -1 })
    .limit(20);
  return recent.some((row) => {
    const metadata = (row.metadata ?? {}) as { digestKey?: string };
    return metadata.digestKey === digestKey;
  });
}

async function notifyCreatorDigests(
  snapshot: AnalyticsRollupSnapshot,
  dayStart: Date
) {
  const dateKey = dayStart.toISOString().slice(0, 10);
  const engagementKey = `engagement:${dateKey}`;
  if (!(await alreadySentDigest(snapshot.creatorClerkUserId, engagementKey))) {
    await notifyIfAllowed({
      recipientClerkUserId: snapshot.creatorClerkUserId,
      category: "creator",
      title: "Content engagement report",
      message: `Yesterday’s library totals: ${snapshot.totalViews} views and ${snapshot.totalDownloads} downloads across ${snapshot.contentCount} posts. ${snapshot.newSubscribersToday} new member${snapshot.newSubscribersToday === 1 ? "" : "s"} today.`,
      link: "/creator",
      creatorWorkspaceAlertKey: "engagementReport",
      metadata: { digestKey: engagementKey, event: "engagement.daily" },
    });
  }

  if (dayStart.getUTCDay() !== 1) return;

  const weekAgo = new Date(dayStart);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const weekPayments = await PaymentModel.find({
    creatorClerkUserId: snapshot.creatorClerkUserId,
    status: "succeeded",
    paidAt: { $gte: weekAgo, $lt: dayStart },
  }).select({ amountCents: 1 });
  const weekCents = weekPayments.reduce(
    (acc, row) => acc + asNumber((row as { amountCents?: number }).amountCents),
    0
  );
  const weeklyKey = `weekly-revenue:${dateKey}`;
  if (await alreadySentDigest(snapshot.creatorClerkUserId, weeklyKey)) return;

  await notifyIfAllowed({
    recipientClerkUserId: snapshot.creatorClerkUserId,
    category: "creator",
    title: "Weekly revenue summary",
    message: `You earned ${formatCents(weekCents)} from ${weekPayments.length} payment${weekPayments.length === 1 ? "" : "s"} over the last 7 days. Current MRR is ${formatCents(snapshot.monthlyRecurringCents)}.`,
    link: "/creator/revenue",
    creatorWorkspaceAlertKey: "weeklyRevenue",
    metadata: { digestKey: weeklyKey, event: "revenue.weekly" },
  });
}

/**
 * Fetch the most recent N daily snapshots for a creator. Returned
 * oldest-first so callers can drop them straight into a chart.
 */
export async function listRecentSnapshotsForCreator(
  creatorClerkUserId: string,
  limit: number
): Promise<AnalyticsRollupSnapshot[]> {
  await connectToMongoDB();
  const docs = await AnalyticsModel.find({ creatorClerkUserId })
    .sort({ snapshotDate: -1 })
    .limit(Math.max(1, Math.min(limit, 365)))
    .lean();
  return docs
    .map((doc) => ({
      creatorClerkUserId: (doc as { creatorClerkUserId: string }).creatorClerkUserId,
      snapshotDate: new Date((doc as { snapshotDate: Date }).snapshotDate),
      totalSubscribers: asNumber((doc as { totalSubscribers?: number }).totalSubscribers),
      activeSubscribers: asNumber(
        (doc as { activeSubscribers?: number }).activeSubscribers
      ),
      paidSubscribers: asNumber((doc as { paidSubscribers?: number }).paidSubscribers),
      totalRevenueCents: asNumber(
        (doc as { totalRevenueCents?: number }).totalRevenueCents
      ),
      monthlyRecurringCents: asNumber(
        (doc as { monthlyRecurringCents?: number }).monthlyRecurringCents
      ),
      totalViews: asNumber((doc as { totalViews?: number }).totalViews),
      totalDownloads: asNumber((doc as { totalDownloads?: number }).totalDownloads),
      contentCount: asNumber((doc as { contentCount?: number }).contentCount),
      newSubscribersToday: asNumber(
        (doc as { newSubscribersToday?: number }).newSubscribersToday
      ),
      churnedSubscribersToday: asNumber(
        (doc as { churnedSubscribersToday?: number }).churnedSubscribersToday
      ),
    }))
    .reverse();
}
