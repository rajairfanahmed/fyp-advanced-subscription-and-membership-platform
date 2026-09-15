/** Survives OAuth round-trip (Clerk drops query string on /sso-callback). */
export const POST_AUTH_RETURN_KEY = "platform_post_auth_return";

const AUTH_PAGE_PREFIXES = [
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/sso-callback",
];

function decodeOnce(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/**
 * Only same-origin relative paths. Rejects protocol-relative URLs, backslashes,
 * control characters, API endpoints, and auth pages (which would loop).
 */
export function isSafeInternalPath(raw: string): boolean {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return false;
  const decoded = decodeOnce(raw);
  if (decoded == null) return false;
  if (decoded !== raw && decodeOnce(decoded) !== decoded) return false;
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return false;
  if (decoded.includes("\\") || decoded.includes("://") || decoded.includes(":")) return false;
  if (/[\u0000-\u001F\u007F]/.test(decoded)) return false;

  const pathOnly = decoded.split("?")[0]?.split("#")[0] ?? "";
  if (pathOnly.startsWith("/api/")) return false;
  if (AUTH_PAGE_PREFIXES.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`))) {
    return false;
  }
  return true;
}

export function loginHref(returnPath?: string): string {
  if (!returnPath || !isSafeInternalPath(returnPath)) return "/login";
  return `/login?redirect_url=${encodeURIComponent(returnPath)}`;
}

/**
 * Call when landing on /login (or /sign-up) with `redirect` / `redirect_url`.
 */
export function rememberReturnPathFromSearchParams(searchParams: {
  get(name: string): string | null;
}): void {
  if (typeof window === "undefined") return;
  const raw = searchParams.get("redirect_url") ?? searchParams.get("redirect");
  if (raw && isSafeInternalPath(raw)) {
    sessionStorage.setItem(POST_AUTH_RETURN_KEY, raw);
  }
}

/**
 * Prefer stored return path; fall back to role-based API path.
 */
export function consumeReturnPath(roleBasedFallback: string): string {
  if (typeof window === "undefined") return roleBasedFallback;
  const raw = sessionStorage.getItem(POST_AUTH_RETURN_KEY);
  sessionStorage.removeItem(POST_AUTH_RETURN_KEY);
  if (raw && isSafeInternalPath(raw)) {
    return raw;
  }
  return roleBasedFallback;
}
