import { currentUser } from "@clerk/nextjs/server";

import { getUserRole, isAdminEmail } from "@/lib/auth/roles";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import {
  CreatorProfileModel,
  NotificationModel,
  SubscriberProfileModel,
  UserProfileModel,
  type CreatorProfileDocument,
  type SubscriberProfileDocument,
  type UserProfileDocument,
} from "@/lib/mongodb/models";
import { deleteFromCloudflareR2, uploadToCloudflareR2 } from "@/lib/storage";
import type {
  CreatorProfileResponse,
  CreatorWorkspaceAlerts,
  CreatorWorkspaceDefaults,
  NotificationPreferences,
  PublicUserRole,
  UserProfileResponse,
} from "@/types/profile";

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  productUpdates: true,
  contentDigests: true,
  downloadAlerts: true,
  renewalReminders: true,
  paymentAlerts: true,
  accountNotices: true,
  creatorAnnouncements: false,
};

const DEFAULT_CREATOR_WORKSPACE_ALERTS: CreatorWorkspaceAlerts = {
  newSubscriber: true,
  renewalSummary: true,
  failedPayment: false,
  engagementReport: true,
  weeklyRevenue: true,
};

const DEFAULT_CREATOR_WORKSPACE_DEFAULTS: CreatorWorkspaceDefaults = {
  defaultRequiredPlan: "basic",
  defaultStatus: "draft",
};

function normalizeCreatorWorkspaceAlerts(raw: unknown): CreatorWorkspaceAlerts {
  const d = DEFAULT_CREATOR_WORKSPACE_ALERTS;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    newSubscriber: typeof o.newSubscriber === "boolean" ? o.newSubscriber : d.newSubscriber,
    renewalSummary: typeof o.renewalSummary === "boolean" ? o.renewalSummary : d.renewalSummary,
    failedPayment: typeof o.failedPayment === "boolean" ? o.failedPayment : d.failedPayment,
    engagementReport: typeof o.engagementReport === "boolean" ? o.engagementReport : d.engagementReport,
    weeklyRevenue: typeof o.weeklyRevenue === "boolean" ? o.weeklyRevenue : d.weeklyRevenue,
  };
}

function normalizeWorkspaceDefaults(raw: unknown): CreatorWorkspaceDefaults {
  const d = DEFAULT_CREATOR_WORKSPACE_DEFAULTS;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  const requiredPlan =
    o.defaultRequiredPlan === "free" ||
    o.defaultRequiredPlan === "basic" ||
    o.defaultRequiredPlan === "premium"
      ? o.defaultRequiredPlan
      : d.defaultRequiredPlan;
  const status =
    o.defaultStatus === "draft" || o.defaultStatus === "published"
      ? o.defaultStatus
      : d.defaultStatus;
  return {
    defaultRequiredPlan: requiredPlan,
    defaultStatus: status,
  };
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeRole(role: unknown): PublicUserRole {
  return role === "creator" ? "creator" : "subscriber";
}

function isRealFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function parseStringArray(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => cleanText(item)).filter(Boolean).slice(0, 8) : undefined;
  } catch {
    return value ? [value] : undefined;
  }
}

function parseNotifications(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Partial<NotificationPreferences>) : {};
  } catch {
    return {};
  }
}

async function uploadProfileFormFile(input: {
  file: File;
  category: "profileAvatar" | "creatorAvatar" | "creatorBanner";
  clerkUserId: string;
}) {
  return uploadToCloudflareR2({
    category: input.category,
    clerkUserId: input.clerkUserId,
    fileName: input.file.name,
    contentType: input.file.type,
    body: Buffer.from(await input.file.arrayBuffer()),
    sizeBytes: input.file.size,
  });
}

