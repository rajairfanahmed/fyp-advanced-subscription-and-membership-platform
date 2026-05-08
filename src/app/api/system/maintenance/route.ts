import { NextResponse } from "next/server";

import { loadPlatformSettings } from "@/lib/mongodb/admin-settings";

/**
 * Public endpoint exposing only the `maintenanceMode` flag from the
 * singleton `PlatformSettings`. The middleware fetches this on each
 * request (cached for 30 seconds via Next's data cache) so it can
 * decide whether to drop non-admin traffic to /maintenance.
 *
 * This endpoint is intentionally tiny and **must stay public** — it
 * runs before auth in `src/middleware.ts`.
 */
export async function GET() {
  try {
    const settings = await loadPlatformSettings();
    return NextResponse.json(
      { enabled: Boolean(settings.maintenanceMode) },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[system:maintenance]", error);
    // Fail-open so a DB outage doesn't lock everyone out of the app.
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
}
