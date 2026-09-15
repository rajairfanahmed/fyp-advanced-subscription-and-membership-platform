import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

/**
 * Advanced Subscription & Membership Platform Clerk Middleware — Next.js 15 + Clerk v7
 *
 * Guest perimeter:
 * - Public pages stay public.
 * - Public APIs are an explicit allowlist (never `/api/auth/(.*)`).
 * - Any other API hit without a session returns 401 JSON immediately.
 * - Known session pages redirect guests to `/login?redirect_url=…`.
 * - Unknown page URLs are not treated as protected — Next.js renders
 *   `not-found.tsx` instead of bouncing guests into the login form.
 */

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/content-preview",
  "/about",
  "/support",
  "/contact",
  "/terms",
  "/privacy",
  "/login(.*)",
  "/sign-up(.*)",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/sso-callback",
  "/maintenance",
  "/api/auth/me",
  "/api/auth/throttle",
  "/api/system/(.*)",
  "/api/public/(.*)",
  "/api/contact",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  "/creators",
  "/creators/(.*)",
  "/locked-content",
]);
const isAuthPageRoute = createRouteMatcher(["/login(.*)", "/sign-up(.*)"]);
const isCreatorRoute = createRouteMatcher(["/creator", "/creator/(.*)"]);
const isCreatorApiRoute = createRouteMatcher([
  "/api/creator/(.*)",
  "/api/creator-profile",
  "/api/creator-profile/(.*)",
  "/api/plans",
  "/api/plans/(.*)",
  "/api/storage/upload",
]);
const isAdminRoute = createRouteMatcher(["/admin", "/admin/(.*)"]);
const isAdminApiRoute = createRouteMatcher(["/api/admin/(.*)"]);
const isSubscriberWorkspaceRoute = createRouteMatcher([
  "/library",
  "/library/(.*)",
  "/subscription",
  "/billing",
]);
/** Pages that require a session. Unknown paths stay public so they 404. */
const isSessionPageRoute = createRouteMatcher([
  "/library",
  "/library/(.*)",
  "/subscription",
  "/billing",
  "/account",
  "/account/(.*)",
  "/notifications",
  "/notifications/(.*)",
  "/creator",
  "/creator/(.*)",
  "/admin",
  "/admin/(.*)",
]);
const isApiRoute = createRouteMatcher(["/api/(.*)"]);
const isContactApi = createRouteMatcher(["/api/contact"]);
const isAuthThrottleApi = createRouteMatcher(["/api/auth/throttle"]);

const isMaintenanceAllowlist = createRouteMatcher([
  "/maintenance",
  "/admin",
  "/admin/(.*)",
  "/api/admin/(.*)",
  "/api/auth/me",
  "/api/auth/throttle",
  "/api/system/(.*)",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  "/login(.*)",
  "/sign-up(.*)",
  "/sso-callback",
]);

async function isMaintenanceEnabled(reqUrl: string): Promise<boolean> {
  try {
    const url = new URL("/api/system/maintenance", reqUrl);
    const res = await fetch(url, {
      next: { revalidate: 30, tags: ["platform-maintenance"] },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return Boolean(data?.enabled);
  } catch {
    return false;
  }
}

function getAdminEmailsFromEnv(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type ClerkUserForAuth = {
  email: string;
  publicMetadata?: Record<string, unknown>;
  unsafeMetadata?: Record<string, unknown>;
};

type ClerkUserApiResponse = {
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string;
  public_metadata?: Record<string, unknown>;
  unsafe_metadata?: Record<string, unknown>;
};

function getRoleFromMetadata(
  publicMetadata?: Record<string, unknown>,
  unsafeMetadata?: Record<string, unknown>
): "subscriber" | "creator" {
  const raw = (publicMetadata?.role as string) || (unsafeMetadata?.role as string) || "";
  return raw === "creator" ? "creator" : "subscriber";
}

function getRedirectByRole(isAdmin: boolean, role: "subscriber" | "creator"): string {
  if (isAdmin) return "/admin";
  if (role === "creator") return "/creator";
  return "/library";
}

function jsonError(
  status: 401 | 403 | 429 | 503,
  error: string,
  extra?: Record<string, unknown>,
  headers?: HeadersInit
) {
  return NextResponse.json(
    { error, code: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : undefined, ...extra },
    { status, headers: { "Cache-Control": "no-store", ...headers } }
  );
}

function denyGuest(req: NextRequest, pathnameWithSearch: string) {
  if (isApiRoute(req)) {
    return jsonError(401, "Unauthorized");
  }
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect_url", pathnameWithSearch);
  return NextResponse.redirect(loginUrl);
}

function denyRole(req: NextRequest, pageRedirect: string) {
  if (isApiRoute(req)) {
    return jsonError(403, "Forbidden");
  }
  return NextResponse.redirect(new URL(pageRedirect, req.url));
}

async function fetchClerkUser(userId: string): Promise<ClerkUserForAuth | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!res.ok) return null;
    const json = (await res.json()) as ClerkUserApiResponse;

    const emailAddresses = Array.isArray(json.email_addresses) ? json.email_addresses : [];
    const primaryId = json.primary_email_address_id;
    const primary = primaryId
      ? emailAddresses.find((e) => e.id === primaryId)
      : undefined;

    const email = (primary?.email_address || emailAddresses[0]?.email_address || "") as string;

    return {
      email,
      publicMetadata: json.public_metadata ?? undefined,
      unsafeMetadata: json.unsafe_metadata ?? undefined,
    };
  } catch {
    return null;
  }
}

