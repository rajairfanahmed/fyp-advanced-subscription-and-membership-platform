import { clerkClient } from "@clerk/nextjs/server";

import {
  deleteCreatorAccount,
  deleteSubscriberAccount,
} from "@/lib/account/delete";
import {
  assertNotAdminTarget,
  assertNotSelfTarget,
  type AdminContext,
} from "@/lib/auth/require-admin";
import { isRecordId } from "@/lib/db/ids";
import { connectToMongoDB } from "@/lib/mongodb/connect";
import { getAdminUserDetail } from "@/lib/mongodb/admin-stats";
import {
  CreatorProfileModel,
  SubscriptionModel,
  UserProfileModel,
} from "@/lib/mongodb/models";
import { createNotification } from "@/lib/mongodb/notifications";
import {
  pauseStripeSubscriptionCollection,
  resumeStripeSubscriptionCollection,
} from "@/lib/stripe/subscription-ops";
import type { AdminUserDetailResponse } from "@/types/admin-stats";

function userLookup(userIdOrClerkId: string) {
  return isRecordId(userIdOrClerkId)
    ? { _id: userIdOrClerkId }
    : { clerkUserId: userIdOrClerkId };
}

async function loadTargetProfile(userIdOrClerkId: string) {
  await connectToMongoDB();
  return UserProfileModel.findOne(userLookup(userIdOrClerkId));
}

async function stripeIdsToPause(clerkUserId: string, role: string) {
  const own = await SubscriptionModel.find({ subscriberClerkUserId: clerkUserId });
  const incoming =
    role === "creator"
      ? await SubscriptionModel.find({ creatorClerkUserId: clerkUserId })
      : [];
  return Array.from(
    new Set(
      [...own, ...incoming]
        .map((sub) => sub.stripeSubscriptionId)
        .filter((id): id is string => Boolean(id))
    )
  );
}

async function pauseAllOrThrow(stripeIds: string[]) {
  if (stripeIds.length === 0) return;
  const { isStripeConfigured } = await import("@/lib/stripe/client");
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe is not configured. Billing could not be paused, so the account was not suspended."
    );
  }
  const paused: string[] = [];
  try {
    for (const stripeId of stripeIds) {
      const result = await pauseStripeSubscriptionCollection(stripeId);
      if (!result) {
        throw new Error("Stripe did not pause collection.");
      }
      paused.push(stripeId);
    }
  } catch {
    for (const stripeId of paused) {
      try {
        await resumeStripeSubscriptionCollection(stripeId);
      } catch (resumeError) {
        console.warn("[admin:lifecycle:pause-rollback]", stripeId, resumeError);
      }
    }
    throw new Error(
      "Stripe could not pause billing for this account. The account was not suspended."
    );
  }
}

async function resumeAll(stripeIds: string[]) {
  if (stripeIds.length === 0) return;
  const { isStripeConfigured } = await import("@/lib/stripe/client");
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe is not configured. Billing could not be resumed, so the account was not restored."
    );
  }
  const failures: string[] = [];
  for (const stripeId of stripeIds) {
    try {
      await resumeStripeSubscriptionCollection(stripeId);
    } catch {
      failures.push(stripeId);
    }
  }
  if (failures.length) {
    throw new Error(
      "Stripe could not resume billing for this account. The account was not restored."
    );
  }
}

async function banAndRevokeClerk(clerkUserId: string) {
  const client = await clerkClient();
  await client.users.banUser(clerkUserId);
  const sessions = await client.sessions.getSessionList({ userId: clerkUserId });
  await Promise.all(
    (sessions.data ?? []).map((session) =>
      client.sessions.revokeSession(session.id).catch(() => undefined)
    )
  );
}

async function unbanClerk(clerkUserId: string) {
  const client = await clerkClient();
  await client.users.unbanUser(clerkUserId);
}

function guardTarget(ctx: AdminContext, email: string, clerkUserId: string) {
  assertNotAdminTarget(email);
  assertNotSelfTarget(ctx.clerkUserId, clerkUserId);
}

async function notifyCreatorAudience(input: {
  creatorClerkUserId: string;
  creatorName: string;
  suspended: boolean;
}) {
  const subs = await SubscriptionModel.find({
    creatorClerkUserId: input.creatorClerkUserId,
    status: { $in: ["active", "trialing", "past_due"] },
  });
  const recipients = Array.from(
    new Set(subs.map((sub) => sub.subscriberClerkUserId).filter(Boolean))
  );
  await Promise.all(
    recipients.map((recipientClerkUserId) =>
      createNotification({
        recipientClerkUserId,
        category: "account",
        title: input.suspended
          ? `${input.creatorName} is temporarily unavailable`
          : `${input.creatorName} is back`,
        message: input.suspended
          ? `Access to ${input.creatorName} is paused while the creator account is under review. You will not be billed until it is restored.`
          : `${input.creatorName} is available again. Your membership access has been restored.`,
        link: "/library",
      }).catch((error) => {
        console.warn("[admin:lifecycle:audience-notify]", error);
      })
    )
  );
}

