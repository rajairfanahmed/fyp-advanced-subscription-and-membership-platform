import { NextResponse } from "next/server";

import { recordWatchCompletionEvent } from "@/lib/mongodb/content";

/**
 * POST /api/content/[contentId]/event
 * Body: { type: "watch_completion"; percent: number }
 *
 * Public endpoint that ingests video engagement events. We currently
 * only record `watch_completion` for averaging, but the `type`
 * discriminator leaves room for "play_started", "milestone_reached",
 * etc. without a route rename.
 *
 * The endpoint is open so that the player can fire the event for both
 * signed-in and anonymous viewers; `percent` is clamped server-side.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const type = String((body as { type?: unknown }).type ?? "").trim();
  const rawPercent = Number((body as { percent?: unknown }).percent);

  if (type !== "watch_completion") {
    return NextResponse.json(
      { error: "Unsupported event type." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(rawPercent)) {
    return NextResponse.json(
      { error: "`percent` must be a number." },
      { status: 400 }
    );
  }

  try {
    const { contentId } = await params;
    const result = await recordWatchCompletionEvent({
      contentId,
      percent: rawPercent,
    });
    if (!result) {
      return NextResponse.json({ error: "Content not found." }, { status: 404 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[content:event]", error);
    return NextResponse.json(
      { error: "Unable to record event." },
      { status: 500 }
    );
  }
}
