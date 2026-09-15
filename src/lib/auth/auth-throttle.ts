export type AuthThrottleAction = "login" | "register" | "forgot-password";

const GENERIC_LIMIT_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

/**
 * Ask the platform to count this auth attempt against the guest IP.
 * Fails open if the throttle endpoint is unreachable so Clerk outages on
 * our side cannot lock legitimate users out of sign-in.
 */
export async function assertAuthThrottle(
  action: AuthThrottleAction
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/auth/throttle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.status === 429) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: data.error || GENERIC_LIMIT_MESSAGE };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
