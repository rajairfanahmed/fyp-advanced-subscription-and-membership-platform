export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron] CRON_SECRET is not set — refusing the request.");
    return false;
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ") && auth.slice(7).trim() === expected) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    const url = new URL(request.url);
    return url.searchParams.get("secret") === expected;
  }

  return false;
}
