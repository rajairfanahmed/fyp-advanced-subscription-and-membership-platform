import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { requireAdminContext } from "@/lib/auth/require-admin";
import {
  loadPlatformSettings,
  updatePlatformSettings,
} from "@/lib/mongodb/admin-settings";
import type { AdminPlatformSettingsInput } from "@/types/admin-stats";

export async function GET() {
  try {
    await requireAdminContext();
    const data = await loadPlatformSettings();
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load settings.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:settings GET]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminContext();
    const body = (await request.json().catch(() => ({}))) as AdminPlatformSettingsInput;
    const data = await updatePlatformSettings(body);
    if (typeof body?.maintenanceMode === "boolean") {
      // Drop the middleware's cached maintenance flag so the new
      // value applies on the next request without waiting 30s.
      try {
        revalidateTag("platform-maintenance");
      } catch (error) {
        console.warn("[admin:settings:revalidate]", error);
      }
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update settings.";
    const status =
      message === "Not signed in."
        ? 401
        : message === "Admin access required."
          ? 403
          : 400;
    console.error("[admin:settings PATCH]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
