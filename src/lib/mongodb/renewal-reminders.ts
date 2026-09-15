import { blockedAccountIds } from "@/lib/account/status";
import { loadPlatformSettings } from "@/lib/mongodb/admin-settings";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  CreatorProfileModel,
  NotificationModel,
  SubscriptionModel,
  type SubscriptionDocument,
} from "@/lib/mongodb/models";
import { notifyIfAllowed } from "@/lib/mongodb/notifications";
import { daysRemainingLabel, planTierLabel } from "@/lib/membership/labels";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

function reminderKey(subscriptionId: string, periodEnd: Date) {
  return `renewal:${subscriptionId}:${periodEnd.toISOString().slice(0, 10)}`;
}

async function alreadySent(recipientClerkUserId: string, key: string) {
  const recent = await NotificationModel.find({
    recipientClerkUserId,
    category: "renewal",
  })
    .sort({ createdAt: -1 })
    .limit(25);
  return recent.some((row) => {
    const metadata = (row.metadata ?? {}) as { reminderKey?: string };
    return metadata.reminderKey === key;
  });
}

export async function sendPaidRenewalReminder(
  sub: SubscriptionDocument,
  source: "cron" | "stripe_upcoming"
): Promise<boolean> {
  if (sub.accessLevel === "free") return false;
  if (sub.cancelAtPeriodEnd) return false;
  if (!ACTIVE_STATUSES.includes(sub.status as (typeof ACTIVE_STATUSES)[number])) {
    return false;
  }
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  if (!periodEnd || !Number.isFinite(periodEnd.getTime())) return false;
  if (periodEnd.getTime() <= Date.now()) return false;

  const blocked = await blockedAccountIds([
    sub.creatorClerkUserId,
    sub.subscriberClerkUserId,
  ]);
  if (blocked.has(sub.creatorClerkUserId) || blocked.has(sub.subscriberClerkUserId)) {
    return false;
  }

  const key = reminderKey(sub._id.toString(), periodEnd);
  if (await alreadySent(sub.subscriberClerkUserId, key)) {
    return false;
  }

  const creator = await CreatorProfileModel.findOne({
    clerkUserId: sub.creatorClerkUserId,
  });
  const remaining = daysRemainingLabel(periodEnd);
  const tier = planTierLabel(sub.accessLevel);
  const delivered = await notifyIfAllowed({
    recipientClerkUserId: sub.subscriberClerkUserId,
    category: "renewal",
    title: "Renewal coming up",
    message: creator
      ? `Your ${tier} membership with ${creator.creatorName} renews soon.${remaining ? ` ${remaining}.` : ""}`
      : `Your ${tier} membership renews soon.${remaining ? ` ${remaining}.` : ""}`,
    link: "/billing",
    metadata: { reminderKey: key, source },
  });
  return Boolean(delivered);
}

export async function sendUpcomingInvoiceReminder(stripeSubscriptionId: string) {
  if (!stripeSubscriptionId) return false;
  await connectToMongoDB();
  const sub = await SubscriptionModel.findOne({ stripeSubscriptionId });
  if (!sub) return false;
  return sendPaidRenewalReminder(sub, "stripe_upcoming");
}

export async function runRenewalReminderSweep(now = new Date()) {
  await connectToMongoDB();
  const settings = await loadPlatformSettings();
  const leadDays = Math.max(1, Math.min(30, settings.renewalReminderLeadDays || 7));
  const until = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);

  const PAGE = 200;
  let skip = 0;
  let scanned = 0;
  let sent = 0;
  let skipped = 0;

  while (true) {
    const batch = await SubscriptionModel.find({
      status: { $in: [...ACTIVE_STATUSES] },
      accessLevel: { $ne: "free" },
      cancelAtPeriodEnd: { $ne: true },
      currentPeriodEnd: { $gte: now, $lte: until },
    })
      .sort({ currentPeriodEnd: 1 })
      .skip(skip)
      .limit(PAGE);

    if (batch.length === 0) break;
    scanned += batch.length;

    for (const sub of batch) {
      const delivered = await sendPaidRenewalReminder(sub, "cron");
      if (delivered) sent += 1;
      else skipped += 1;
    }

    skip += batch.length;
    if (batch.length < PAGE) break;
  }

  return { leadDays, scanned, sent, skipped };
}
