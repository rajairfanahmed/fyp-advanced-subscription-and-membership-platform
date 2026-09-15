import { isRecordId } from "@/lib/db/ids";

import { ensureCurrentUserProfile } from "@/lib/auth/profile-sync";
import { isAdminEmail } from "@/lib/auth/roles";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  NotificationModel,
  UserProfileModel,
  CreatorProfileModel,
  SubscriberProfileModel,
  type NotificationDocument,
} from "@/lib/mongodb/models";
import type { CreatorWorkspaceAlerts } from "@/types/profile";
import type {
  NotificationCategory,
  NotificationCreateInput,
  NotificationListResult,
  NotificationResponse,
} from "@/types/notification";
import type {
  AdminBroadcastInput,
  AdminBroadcastResult,
} from "@/types/admin-stats";

const VALID_CATEGORIES: ReadonlyArray<NotificationCategory> = [
  "renewal",
  "payment",
  "content",
  "account",
  "locked",
  "creator",
  "system",
];

const TITLE_LIMIT = 120;
const MESSAGE_LIMIT = 600;
const LINK_LIMIT = 500;
const LIST_LIMIT = 100;

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeCategory(value: unknown): NotificationCategory {
  return VALID_CATEGORIES.includes(value as NotificationCategory)
    ? (value as NotificationCategory)
    : "system";
}

export function serializeNotification(doc: NotificationDocument): NotificationResponse {
  return {
    id: doc._id.toString(),
    recipientClerkUserId: doc.recipientClerkUserId,
    category: doc.category as NotificationCategory,
    title: doc.title,
    message: doc.message,
    link: doc.link ?? "",
    isRead: doc.isRead,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    metadata:
      doc.metadata && typeof doc.metadata === "object"
        ? (doc.metadata as Record<string, unknown>)
        : {},
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Map every NotificationCategory onto the boolean field on
 * `userProfile.subscriberProfile.notificationPreferences` that
 * decides whether the user wants delivery for that category.
 *
 * `account` and `system` always pass — those are platform-essential
 * messages (suspension notices, security, etc.) and should never be
 * silenced by user preferences.
 */
const CATEGORY_TO_PREFERENCE: Partial<
  Record<NotificationCategory, keyof NotificationPreferenceFields>
> = {
  renewal: "renewalReminders",
  payment: "paymentAlerts",
  content: "contentDigests",
  locked: "downloadAlerts",
  creator: "creatorAnnouncements",
};

type NotificationPreferenceFields = {
  productUpdates: boolean;
  contentDigests: boolean;
  downloadAlerts: boolean;
  renewalReminders: boolean;
  paymentAlerts: boolean;
  accountNotices: boolean;
  creatorAnnouncements: boolean;
};

function normalizeCreatorWorkspaceAlertsForGate(raw: unknown): CreatorWorkspaceAlerts {
  const d: CreatorWorkspaceAlerts = {
    newSubscriber: true,
    renewalSummary: true,
    failedPayment: false,
    engagementReport: true,
    weeklyRevenue: true,
  };
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    newSubscriber: typeof o.newSubscriber === "boolean" ? o.newSubscriber : d.newSubscriber,
    renewalSummary: typeof o.renewalSummary === "boolean" ? o.renewalSummary : d.renewalSummary,
    failedPayment: typeof o.failedPayment === "boolean" ? o.failedPayment : d.failedPayment,
    engagementReport: typeof o.engagementReport === "boolean" ? o.engagementReport : d.engagementReport,
    weeklyRevenue: typeof o.weeklyRevenue === "boolean" ? o.weeklyRevenue : d.weeklyRevenue,
  };
}

/**
 * Look up whether a notification category may be delivered.
 * - Creator recipients with `creatorWorkspaceAlertKey` use `CreatorProfile.creatorWorkspaceAlerts`.
 * - Otherwise subscriber-style prefs from `subscriberProfile.notificationPreferences` apply.
 * Returns `true` when the user has no matching prefs row yet (default-on for subscribers),
 * when the category isn't covered by subscriber prefs, or when the relevant toggle is on.
 */
async function recipientAllowsCategory(
  clerkUserId: string,
  category: NotificationCategory,
  creatorWorkspaceAlertKey?: keyof CreatorWorkspaceAlerts
): Promise<boolean> {
  const profile = (await UserProfileModel.findOne(
    { clerkUserId },
    { role: 1 }
  ).lean()) as { role?: string } | null;

  if (creatorWorkspaceAlertKey && profile?.role === "creator") {
    const cp = await CreatorProfileModel.findOne({ clerkUserId }, { creatorWorkspaceAlerts: 1 }).lean();
    const alerts = normalizeCreatorWorkspaceAlertsForGate(cp?.creatorWorkspaceAlerts);
    return alerts[creatorWorkspaceAlertKey] === true;
  }

  const prefField = CATEGORY_TO_PREFERENCE[category];
  if (!prefField) return true;

  const subscriber = await SubscriberProfileModel.findOne({ clerkUserId });
  const prefs = subscriber?.notificationPreferences as
    | Partial<NotificationPreferenceFields>
    | undefined;
  if (!prefs) return true;
  const value = prefs[prefField];
  return value !== false;
}

/**
 * Server-only helper. Other parts of the backend (plan changes,
 * payment webhooks, content publishes, etc.) call this to deliver
 * a notification to a single Clerk user.
 *
 * Pass `respectPreferences: true` (default for `notifyIfAllowed`) to
 * skip delivery when the user has muted that category.
 */
export async function createNotification(
  input: NotificationCreateInput
): Promise<NotificationResponse> {
  await connectToMongoDB();

  const recipientClerkUserId = cleanText(input.recipientClerkUserId);
  if (!recipientClerkUserId) {
    throw new Error("recipientClerkUserId is required to create a notification.");
  }

  const title = cleanText(input.title).slice(0, TITLE_LIMIT);
  const message = cleanText(input.message).slice(0, MESSAGE_LIMIT);
  if (!title || !message) {
    throw new Error("Notification title and message are required.");
  }

  const doc = await NotificationModel.create({
    recipientClerkUserId,
    category: normalizeCategory(input.category),
    title,
    message,
    link: cleanText(input.link).slice(0, LINK_LIMIT),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    isRead: false,
    readAt: null,
  });

  return serializeNotification(doc);
}

/**
 * Preference-respecting variant of `createNotification`. Use this for
 * automated event notifications (subscription renewals, payment
 * outcomes, etc.) that the user can mute via /account preferences.
 *
 * Returns the persisted notification on delivery, or `null` if the
 * user has muted the relevant category.
 */
export async function notifyIfAllowed(
  input: NotificationCreateInput
): Promise<NotificationResponse | null> {
  const recipientClerkUserId = cleanText(input.recipientClerkUserId);
  if (!recipientClerkUserId) return null;
  const category = normalizeCategory(input.category);
  const allowed = await recipientAllowsCategory(
    recipientClerkUserId,
    category,
    input.creatorWorkspaceAlertKey
  );
  if (!allowed) return null;
  return createNotification({ ...input, category });
}

/**
 * Fetch the inbox for the currently signed-in user, newest first,
 * along with totals and an unread count for the UI badge.
 */
export async function listCurrentUserNotifications(): Promise<NotificationListResult> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) {
    return { items: [], totalCount: 0, unreadCount: 0 };
  }

  const recipientClerkUserId = synced.user.id;

  const [items, totalCount, unreadCount] = await Promise.all([
    NotificationModel.find({ recipientClerkUserId })
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT),
    NotificationModel.countDocuments({ recipientClerkUserId }),
    NotificationModel.countDocuments({ recipientClerkUserId, isRead: false }),
  ]);

  return {
    items: items.map(serializeNotification),
    totalCount,
    unreadCount,
  };
}

