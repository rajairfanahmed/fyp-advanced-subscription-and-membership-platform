/** Survives OAuth round-trip (Clerk drops query string on /sso-callback). */
export const POST_AUTH_RETURN_KEY = "platform_post_auth_return";

function isSafeInternalPath(raw: string): boolean {
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  if (raw.includes(":")) return false;
  return true;
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
