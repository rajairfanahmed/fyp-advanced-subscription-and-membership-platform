import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { listCurrentUserPayments } from "@/lib/mongodb/payments";

/**
 * GET /api/payments/me
 * Returns the current subscriber's payment history (newest first).
 * Empty until the Stripe webhook layer starts writing receipts.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const payments = await listCurrentUserPayments();
    return NextResponse.json(
      { payments },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[payments:list-mine]", error);
    return NextResponse.json(
      { error: "Failed to load payment history." },
      { status: 500 }
    );
  }
}
