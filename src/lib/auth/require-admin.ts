import { auth, currentUser } from "@clerk/nextjs/server";

import { isAdminEmail } from "@/lib/auth/roles";

export type AdminContext = {
  clerkUserId: string;
  email: string;
};

/**
 * Returns the current Clerk user's id + primary email **only** if
 * their email is in the `ADMIN_EMAILS` allowlist. Throws an `Error`
 * with a friendly message otherwise so API routes can map it to a
 * 401/403 response uniformly.
 *
 * Server-only — uses `process.env.ADMIN_EMAILS`.
 */
export async function requireAdminContext(): Promise<AdminContext> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Not signed in.");
  }

  const user = await currentUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    "";

  if (!email || !isAdminEmail(email)) {
    throw new Error("Admin access required.");
  }

  return { clerkUserId: userId, email: email.toLowerCase() };
}
