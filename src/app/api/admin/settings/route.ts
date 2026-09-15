import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { adminErrorJson } from "@/lib/auth/admin-http";
import {
  assertConfirmationPhrase,
  auditAdmin,
  confirmationPhraseOf,
  requireAdminContext,
  requireAdminMutation,
} from "@/lib/auth/require-admin";
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
    console.error("[admin:settings GET]", error);
    return adminErrorJson(error, "Failed to load settings.");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireAdminMutation(request);
    const body = (await request.json().catch(() => ({}))) as AdminPlatformSettingsInput & {
      confirmationPhrase?: string;
    };
    if (body.maintenanceMode === true) {
      assertConfirmationPhrase(
        confirmationPhraseOf(body),
        "MAINTENANCE",
        "Type MAINTENANCE to enable maintenance mode."
      );
    }
    const data = await updatePlatformSettings(body);
    if (typeof body?.maintenanceMode === "boolean") {
      try {
        revalidateTag("platform-maintenance");
      } catch (error) {
        console.warn("[admin:settings:revalidate]", error);
      }
    }
    await auditAdmin(ctx, request, {
      action: "settings.update",
      targetType: "settings",
      payload: {
        keys: Object.keys(body).filter((key) => key !== "confirmationPhrase"),
        maintenanceMode: data.maintenanceMode,
        platformFeeBps: data.platformFeeBps,
      },
    });
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[admin:settings PATCH]", error);
    return adminErrorJson(error, "Failed to update settings.");
  }
}
