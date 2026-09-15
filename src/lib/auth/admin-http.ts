import { NextResponse } from "next/server";

import { adminApiError } from "@/lib/auth/require-admin";

export function adminErrorJson(error: unknown, fallback: string) {
  const { message, status, headers } = adminApiError(error, fallback);
  return NextResponse.json({ error: message }, { status, headers });
}
