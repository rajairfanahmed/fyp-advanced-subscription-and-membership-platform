import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { connectToMongoDB } from "@/lib/mongodb/connect";
import { SubscriptionModel } from "@/lib/mongodb/models";
import { getPublishedContentByCreatorSlug } from "@/lib/mongodb/public-data";
import type { PlanAccessLevel } from "@/types/plan";
import type { SubscriptionStatus } from "@/types/subscription";

type ViewerSubscription = {
  id: string;
  accessLevel: PlanAccessLevel;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ creatorSlug: string }> }
) {
  try {
    const { creatorSlug } = await params;
    const data = await getPublishedContentByCreatorSlug(creatorSlug);
    if (!data.creator) {
      return NextResponse.json(
        { creator: null, content: [], plans: [], viewer: null },
        { status: 404 }
      );
    }

    let viewer: ViewerSubscription | null = null;
    const { userId } = await auth();
    if (userId && data.creator.clerkUserId) {
      await connectToMongoDB();
      const sub = await SubscriptionModel.findOne({
        subscriberClerkUserId: userId,
        creatorClerkUserId: data.creator.clerkUserId,
      })
        .sort({ updatedAt: -1 })
        .lean();
      if (sub) {
        viewer = {
          id: sub._id.toString(),
          accessLevel: sub.accessLevel as PlanAccessLevel,
          status: sub.status as SubscriptionStatus,
          cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
          currentPeriodEnd: sub.currentPeriodEnd
            ? new Date(sub.currentPeriodEnd).toISOString()
            : null,
        };
      }
    }

    return NextResponse.json({ ...data, viewer });
  } catch (error) {
    console.error("[public:creator]", error);
    return NextResponse.json(
      { creator: null, content: [], plans: [], viewer: null },
      { status: 500 }
    );
  }
}
