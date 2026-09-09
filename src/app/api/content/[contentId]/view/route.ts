import { NextResponse } from "next/server";

import {
  getGuardedPublishedContent,
  recordContentView,
} from "@/lib/mongodb/content";

/**
 * POST /api/content/[contentId]/view
 *
 * Bumps `Content.viewsCount` and the owning creator's
 * `CreatorProfile.totalViews` only when the viewer is allowed to
 * see the item (free content, or a matching paid membership). Locked
 * paywall hits do not inflate analytics.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const guarded = await getGuardedPublishedContent(contentId);
    if (!guarded) {
      return NextResponse.json({ error: "Content not found." }, { status: 404 });
    }
    if (!guarded.accessGranted) {
      return NextResponse.json(
        { ok: true, viewsCount: guarded.viewsCount, counted: false },
        { status: 200 }
      );
    }

    const result = await recordContentView(contentId);
    if (!result) {
      return NextResponse.json({ error: "Content not found." }, { status: 404 });
    }
    return NextResponse.json({ ...result, counted: true }, { status: 200 });
  } catch (error) {
    console.error("[content:view]", error);
    return NextResponse.json(
      { error: "Unable to record view." },
      { status: 500 }
    );
  }
}
