import { NextResponse } from "next/server";

import { recordContentView } from "@/lib/mongodb/content";

/**
 * POST /api/content/[contentId]/view
 *
 * Public endpoint. Bumps `Content.viewsCount` and the owning creator's
 * `CreatorProfile.totalViews`. Anyone hitting a published content page
 * counts; signed-in vs anonymous is intentionally not tracked here.
 *
 * Throttling is left to the caller — the library detail page only
 * fires this once per mount so a quick refresh doesn't spam.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const result = await recordContentView(contentId);
    if (!result) {
      return NextResponse.json({ error: "Content not found." }, { status: 404 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[content:view]", error);
    return NextResponse.json(
      { error: "Unable to record view." },
      { status: 500 }
    );
  }
}