export async function markCurrentUserNotificationRead(
  notificationId: string,
  isRead: boolean
): Promise<NotificationResponse | null> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) return null;
  if (!isRecordId(notificationId)) return null;

  const doc = await NotificationModel.findOneAndUpdate(
    {
      _id: notificationId,
      recipientClerkUserId: synced.user.id,
    },
    {
      $set: {
        isRead,
        readAt: isRead ? new Date() : null,
      },
    },
    { returnDocument: "after" }
  );

  return doc ? serializeNotification(doc) : null;
}

export async function markAllCurrentUserNotificationsRead(): Promise<{
  updatedCount: number;
}> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) return { updatedCount: 0 };

  const result = await NotificationModel.updateMany(
    { recipientClerkUserId: synced.user.id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return { updatedCount: result.modifiedCount ?? 0 };
}

export async function deleteCurrentUserNotification(
  notificationId: string
): Promise<boolean> {
  await connectToMongoDB();
  const synced = await ensureCurrentUserProfile();
  if (!synced) return false;
  if (!isRecordId(notificationId)) return false;

  const result = await NotificationModel.deleteOne({
    _id: notificationId,
    recipientClerkUserId: synced.user.id,
  });

  return (result.deletedCount ?? 0) > 0;
}

const BROADCAST_SUBJECT_LIMIT = 120;
const BROADCAST_BODY_LIMIT = 600;

/**
 * Insert a "system" notification for every user matching the
 * requested audience. Only callable from admin-gated routes — the
 * caller is expected to verify admin status before invoking.
 *
 * Audience semantics:
 * - all          → every UserProfile
 * - subscribers  → role === "subscriber"
 * - creators     → role === "creator"
 * - admins       → emails in ADMIN_EMAILS
 */
export async function broadcastNotification(
  input: AdminBroadcastInput
): Promise<AdminBroadcastResult> {
  await connectToMongoDB();

  const subject = cleanText(input.subject).slice(0, BROADCAST_SUBJECT_LIMIT);
  const body = cleanText(input.body).slice(0, BROADCAST_BODY_LIMIT);
  if (!subject || !body) {
    throw new Error("Broadcast subject and body are required.");
  }

  const audience = input.audience;
  const query: Record<string, unknown> = {};
  if (audience === "subscribers") query.role = "subscriber";
  else if (audience === "creators") query.role = "creator";

  const PAGE = 400;
  const INSERT_CHUNK = 100;
  let skip = 0;
  let recipientsCount = 0;

  while (true) {
    const batch = await UserProfileModel.find(query).skip(skip).limit(PAGE);
    if (batch.length === 0) break;

    const filtered = (
      audience === "admins" ? batch.filter((u) => isAdminEmail(u.email)) : batch
    ).filter((u) => u.accountStatus !== "deleted" && u.clerkUserId);

    if (input.dryRun) {
      recipientsCount += filtered.length;
    } else if (filtered.length) {
      for (let i = 0; i < filtered.length; i += INSERT_CHUNK) {
        const chunk = filtered.slice(i, i + INSERT_CHUNK);
        await NotificationModel.insertMany(
          chunk.map((u) => ({
            recipientClerkUserId: u.clerkUserId,
            category: "system" as NotificationCategory,
            title: subject,
            message: body,
            link: "",
            metadata: { source: "admin_broadcast", audience },
            isRead: false,
            readAt: null,
          })),
          { ordered: false }
        );
        recipientsCount += chunk.length;
      }
    }

    skip += batch.length;
    if (batch.length < PAGE) break;
  }

  return { recipientsCount };
}
