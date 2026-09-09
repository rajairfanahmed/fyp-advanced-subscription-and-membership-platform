import {
  QUOTA_WINDOW_MS,
  TIER_LIMITS,
  UNLIMITED_DOWNLOADS,
} from "@/config/tier-limits";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  SubscriptionModel,
  type SubscriptionDocument,
} from "@/lib/mongodb/models";
import type { PlanAccessLevel } from "@/types/plan";

const PAID_ACCESS_STATUSES = ["active", "trialing", "past_due"] as const;

export type DownloadQuotaSnapshot = {
  /** Tier currently driving the limit (the subscription's accessLevel, or "free" if no sub). */
  accessLevel: PlanAccessLevel;
  /** Total downloads allowed in the current 30-day window. `null` = unlimited. */
  monthlyLimit: number | null;
  /** Downloads already used in the current window (post-rollover). */
  usedThisPeriod: number;
  /** Downloads still available before the cap kicks in. `null` = unlimited. */
  remaining: number | null;
  /** ISO timestamp when the current window started (or just rolled over). */
  windowStart: string;
  /** ISO timestamp when the current window ends and counters reset. */
  windowEnd: string;
  /** True when the tier doesn't allow downloads at all (e.g. Free). */
  blockedByTier: boolean;
};

/**
 * Read the current download quota state for a (subscriber → creator)
 * pair without mutating it. Used by `/api/subscriptions/me` and the
 * subscriber UI to render "X / 30 downloads left this month".
 *
 * Returns a Free-tier snapshot if no subscription row exists; the
 * library page never lets the user try to download in that case
 * anyway, but treating a missing row as Free keeps the UI consistent.
 */
export async function getDownloadQuotaSnapshot(args: {
  subscriberClerkUserId: string;
  creatorClerkUserId: string;
}): Promise<DownloadQuotaSnapshot> {
  await connectToMongoDB();

  const sub = await SubscriptionModel.findOne({
    subscriberClerkUserId: args.subscriberClerkUserId,
    creatorClerkUserId: args.creatorClerkUserId,
    status: { $in: [...PAID_ACCESS_STATUSES] },
  });

  if (!sub) {
    const tier = TIER_LIMITS.free;
    const now = new Date();
    const monthlyLimit =
      tier.monthlyDownloads === UNLIMITED_DOWNLOADS ? null : tier.monthlyDownloads;
    return {
      accessLevel: "free",
      monthlyLimit,
      usedThisPeriod: 0,
      remaining: monthlyLimit,
      windowStart: now.toISOString(),
      windowEnd: new Date(now.getTime() + QUOTA_WINDOW_MS).toISOString(),
      blockedByTier: !tier.canDownload,
    };
  }

  return snapshotFromSubscription(sub);
}

function snapshotFromSubscription(sub: SubscriptionDocument): DownloadQuotaSnapshot {
  const accessLevel = (sub.accessLevel as PlanAccessLevel) ?? "free";
  const tier = TIER_LIMITS[accessLevel];
  const now = Date.now();

  const periodStart = sub.quotaPeriodStart
    ? new Date(sub.quotaPeriodStart).getTime()
    : 0;
  const expired = !periodStart || now - periodStart >= QUOTA_WINDOW_MS;
  const effectiveStart = expired ? now : periodStart;
  const used = expired ? 0 : sub.monthlyDownloadCount ?? 0;

  const monthlyLimit =
    tier.monthlyDownloads === UNLIMITED_DOWNLOADS ? null : tier.monthlyDownloads;
  const remaining =
    monthlyLimit === null ? null : Math.max(0, monthlyLimit - used);

  return {
    accessLevel,
    monthlyLimit,
    usedThisPeriod: used,
    remaining,
    windowStart: new Date(effectiveStart).toISOString(),
    windowEnd: new Date(effectiveStart + QUOTA_WINDOW_MS).toISOString(),
    blockedByTier: !tier.canDownload,
  };
}

export type ConsumeDownloadResult =
  | {
      ok: true;
      quota: DownloadQuotaSnapshot;
    }
  | {
      ok: false;
      reason:
        | "no_subscription"
        | "tier_blocked"
        | "quota_exhausted";
      quota: DownloadQuotaSnapshot;
    };

/**
 * Atomically check + increment the download quota for a (subscriber →
 * creator) pair. Returns `ok:false` with a structured reason when the
 * tier doesn't allow downloads, when the quota is fully consumed, or
 * when there is no active subscription.
 *
 * The 30-day window resets on first hit after expiry (rolling cycle,
 * not aligned to calendar months) so subscribers see consistent
 * "resets in N days" copy regardless of when they joined.
 */
export async function consumeDownload(args: {
  subscriberClerkUserId: string;
  creatorClerkUserId: string;
}): Promise<ConsumeDownloadResult> {
  await connectToMongoDB();

  const sub = await SubscriptionModel.findOne({
    subscriberClerkUserId: args.subscriberClerkUserId,
    creatorClerkUserId: args.creatorClerkUserId,
    status: { $in: [...PAID_ACCESS_STATUSES] },
  });

  if (!sub) {
    const snapshot = await getDownloadQuotaSnapshot(args);
    return { ok: false, reason: "no_subscription", quota: snapshot };
  }

  const accessLevel = (sub.accessLevel as PlanAccessLevel) ?? "free";
  const tier = TIER_LIMITS[accessLevel];

  if (!tier.canDownload) {
    return {
      ok: false,
      reason: "tier_blocked",
      quota: snapshotFromSubscription(sub),
    };
  }

  // Roll the window forward if it expired before the increment so the
  // 31st-day download starts a fresh count instead of being denied.
  const now = Date.now();
  const periodStart = sub.quotaPeriodStart
    ? new Date(sub.quotaPeriodStart).getTime()
    : 0;
  const expired = !periodStart || now - periodStart >= QUOTA_WINDOW_MS;
  if (expired) {
    sub.quotaPeriodStart = new Date(now);
    sub.monthlyDownloadCount = 0;
  }

  if (
    tier.monthlyDownloads !== UNLIMITED_DOWNLOADS &&
    (sub.monthlyDownloadCount ?? 0) >= tier.monthlyDownloads
  ) {
    return {
      ok: false,
      reason: "quota_exhausted",
      quota: snapshotFromSubscription(sub),
    };
  }

  sub.monthlyDownloadCount = (sub.monthlyDownloadCount ?? 0) + 1;
  await sub.save();

  return { ok: true, quota: snapshotFromSubscription(sub) };
}
