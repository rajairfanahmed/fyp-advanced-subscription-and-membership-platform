import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { connectToMongoDB } from "@/lib/mongodb/connect";
import { UserProfileModel } from "@/lib/mongodb/models";
import {
  deleteCreatorAccount,
  deleteSubscriberAccount,
} from "@/lib/account/delete";

/**
 * `DELETE /api/account` — irreversible cascade delete for the current
 * user. We auto-detect the role from the persisted `UserProfile` row
 * so creators get the full creator-cascade (subs cancelled, plans
 * archived in Stripe, content + R2 assets removed) and subscribers
 * get the lighter subscriber-cascade.
 *
 * The Clerk user is deleted last so the same email can sign back up
 * immediately if the user changes their mind.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Confirmation guard: the client must pass `?confirm=DELETE` so a
  // stray DELETE request can never wipe an account by accident.
  const confirm = req.nextUrl.searchParams.get("confirm");
  if (confirm !== "DELETE") {
    return NextResponse.json(
      {
        error:
          "Account deletion requires explicit confirmation. Pass ?confirm=DELETE on the request URL.",
      },
      { status: 400 }
    );
  }

  await connectToMongoDB();
  const profile = await UserProfileModel.findOne(
    { clerkUserId: userId },
    { role: 1 }
  ).lean();

  try {
    const report =
      profile?.role === "creator"
        ? await deleteCreatorAccount(userId)
        : await deleteSubscriberAccount(userId);

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error("[account:delete] cascade failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Account deletion failed. Please try again or contact support.",
      },
      { status: 500 }
    );
  }
}