function enforcePublicRateLimits(req: NextRequest): NextResponse | null {
  const ip = clientIp(req);
  if (req.method === "POST" && isContactApi(req)) {
    const result = rateLimit(`contact:${ip}`, 5, 15 * 60 * 1000);
    if (!result.ok) {
      return jsonError(
        429,
        "Too many messages. Please wait a few minutes and try again.",
        undefined,
        rateLimitHeaders(result)
      );
    }
  }
  if (req.method === "POST" && isAuthThrottleApi(req)) {
    const result = rateLimit(`throttle:${ip}`, 40, 15 * 60 * 1000);
    if (!result.ok) {
      return jsonError(
        429,
        "Too many attempts. Please wait a few minutes and try again.",
        undefined,
        rateLimitHeaders(result)
      );
    }
  }
  return null;
}

export default clerkMiddleware(async (auth, req) => {
  const limited = enforcePublicRateLimits(req);
  if (limited) return limited;

  const { userId, sessionClaims } = await auth();
  const adminEmails = getAdminEmailsFromEnv();

  const claimEmail =
    (sessionClaims?.email as string | undefined) ||
    (sessionClaims?.primary_email as string | undefined) ||
    (sessionClaims?.primary_email_address as string | undefined) ||
    "";
  const claimPublicMetadata = (sessionClaims?.public_metadata as Record<string, unknown> | undefined) ?? undefined;
  const claimUnsafeMetadata = (sessionClaims?.unsafe_metadata as Record<string, unknown> | undefined) ?? undefined;

  let email = claimEmail;
  let publicMetadata = claimPublicMetadata;
  let unsafeMetadata = claimUnsafeMetadata;

  if (userId && (!email || isCreatorRoute(req) || isAdminRoute(req) || isAdminApiRoute(req) || isAuthPageRoute(req))) {
    const user = await fetchClerkUser(userId);
    if (user) {
      email = user.email;
      publicMetadata = user.publicMetadata;
      unsafeMetadata = user.unsafeMetadata;
    }
  }

  const isAdmin = email ? adminEmails.includes(email.toLowerCase()) : false;
  const role = getRoleFromMetadata(publicMetadata, unsafeMetadata);

  if (userId && isAuthPageRoute(req)) {
    return NextResponse.redirect(new URL(getRedirectByRole(isAdmin, role), req.url));
  }

  if (!isAdmin && !isMaintenanceAllowlist(req)) {
    const maintenanceOn = await isMaintenanceEnabled(req.url);
    if (maintenanceOn) {
      if (isApiRoute(req)) {
        return jsonError(
          503,
          "Advanced Subscription & Membership Platform is temporarily offline for maintenance.",
          { maintenance: true }
        );
      }
      return NextResponse.redirect(new URL("/maintenance", req.url));
    }
  }

  if (isPublicRoute(req)) return NextResponse.next();

  if (!userId) {
    if (isApiRoute(req) || isSessionPageRoute(req)) {
      return denyGuest(req, req.nextUrl.pathname + req.nextUrl.search);
    }
    return NextResponse.next();
  }

  if ((isAdminRoute(req) || isAdminApiRoute(req)) && !isAdmin) {
    return denyRole(req, role === "creator" ? "/creator" : "/library");
  }

  if ((isCreatorRoute(req) || isCreatorApiRoute(req)) && role !== "creator" && !isAdmin) {
    return denyRole(req, "/library");
  }

  if (isSubscriberWorkspaceRoute(req) && role === "creator" && !isAdmin) {
    return denyRole(req, "/creator");
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
