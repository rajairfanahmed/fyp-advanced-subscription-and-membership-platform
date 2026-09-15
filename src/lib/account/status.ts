import { connectToMongoDB } from "@/lib/mongodb/connect";
import { UserProfileModel } from "@/lib/mongodb/models";

export const CREATOR_UNAVAILABLE_MESSAGE =
  "This creator is not accepting members right now.";

export const VIEWER_SUSPENDED_MESSAGE = "This account is suspended.";

export function consumeDenyMessage(
  reason?: "viewer_blocked" | "creator_blocked" | "plan"
) {
  if (reason === "creator_blocked") return CREATOR_UNAVAILABLE_MESSAGE;
  if (reason === "viewer_blocked") return VIEWER_SUSPENDED_MESSAGE;
  return null;
}

export function isAccountBlocked(status?: string | null) {
  return status === "suspended" || status === "deleted";
}

export async function loadAccountStatus(clerkUserId: string): Promise<string> {
  if (!clerkUserId) return "active";
  await connectToMongoDB();
  const profile = await UserProfileModel.findOne({ clerkUserId });
  return profile?.accountStatus ?? "active";
}

export async function assertCreatorIsAcceptingMembers(creatorClerkUserId: string) {
  const status = await loadAccountStatus(creatorClerkUserId);
  if (isAccountBlocked(status)) {
    throw new Error(CREATOR_UNAVAILABLE_MESSAGE);
  }
}

export async function blockedAccountIds(clerkUserIds: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(clerkUserIds.filter(Boolean)));
  if (unique.length === 0) return new Set();
  await connectToMongoDB();
  const profiles = await UserProfileModel.find({
    clerkUserId: { $in: unique },
  });
  const blocked = new Set<string>();
  const found = new Set<string>();
  for (const profile of profiles) {
    found.add(profile.clerkUserId);
    if (isAccountBlocked(profile.accountStatus)) {
      blocked.add(profile.clerkUserId);
    }
  }
  return blocked;
}
