import {
  QUOTA_WINDOW_MS,
  TIER_LIMITS,
  UNLIMITED_DOWNLOADS,
} from "@/config/tier-limits";
import { getPool } from "@/lib/db/pool";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  SubscriptionModel,
  type SubscriptionDocument,
} from "@/lib/mongodb/models";
import {
  asAccessLevel,
  subscriptionGrantsAccess,
} from "@/lib/membership/access";
import type { PlanAccessLevel } from "@/types/plan";

export type DownloadQuotaSnapshot = {
  accessLevel: PlanAccessLevel;
  monthlyLimit: number | null;
  usedThisPeriod: number;
  remaining: number | null;
  windowStart: string;
  windowEnd: string;
  blockedByTier: boolean;
};

type QuotaRow = {
  id: string;
  access_level: string;
  status: string;
  current_period_end: Date | string | null;
  quota_period_start: Date | string | null;
  monthly_download_count: string | number | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function snapshotFromSubscription(sub: SubscriptionDocument): DownloadQuotaSnapshot {
  return snapshotFromFields({
    accessLevel: (sub.accessLevel as PlanAccessLevel) ?? "free",
    quotaPeriodStart: sub.quotaPeriodStart,
    monthlyDownloadCount: sub.monthlyDownloadCount ?? 0,
  });
}

function snapshotFromFields(input: {
  accessLevel: PlanAccessLevel;
  quotaPeriodStart: Date | string | null | undefined;
  monthlyDownloadCount: number;
}): DownloadQuotaSnapshot {
  const tier = TIER_LIMITS[input.accessLevel];
  const now = Date.now();
  const periodStart = toDate(input.quotaPeriodStart)?.getTime() ?? 0;
  const expired = !periodStart || now - periodStart >= QUOTA_WINDOW_MS;
  const effectiveStart = expired ? now : periodStart;
  const used = expired ? 0 : input.monthlyDownloadCount ?? 0;
  const monthlyLimit =
    tier.monthlyDownloads === UNLIMITED_DOWNLOADS ? null : tier.monthlyDownloads;
  const remaining =
    monthlyLimit === null ? null : Math.max(0, monthlyLimit - used);

  return {
    accessLevel: input.accessLevel,
    monthlyLimit,
    usedThisPeriod: used,
    remaining,
    windowStart: new Date(effectiveStart).toISOString(),
    windowEnd: new Date(effectiveStart + QUOTA_WINDOW_MS).toISOString(),
    blockedByTier: !tier.canDownload,
  };
}

function freeSnapshot(): DownloadQuotaSnapshot {
  return snapshotFromFields({
    accessLevel: "free",
    quotaPeriodStart: null,
    monthlyDownloadCount: 0,
  });
}

export async function getDownloadQuotaSnapshot(args: {
  subscriberClerkUserId: string;
  creatorClerkUserId: string;
}): Promise<DownloadQuotaSnapshot> {
  await connectToMongoDB();

  const sub = await SubscriptionModel.findOne({
    subscriberClerkUserId: args.subscriberClerkUserId,
    creatorClerkUserId: args.creatorClerkUserId,
  });

  if (!sub || !subscriptionGrantsAccess(sub)) {
    return freeSnapshot();
  }

  return snapshotFromSubscription(sub);
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
        | "quota_exhausted"
        | "access_revoked";
      quota: DownloadQuotaSnapshot;
    };

const SELECT_FOR_UPDATE = `
  SELECT s.id, s.access_level, s.status, s.current_period_end,
         s.quota_period_start, s.monthly_download_count
  FROM subscriptions s
  WHERE s.subscriber_clerk_user_id = $1 AND s.creator_clerk_user_id = $2
  FOR UPDATE OF s
`;

/**
 * Atomically check + increment download quota under a row lock.
 */
export async function consumeDownload(args: {
  subscriberClerkUserId: string;
  creatorClerkUserId: string;
}): Promise<ConsumeDownloadResult> {
  await connectToMongoDB();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<QuotaRow>(SELECT_FOR_UPDATE, [
      args.subscriberClerkUserId,
      args.creatorClerkUserId,
    ]);
    const row = res.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return { ok: false, reason: "no_subscription", quota: freeSnapshot() };
    }

    const accessLevel = asAccessLevel(row.access_level);
    const slice = {
      accessLevel,
      status: row.status,
      currentPeriodEnd: toDate(row.current_period_end),
    };
    if (!subscriptionGrantsAccess(slice)) {
      await client.query("COMMIT");
      return {
        ok: false,
        reason: "access_revoked",
        quota: snapshotFromFields({
          accessLevel,
          quotaPeriodStart: toDate(row.quota_period_start),
          monthlyDownloadCount: Number(row.monthly_download_count) || 0,
        }),
      };
    }

    const tier = TIER_LIMITS[accessLevel];
    if (!tier.canDownload) {
      await client.query("COMMIT");
      return {
        ok: false,
        reason: "tier_blocked",
        quota: snapshotFromFields({
          accessLevel,
          quotaPeriodStart: toDate(row.quota_period_start),
          monthlyDownloadCount: Number(row.monthly_download_count) || 0,
        }),
      };
    }

    const now = Date.now();
    const periodStart = toDate(row.quota_period_start)?.getTime() ?? 0;
    const expired = !periodStart || now - periodStart >= QUOTA_WINDOW_MS;
    const windowStart = expired ? new Date(now) : new Date(periodStart);
    const used = expired ? 0 : Number(row.monthly_download_count) || 0;

    if (tier.monthlyDownloads !== UNLIMITED_DOWNLOADS && used >= tier.monthlyDownloads) {
      await client.query("COMMIT");
      return {
        ok: false,
        reason: "quota_exhausted",
        quota: snapshotFromFields({
          accessLevel,
          quotaPeriodStart: windowStart,
          monthlyDownloadCount: used,
        }),
      };
    }

    const nextCount = used + 1;
    await client.query(
      `UPDATE subscriptions
       SET monthly_download_count = $1,
           quota_period_start = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [nextCount, windowStart, row.id]
    );
    await client.query("COMMIT");

    return {
      ok: true,
      quota: snapshotFromFields({
        accessLevel,
        quotaPeriodStart: windowStart,
        monthlyDownloadCount: nextCount,
      }),
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Undo a reserved download after the stream fails. */
export async function releaseDownload(args: {
  subscriberClerkUserId: string;
  creatorClerkUserId: string;
}): Promise<void> {
  await connectToMongoDB();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<QuotaRow>(SELECT_FOR_UPDATE, [
      args.subscriberClerkUserId,
      args.creatorClerkUserId,
    ]);
    const row = res.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return;
    }
    const used = Math.max(0, (Number(row.monthly_download_count) || 0) - 1);
    await client.query(
      `UPDATE subscriptions
       SET monthly_download_count = $1, updated_at = NOW()
       WHERE id = $2`,
      [used, row.id]
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}