async function safelyDeleteObject(key: string | undefined) {
  if (!key) return;
  try {
    await deleteFromCloudflareR2(key);
  } catch (error) {
    console.warn("[storage:delete]", error);
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function createUniqueCreatorSlug(baseValue: string, clerkUserId: string) {
  const base = slugify(baseValue) || `creator-${clerkUserId.slice(-8).toLowerCase()}`;
  let candidate = base;
  let counter = 1;

  while (await CreatorProfileModel.exists({ creatorSlug: candidate, clerkUserId: { $ne: clerkUserId } })) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }

  return candidate;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function serializeCreatorProfile(profile: CreatorProfileDocument): CreatorProfileResponse {
  return {
    id: profile._id.toString(),
    userProfileId: profile.userProfileId.toString(),
    clerkUserId: profile.clerkUserId,
    creatorName: profile.creatorName,
    creatorSlug: profile.creatorSlug,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    avatarKey: profile.avatarKey,
    bannerUrl: profile.bannerUrl,
    bannerKey: profile.bannerKey,
    subscriberCount: profile.subscriberCount,
    contentCount: profile.contentCount,
    totalViews: profile.totalViews,
    profileStatus: profile.profileStatus,
    creatorWorkspaceAlerts: normalizeCreatorWorkspaceAlerts(profile.creatorWorkspaceAlerts),
    workspaceDefaults: normalizeWorkspaceDefaults(profile.workspaceDefaults),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function serializeUserProfile(
  profile: UserProfileDocument,
  subscriberProfile?: SubscriberProfileDocument | null
): UserProfileResponse {
  return {
    id: profile._id.toString(),
    clerkUserId: profile.clerkUserId,
    email: profile.email,
    fullName: profile.fullName,
    displayName: profile.displayName,
    role: profile.role,
    accountStatus: profile.accountStatus,
    avatarUrl: profile.avatarUrl,
    avatarKey: profile.avatarKey,
    lastLoginAt: toIso(profile.lastLoginAt),
    onboardingCompleted: profile.onboardingCompleted,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    subscriberProfile: subscriberProfile
      ? {
          displayName: subscriberProfile.displayName,
          preferredContentTypes: subscriberProfile.preferredContentTypes,
          notificationPreferences: {
            ...DEFAULT_NOTIFICATIONS,
            ...subscriberProfile.notificationPreferences,
          },
          currentPlanLabel: subscriberProfile.currentPlanLabel,
        }
      : null,
  };
}

export const ACCOUNT_SUSPENDED_MESSAGE = "This account is suspended.";
export const ACCOUNT_DELETED_MESSAGE = "This account is no longer available.";

export function assertAccountIsActive(
  profile: { accountStatus?: string } | null | undefined
) {
  if (profile?.accountStatus === "deleted") {
    throw new Error(ACCOUNT_DELETED_MESSAGE);
  }
  if (profile?.accountStatus === "suspended") {
    throw new Error(ACCOUNT_SUSPENDED_MESSAGE);
  }
}

export async function ensureCurrentUserProfile(options: { updateLastLogin?: boolean } = {}) {
  const user = await currentUser();
  if (!user) return null;

  await connectToMongoDB();

  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
  if (!email) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const displayName = user.username || fullName || email.split("@")[0] || "Advanced Subscription & Membership Platform member";
  const metadataRole = getUserRole(
    (user.publicMetadata as Record<string, unknown>) ?? undefined,
    (user.unsafeMetadata as Record<string, unknown>) ?? undefined
  );
  const role = normalizeRole(metadataRole);
  const isAdmin = isAdminEmail(email);

  // ──────────────────────────────────────────────────────────────
  // IMPORTANT: never overwrite fields the user can edit (`fullName`,
  // `displayName`, `role`, `avatarUrl`) on every sync. Otherwise:
  //
  //   • A user who edited their display name on /account has it
  //     reverted to Clerk's username on the next API call.
  //   • A creator whose Clerk publicMetadata.role is missing gets
  //     silently downgraded to "subscriber" on every request, which
  //     also makes /api/storage/upload return 403 for legitimate
  //     creator uploads (the symptom users see is a video upload
  //     that fails halfway through).
  //
  // We only `$set` Clerk-authoritative fields (email + lastLoginAt).
  // Everything else uses `$setOnInsert` so the value is seeded on
  // first sync but never clobbered afterwards.
  // ──────────────────────────────────────────────────────────────
  let profile = await UserProfileModel.findOneAndUpdate(
    { clerkUserId: user.id },
    {
      $set: {
        email,
        ...(options.updateLastLogin ? { lastLoginAt: new Date() } : {}),
      },
      $setOnInsert: {
        fullName,
        displayName,
        role,
        accountStatus: "active",
        avatarUrl: user.imageUrl || "",
        avatarKey: "",
        onboardingCompleted: false,
      },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

  // Allow upgrading subscriber → creator if Clerk metadata was set
  // *after* the initial sync (e.g. signup form selected creator
  // late). We never go the other direction here.
  if (profile && role === "creator" && profile.role !== "creator") {
    const upgraded = await UserProfileModel.findOneAndUpdate(
      { clerkUserId: user.id },
      { $set: { role: "creator" } },
      { returnDocument: "after" }
    );
    if (upgraded) profile = upgraded;
  }

  if (!profile) return null;

  // Use the persisted role (not the Clerk metadata) so we don't
  // accidentally short-circuit creator paths when metadata is stale.
  const effectiveRole: PublicUserRole = profile.role === "creator" ? "creator" : "subscriber";

  if (effectiveRole === "creator" && !isAdmin) {
    const existingCreator = await CreatorProfileModel.findOne({ clerkUserId: user.id });
    if (!existingCreator) {
      let profileStatus: "draft" | "published" = "draft";
      try {
        const { loadPlatformSettings } = await import("@/lib/mongodb/admin-settings");
        const settings = await loadPlatformSettings();
        if (settings.defaultCreatorStatus === "active") {
          profileStatus = "published";
        }
      } catch (error) {
        console.warn("[profile-sync] default creator status", error);
      }

      await CreatorProfileModel.create({
        userProfileId: profile._id,
        clerkUserId: user.id,
        creatorName: profile.displayName || displayName,
        creatorSlug: await createUniqueCreatorSlug(
          profile.displayName || displayName || email.split("@")[0],
          user.id
        ),
        bio: "",
        avatarUrl: user.imageUrl || "",
        avatarKey: "",
        bannerUrl: "",
        bannerKey: "",
        profileStatus,
      });
    }
  }

  if (effectiveRole === "subscriber" && !isAdmin) {
    await SubscriberProfileModel.findOneAndUpdate(
      { clerkUserId: user.id },
      {
        $setOnInsert: {
          userProfileId: profile._id,
          clerkUserId: user.id,
          displayName: profile.displayName || displayName,
          preferredContentTypes: ["Video", "Article", "PDF"],
          notificationPreferences: DEFAULT_NOTIFICATIONS,
          currentPlanLabel: "Free preview",
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    );
  }

  // Fire a one-time welcome notification on a brand-new account so
  // /notifications has a friendly first row instead of being empty
  // or showing the next "Profile updated" message as the only entry.
  // Best-effort: any failure here must not block the sync.
  try {
    const wasNewlyCreated =
      Math.abs(profile.createdAt.getTime() - profile.updatedAt.getTime()) <
      2000;
    if (wasNewlyCreated) {
      const existing = await NotificationModel.exists({
        recipientClerkUserId: user.id,
      });
      if (!existing) {
        await NotificationModel.create({
          recipientClerkUserId: user.id,
          category: "system",
          title: `Welcome to Advanced Subscription & Membership Platform${profile.displayName ? `, ${profile.displayName}` : ""}!`,
          message:
            effectiveRole === "creator"
              ? "Your creator workspace is ready. Set up your profile, create your first plans, and publish content to start earning."
              : "Browse the Member Library, follow creators you love, and upgrade any time to unlock premium content.",
          link: effectiveRole === "creator" ? "/creator" : "/library",
          metadata: { source: "welcome" },
        });
      }
    }
  } catch (err) {
    console.warn("[profile-sync] welcome notification failed", err);
  }

  return { user, profile, role: effectiveRole, isAdmin };
}

export async function getCurrentUserProfileResponse() {
  const synced = await ensureCurrentUserProfile();
  if (!synced) return null;

  const subscriberProfile = await SubscriberProfileModel.findOne({ clerkUserId: synced.user.id });
  return serializeUserProfile(synced.profile, subscriberProfile);
}

export async function updateCurrentUserProfile(input: {
  fullName?: unknown;
  displayName?: unknown;
  preferredContentTypes?: unknown;
  notificationPreferences?: unknown;
}) {
  const synced = await ensureCurrentUserProfile();
  if (!synced) return null;

  const fullName = cleanText(input.fullName, synced.profile.fullName).slice(0, 120);
  const displayName = cleanText(input.displayName, synced.profile.displayName).slice(0, 80);

  const profile = await UserProfileModel.findOneAndUpdate(
    { clerkUserId: synced.user.id },
    { $set: { fullName, displayName } },
    { returnDocument: "after" }
  );

  if (synced.role === "subscriber") {
    const preferredContentTypes = Array.isArray(input.preferredContentTypes)
      ? input.preferredContentTypes.map((item) => cleanText(item)).filter(Boolean).slice(0, 8)
      : undefined;
    const rawNotifications =
      input.notificationPreferences && typeof input.notificationPreferences === "object"
        ? (input.notificationPreferences as Partial<NotificationPreferences>)
        : {};

    const existingPrefs = (
      await SubscriberProfileModel.findOne({ clerkUserId: synced.user.id })
    )?.notificationPreferences;
    await SubscriberProfileModel.findOneAndUpdate(
      { clerkUserId: synced.user.id },
      {
        $set: {
          displayName,
          ...(preferredContentTypes ? { preferredContentTypes } : {}),
          notificationPreferences: {
            ...DEFAULT_NOTIFICATIONS,
            ...(existingPrefs ?? {}),
            ...Object.fromEntries(
              Object.entries(rawNotifications).filter(([, value]) => typeof value === "boolean")
            ),
          },
        },
        $setOnInsert: {
          userProfileId: synced.profile._id,
          clerkUserId: synced.user.id,
          currentPlanLabel: "Free preview",
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    );
  }

  const subscriberProfile = await SubscriberProfileModel.findOne({ clerkUserId: synced.user.id });
  return profile ? serializeUserProfile(profile, subscriberProfile) : null;
}

export async function updateCurrentUserProfileFromFormData(formData: FormData) {
  const synced = await ensureCurrentUserProfile();
  if (!synced) return null;

  const fullName = cleanText(formData.get("fullName"), synced.profile.fullName).slice(0, 120);
  const displayName = cleanText(formData.get("displayName"), synced.profile.displayName).slice(0, 80);
  const avatarValue = formData.get("avatar");
  const avatar = isRealFile(avatarValue) ? avatarValue : null;
  const avatarUpload = avatar
    ? await uploadProfileFormFile({ file: avatar, category: "profileAvatar", clerkUserId: synced.user.id })
    : null;

  const profile = await UserProfileModel.findOneAndUpdate(
    { clerkUserId: synced.user.id },
    {
      $set: {
        fullName,
        displayName,
        ...(avatarUpload ? { avatarUrl: avatarUpload.publicUrl ?? "", avatarKey: avatarUpload.key } : {}),
      },
    },
    { returnDocument: "after" }
  );

  if (avatarUpload && synced.profile.avatarKey) {
    await safelyDeleteObject(synced.profile.avatarKey);
  }

  if (synced.role === "subscriber") {
    const preferredContentTypes = parseStringArray(formData.get("preferredContentTypes"));
    const rawNotifications = parseNotifications(formData.get("notificationPreferences"));

    const existingPrefs = (
      await SubscriberProfileModel.findOne({ clerkUserId: synced.user.id })
    )?.notificationPreferences;
    await SubscriberProfileModel.findOneAndUpdate(
      { clerkUserId: synced.user.id },
      {
        $set: {
          displayName,
          ...(preferredContentTypes ? { preferredContentTypes } : {}),
          notificationPreferences: {
            ...DEFAULT_NOTIFICATIONS,
            ...(existingPrefs ?? {}),
            ...Object.fromEntries(
              Object.entries(rawNotifications).filter(([, value]) => typeof value === "boolean")
            ),
          },
        },
        $setOnInsert: {
          userProfileId: synced.profile._id,
          clerkUserId: synced.user.id,
          currentPlanLabel: "Free preview",
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    );
  }

  const subscriberProfile = await SubscriberProfileModel.findOne({ clerkUserId: synced.user.id });
  return profile ? serializeUserProfile(profile, subscriberProfile) : null;
}

export async function getCurrentCreatorProfileResponse() {
  const synced = await ensureCurrentUserProfile();
  if (!synced || synced.role !== "creator" || synced.isAdmin) return null;

  const creatorProfile = await CreatorProfileModel.findOne({ clerkUserId: synced.user.id });
  return creatorProfile ? serializeCreatorProfile(creatorProfile) : null;
}

export async function updateCurrentCreatorProfile(input: {
  creatorName?: unknown;
  creatorSlug?: unknown;
  bio?: unknown;
  avatarUrl?: unknown;
  bannerUrl?: unknown;
  profileStatus?: unknown;
  creatorWorkspaceAlerts?: unknown;
  workspaceDefaults?: unknown;
}) {
  const synced = await ensureCurrentUserProfile();
  if (!synced || synced.role !== "creator" || synced.isAdmin) return null;

  const existing = await CreatorProfileModel.findOne({ clerkUserId: synced.user.id });
  if (!existing) return null;

  const creatorName = cleanText(input.creatorName, existing.creatorName).slice(0, 120);
  const requestedSlug = slugify(cleanText(input.creatorSlug, existing.creatorSlug));
  const creatorSlug = requestedSlug
    ? await createUniqueCreatorSlug(requestedSlug, synced.user.id)
    : existing.creatorSlug;
  const profileStatus =
    input.profileStatus === "published"
      ? "published"
      : input.profileStatus === "draft"
        ? "draft"
        : existing.profileStatus;

  const setDoc: Record<string, unknown> = {
    creatorName,
    creatorSlug,
    bio: cleanText(input.bio, existing.bio).slice(0, 600),
    avatarUrl: cleanText(input.avatarUrl, existing.avatarUrl).slice(0, 500),
    bannerUrl: cleanText(input.bannerUrl, existing.bannerUrl).slice(0, 500),
    profileStatus,
  };
  if (input.creatorWorkspaceAlerts != null && typeof input.creatorWorkspaceAlerts === "object") {
    setDoc.creatorWorkspaceAlerts = normalizeCreatorWorkspaceAlerts({
      ...normalizeCreatorWorkspaceAlerts(existing.creatorWorkspaceAlerts),
      ...(input.creatorWorkspaceAlerts as Record<string, unknown>),
    });
  }
  if (input.workspaceDefaults != null && typeof input.workspaceDefaults === "object") {
    setDoc.workspaceDefaults = normalizeWorkspaceDefaults({
      ...normalizeWorkspaceDefaults(existing.workspaceDefaults),
      ...(input.workspaceDefaults as Record<string, unknown>),
    });
  }

  const creatorProfile = await CreatorProfileModel.findOneAndUpdate(
    { clerkUserId: synced.user.id },
    { $set: setDoc },
    { returnDocument: "after" }
  );

  await UserProfileModel.findOneAndUpdate(
    { clerkUserId: synced.user.id },
    { $set: { displayName: creatorName } }
  );

  return creatorProfile ? serializeCreatorProfile(creatorProfile) : null;
}

export async function updateCurrentCreatorProfileFromFormData(formData: FormData) {
  const synced = await ensureCurrentUserProfile();
  if (!synced || synced.role !== "creator" || synced.isAdmin) return null;

  const existing = await CreatorProfileModel.findOne({ clerkUserId: synced.user.id });
  if (!existing) return null;

  const creatorName = cleanText(formData.get("creatorName"), existing.creatorName).slice(0, 120);
  const requestedSlug = slugify(cleanText(formData.get("creatorSlug"), existing.creatorSlug));
  const creatorSlug = requestedSlug
    ? await createUniqueCreatorSlug(requestedSlug, synced.user.id)
    : existing.creatorSlug;
  const profileStatus = formData.get("profileStatus") === "published" ? "published" : "draft";
  const avatarValue = formData.get("avatar");
  const bannerValue = formData.get("banner");
  const avatar = isRealFile(avatarValue) ? avatarValue : null;
  const banner = isRealFile(bannerValue) ? bannerValue : null;
  const avatarUpload = avatar
    ? await uploadProfileFormFile({ file: avatar, category: "creatorAvatar", clerkUserId: synced.user.id })
    : null;
  const bannerUpload = banner
    ? await uploadProfileFormFile({ file: banner, category: "creatorBanner", clerkUserId: synced.user.id })
    : null;

  const creatorProfile = await CreatorProfileModel.findOneAndUpdate(
    { clerkUserId: synced.user.id },
    {
      $set: {
        creatorName,
        creatorSlug,
        bio: cleanText(formData.get("bio"), existing.bio).slice(0, 600),
        profileStatus,
        ...(avatarUpload ? { avatarUrl: avatarUpload.publicUrl ?? "", avatarKey: avatarUpload.key } : {}),
        ...(bannerUpload ? { bannerUrl: bannerUpload.publicUrl ?? "", bannerKey: bannerUpload.key } : {}),
      },
    },
    { returnDocument: "after" }
  );

  if (avatarUpload && existing.avatarKey) await safelyDeleteObject(existing.avatarKey);
  if (bannerUpload && existing.bannerKey) await safelyDeleteObject(existing.bannerKey);

  await UserProfileModel.findOneAndUpdate(
    { clerkUserId: synced.user.id },
    {
      $set: {
        displayName: creatorName,
        ...(avatarUpload ? { avatarUrl: avatarUpload.publicUrl ?? "", avatarKey: avatarUpload.key } : {}),
      },
    }
  );

  return creatorProfile ? serializeCreatorProfile(creatorProfile) : null;
}

export async function getCreatorProfileBySlug(slug: string) {
  await connectToMongoDB();
  const creatorProfile = await CreatorProfileModel.findOne({ creatorSlug: slugify(slug) });
  if (!creatorProfile) return null;

  if (creatorProfile.profileStatus === "published") {
    return serializeCreatorProfile(creatorProfile);
  }

  const user = await currentUser();
  const userId = user?.id ?? null;
  if (!userId) return null;
  if (userId === creatorProfile.clerkUserId) {
    return serializeCreatorProfile(creatorProfile);
  }

  const viewer = await UserProfileModel.findOne({ clerkUserId: userId });
  if (viewer?.email && isAdminEmail(viewer.email)) {
    return serializeCreatorProfile(creatorProfile);
  }

  return null;
}
