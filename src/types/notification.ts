import type { CreatorWorkspaceAlerts } from "./profile";

export type NotificationCategory =
  | "renewal"
  | "payment"
  | "content"
  | "account"
  | "locked"
  | "creator"
  | "system";

export type NotificationResponse = {
  id: string;
  recipientClerkUserId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type NotificationCreateInput = {
  recipientClerkUserId: string;
  category?: NotificationCategory;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** When set and the recipient is a creator, gates delivery on `CreatorProfile.creatorWorkspaceAlerts`. */
  creatorWorkspaceAlertKey?: keyof CreatorWorkspaceAlerts;
};

export type NotificationListResult = {
  items: NotificationResponse[];
  totalCount: number;
  unreadCount: number;
};
