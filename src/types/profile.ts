export type PublicUserRole = "subscriber" | "creator";
export type AccountStatus = "active" | "suspended" | "deleted";
export type CreatorProfileStatus = "draft" | "published";

/** Creator /creator/settings workspace alert toggles (persisted on CreatorProfile). */
export type CreatorWorkspaceAlerts = {
  newSubscriber: boolean;
  renewalSummary: boolean;
  failedPayment: boolean;
  engagementReport: boolean;
  weeklyRevenue: boolean;
};

/**
 * Pre-populated default values used when a creator opens the "Create
 * Content" form. Persisted on `CreatorProfile.workspaceDefaults` so a
 * creator's preferred publishing flow survives across sessions and
 * machines.
 */
export type CreatorWorkspaceDefaults = {
  defaultRequiredPlan: "free" | "basic" | "premium";
  defaultStatus: "draft" | "published";
};

export type NotificationPreferences = {
  productUpdates: boolean;
  contentDigests: boolean;
  downloadAlerts: boolean;
  renewalReminders: boolean;
  paymentAlerts: boolean;
  accountNotices: boolean;
  creatorAnnouncements: boolean;
};

export type UserProfileResponse = {
  id: string;
  clerkUserId: string;
  email: string;
  fullName: string;
  displayName: string;
  role: PublicUserRole;
  accountStatus: AccountStatus;
  avatarUrl: string;
  avatarKey: string;
  lastLoginAt: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  subscriberProfile?: {
    displayName: string;
    preferredContentTypes: string[];
    notificationPreferences: NotificationPreferences;
    currentPlanLabel: string;
  } | null;
};

export type CreatorProfileResponse = {
  id: string;
  userProfileId: string;
  clerkUserId: string;
  creatorName: string;
  creatorSlug: string;
  bio: string;
  avatarUrl: string;
  avatarKey: string;
  bannerUrl: string;
  bannerKey: string;
  subscriberCount: number;
  contentCount: number;
  totalViews: number;
  profileStatus: CreatorProfileStatus;
  creatorWorkspaceAlerts: CreatorWorkspaceAlerts;
  workspaceDefaults: CreatorWorkspaceDefaults;
  createdAt: string;
  updatedAt: string;
};