export async function applyAdminAccountStatus(input: {
  ctx: AdminContext;
  userIdOrClerkId: string;
  accountStatus: "active" | "suspended";
}): Promise<AdminUserDetailResponse> {
  const profile = await loadTargetProfile(input.userIdOrClerkId);
  if (!profile) {
    throw new Error("User not found.");
  }
  guardTarget(input.ctx, profile.email, profile.clerkUserId);

  const stripeIds = await stripeIdsToPause(profile.clerkUserId, profile.role);
  const creatorProfile =
    profile.role === "creator"
      ? await CreatorProfileModel.findOne({ clerkUserId: profile.clerkUserId })
      : null;

  if (input.accountStatus === "suspended") {
    await pauseAllOrThrow(stripeIds);
    try {
      await banAndRevokeClerk(profile.clerkUserId);
    } catch (error) {
      console.warn("[admin:lifecycle:clerk-ban]", error);
      await resumeAll(stripeIds).catch((resumeError) => {
        console.warn("[admin:lifecycle:clerk-ban-rollback]", resumeError);
      });
      throw new Error(
        "Could not revoke this user’s sessions. The account was not suspended."
      );
    }
  } else {
    try {
      await unbanClerk(profile.clerkUserId);
    } catch (error) {
      console.warn("[admin:lifecycle:clerk-unban]", error);
      throw new Error(
        "Could not restore this user’s sign-in. The account was not restored."
      );
    }
    try {
      await resumeAll(stripeIds);
    } catch (error) {
      try {
        await banAndRevokeClerk(profile.clerkUserId);
      } catch (rebanError) {
        console.warn("[admin:lifecycle:restore-reban]", rebanError);
      }
      throw error;
    }
  }

  profile.accountStatus = input.accountStatus;
  await profile.save();

  try {
    await createNotification({
      recipientClerkUserId: profile.clerkUserId,
      category: "account",
      title:
        input.accountStatus === "suspended"
          ? "Account suspended"
          : "Account restored",
      message:
        input.accountStatus === "suspended"
          ? "Your account has been suspended by platform support. Billing is paused and access is locked until the account is restored."
          : "Your account has been restored. You can sign in and use the platform again.",
      link: "/account",
    });
  } catch (error) {
    console.warn("[admin:lifecycle:notify]", error);
  }

  if (creatorProfile) {
    await notifyCreatorAudience({
      creatorClerkUserId: profile.clerkUserId,
      creatorName: creatorProfile.creatorName || "This creator",
      suspended: input.accountStatus === "suspended",
    });
  }

  const detail = await getAdminUserDetail(profile.clerkUserId);
  if (!detail) {
    throw new Error("User not found.");
  }
  return detail;
}

export async function deleteAdminUser(input: {
  ctx: AdminContext;
  userIdOrClerkId: string;
}) {
  const profile = await loadTargetProfile(input.userIdOrClerkId);
  if (!profile) {
    throw new Error("User not found.");
  }
  guardTarget(input.ctx, profile.email, profile.clerkUserId);

  if (profile.role === "creator") {
    const creatorProfile = await CreatorProfileModel.findOne({
      clerkUserId: profile.clerkUserId,
    });
    const creatorName = creatorProfile?.creatorName || "This creator";
    const subs = await SubscriptionModel.find({
      creatorClerkUserId: profile.clerkUserId,
    });
    const recipients = Array.from(
      new Set(subs.map((sub) => sub.subscriberClerkUserId).filter(Boolean))
    );
    await Promise.all(
      recipients.map((recipientClerkUserId) =>
        createNotification({
          recipientClerkUserId,
          category: "account",
          title: `${creatorName} is no longer on the platform`,
          message: `Your membership with ${creatorName} has ended. You will not be billed again. Payment history stays on your billing page.`,
          link: "/billing",
        }).catch((error) => {
          console.warn("[admin:lifecycle:delete-notify]", error);
        })
      )
    );
  }

  const report =
    profile.role === "creator"
      ? await deleteCreatorAccount(profile.clerkUserId, {
          preservePaymentLedger: true,
        })
      : await deleteSubscriberAccount(profile.clerkUserId, {
          preservePaymentLedger: true,
        });

  return {
    ok: true as const,
    clerkUserId: profile.clerkUserId,
    email: profile.email,
    report,
  };
}
