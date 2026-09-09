import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Advanced Subscription & Membership Platform Clerk Middleware — Next.js 15 + Clerk v7
 *
 * Route protection:
 * - Public routes: accessible without auth
 * - Subscriber routes: require signed-in user
 * - Creator routes: require signed-in user with creator role or admin email
 * - Admin routes: require signed-in user with admin email
 */

// ── Route matchers ──
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
  "/api/auth/(.*)",
  "/api/system/(.*)",
  /** Unauthenticated marketing + integrations (must bypass Clerk redirect). */
  "/api/public/(.*)",
  "/api/contact",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  // Creator directory + individual creator profiles are public so
  // signed-out viewers can browse before deciding to sign up. Both
  // `/creators` (the index) and `/creators/<slug>` need to be listed
  // — the wildcard alone doesn't match the parent path.
  "/creators",
  "/creators/(.*)",
  "/locked-content",
]);
const isAuthPageRoute = createRouteMatcher(["/login(.*)", "/sign-up(.*)"]);
const isCreatorRoute = createRouteMatcher(["/creator", "/creator/(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin", "/admin/(.*)"]);
const isSubscriberWorkspaceRoute = createRouteMatcher([
  "/library",
  "/library/(.*)",
  "/subscription",
  "/billing",
]);
const isApiRoute = createRouteMatcher(["/api/(.*)"]);
/**
 * Routes the user must still be allowed to hit while maintenance is on,
 * so admins can disable the flag and so visitors can hit /maintenance
 * itself + Clerk's auth flow.
 */
const isMaintenanceAllowlist = createRouteMatcher([
  "/maintenance",
  "/admin",
  "/admin/(.*)",
  "/api/admin/(.*)",
  "/api/auth/(.*)",
  "/api/system/(.*)",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  "/login(.*)",
  "/sign-up(.*)",
  "/sso-callback",
]);

/**
 * Fetch the live maintenance flag from `/api/system/maintenance`. The
 * response is cached on the Next data layer for 30s so we don't hit
 * MongoDB on every request. Failures fail-open (no maintenance) so a
 * DB hiccup never locks people out of the app.
 */
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

/**
 * Parse ADMIN_EMAILS inside middleware (can't import from lib in edge runtime
 * because edge runtime has access to process.env but not Node modules).
 */
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

export default clerkMiddleware(async (auth, req) => {
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

  if (userId && (!email || isCreatorRoute(req) || isAdminRoute(req) || isAuthPageRoute(req))) {
    const user = await fetchClerkUser(userId);
    if (user) {
      email = user.email;
      publicMetadata = user.publicMetadata;
      unsafeMetadata = user.unsafeMetadata;
    }
  }

  const isAdmin = email ? adminEmails.includes(email.toLowerCase()) : false;
  const role = getRoleFromMetadata(publicMetadata, unsafeMetadata);

  // Signed-in users should not stay on login/sign-up pages.
  if (userId && isAuthPageRoute(req)) {
    return NextResponse.redirect(new URL(getRedirectByRole(isAdmin, role), req.url));
  }

  // ── Maintenance mode ──
  // Admins always retain access so they can flip the flag back off.
  // Non-admin pages get redirected to /maintenance, non-admin API
  // calls get a 503 with a structured body so the client can surface
  // a friendly retry banner.
  if (!isAdmin && !isMaintenanceAllowlist(req)) {
    const maintenanceOn = await isMaintenanceEnabled(req.url);
    if (maintenanceOn) {
      if (isApiRoute(req)) {
        return NextResponse.json(
          {
            error: "Advanced Subscription & Membership Platform is temporarily offline for maintenance.",
            maintenance: true,
          },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }
      const url = new URL("/maintenance", req.url);
      return NextResponse.redirect(url);
    }
  }

  // Public routes stay public for signed-out and signed-in users.
  if (isPublicRoute(req)) return NextResponse.next();

  // All non-public routes require authentication.
  if (!userId) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes: require admin email
  if (isAdminRoute(req)) {
    if (!isAdmin) {
      // Non-admin users get redirected based on their role
      const redirectUrl = role === "creator" ? "/creator" : "/library";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
  }

  // Creator routes: require creator role or admin email
  if (isCreatorRoute(req)) {
    if (role !== "creator" && !isAdmin) {
      return NextResponse.redirect(new URL("/library", req.url));
    }
  }

  // Subscriber membership surfaces are for subscribers (and admins
  // previewing). Creators must not land on library / subscription / billing UI.
  if (isSubscriberWorkspaceRoute(req) && role === "creator" && !isAdmin) {
    return NextResponse.redirect(new URL("/creator", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
