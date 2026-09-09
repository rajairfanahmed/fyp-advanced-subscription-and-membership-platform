/**
 * Auth role configuration for Advanced Subscription & Membership Platform.
 *
 * Roles:
 * - subscriber: browses paid content library
 * - creator: publishes content and manages memberships
 * - admin: managed via ADMIN_EMAILS env variable (not a signup option)
 */

export type UserRole = "subscriber" | "creator";

/** Post-signup/login redirect destinations per role */
export const ROLE_REDIRECTS: Record<UserRole | "admin", string> = {
  subscriber: "/library",
  creator: "/creator",
  admin: "/admin",
};

/** Default role if none is set in Clerk metadata */
export const DEFAULT_ROLE: UserRole = "subscriber";

/**
 * Parse ADMIN_EMAILS from env (comma-separated, trimmed, lowercased).
 * Safe to call on the server only — ADMIN_EMAILS is not a NEXT_PUBLIC_ var.
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check whether an email is in the admin allowlist.
 * Must be called server-side only (needs process.env.ADMIN_EMAILS).
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.trim().toLowerCase());
}

/**
 * Extract the user role from Clerk metadata.
 * Checks publicMetadata first, then unsafeMetadata as fallback.
 */
export function getUserRole(
  publicMetadata?: Record<string, unknown>,
  unsafeMetadata?: Record<string, unknown>
): UserRole {
  const role =
    (publicMetadata?.role as string) ||
    (unsafeMetadata?.role as string) ||
    "";

  if (role === "creator") return "creator";
  return "subscriber";
}

/**
 * Determine redirect path after auth based on role and admin email.
 * Call server-side only (uses ADMIN_EMAILS).
 */
export function getUserRedirectPath(
  email: string,
  publicMetadata?: Record<string, unknown>,
  unsafeMetadata?: Record<string, unknown>
): string {
  // Admin check by email allowlist (highest priority)
  if (isAdminEmail(email)) {
    return ROLE_REDIRECTS.admin;
  }

  const role = getUserRole(publicMetadata, unsafeMetadata);
  return ROLE_REDIRECTS[role] || ROLE_REDIRECTS.subscriber;
}
