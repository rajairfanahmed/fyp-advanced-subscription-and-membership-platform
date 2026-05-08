import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";

/**
 * Resolved Clerk user for route handlers. Prefer `currentUser()`; fall back
 * to the Backend API when the session cookie is present but `currentUser()`
 * has not populated yet (common briefly after OAuth completes).
 */
export type ClerkSessionUser = {
  userId: string;
  id: string;
  email: string;
  publicMetadata: Record<string, unknown>;
  unsafeMetadata: Record<string, unknown>;
  firstName: string;
  lastName: string;
  imageUrl: string;
};

export async function resolveClerkSessionUser(): Promise<ClerkSessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const live = await currentUser();
  if (live) {
    const email =
      live.primaryEmailAddress?.emailAddress ??
      live.emailAddresses?.[0]?.emailAddress ??
      "";
    return {
      userId,
      id: live.id,
      email,
      publicMetadata: (live.publicMetadata as Record<string, unknown>) ?? {},
      unsafeMetadata: (live.unsafeMetadata as Record<string, unknown>) ?? {},
      firstName: live.firstName ?? "",
      lastName: live.lastName ?? "",
      imageUrl: live.imageUrl ?? "",
    };
  }

  try {
    const client = await clerkClient();
    const u = await client.users.getUser(userId);
    const primaryId = u.primaryEmailAddressId;
    const email =
      u.emailAddresses.find((e) => e.id === primaryId)?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      "";
    return {
      userId,
      id: u.id,
      email,
      publicMetadata: (u.publicMetadata as Record<string, unknown>) ?? {},
      unsafeMetadata: (u.unsafeMetadata as Record<string, unknown>) ?? {},
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      imageUrl: u.imageUrl ?? "",
    };
  } catch (err) {
    console.warn("[clerk-session-user] Backend user fetch failed:", err);
    return null;
  }
}
