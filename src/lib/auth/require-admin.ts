import { auth, currentUser } from "@clerk/nextjs/server";

import { isAdminEmail } from "@/lib/auth/roles";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { recordAdminAudit, type AdminAuditInput } from "@/lib/mongodb/admin-audit";

export type AdminContext = {
  clerkUserId: string;
  email: string;
};

export const ADMIN_RATE_LIMIT_MESSAGE =
  "Too many admin actions. Please wait and try again.";

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

export async function requireAdminMutation(req: Request): Promise<AdminContext> {
  const ctx = await requireAdminContext();
  const result = rateLimit(
    `admin-mutate:${ctx.clerkUserId}:${clientIp(req)}`,
    60,
    15 * 60 * 1000
  );
  if (!result.ok) {
    const error = new Error(ADMIN_RATE_LIMIT_MESSAGE) as Error & {
      status?: number;
      headers?: HeadersInit;
    };
    error.status = 429;
    error.headers = rateLimitHeaders(result);
    throw error;
  }
  return ctx;
}

export function assertNotAdminTarget(email: string | null | undefined) {
  if (email && isAdminEmail(email)) {
    throw new Error("Admin accounts cannot be modified from this screen.");
  }
}

export function assertNotSelfTarget(actorClerkUserId: string, targetClerkUserId: string) {
  if (actorClerkUserId && targetClerkUserId && actorClerkUserId === targetClerkUserId) {
    throw new Error("You cannot change your own admin account this way.");
  }
}

export function confirmationPhraseOf(body: unknown): string {
  return String(
    (body as { confirmationPhrase?: unknown } | null)?.confirmationPhrase ?? ""
  ).trim();
}

export function assertConfirmationPhrase(
  typed: string,
  expected: string,
  message = "Confirmation phrase does not match."
) {
  if (!expected || typed.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    throw new Error(message);
  }
}

export async function auditAdmin(
  ctx: AdminContext,
  req: Request,
  input: Omit<AdminAuditInput, "actorClerkUserId" | "actorEmail" | "ip">
) {
  await recordAdminAudit({
    ...input,
    actorClerkUserId: ctx.clerkUserId,
    actorEmail: ctx.email,
    ip: clientIp(req),
  });
}

export function adminApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const statusFromError =
    error instanceof Error && "status" in error
      ? Number((error as { status?: number }).status)
      : 0;
  const status =
    statusFromError === 429
      ? 429
      : message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : message === ADMIN_RATE_LIMIT_MESSAGE
            ? 429
            : 400;
  const headers =
    error instanceof Error && "headers" in error
      ? ((error as { headers?: HeadersInit }).headers ?? undefined)
      : undefined;
  return { message, status, headers };
}
