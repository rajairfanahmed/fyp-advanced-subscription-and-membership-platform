import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  archiveCreatorContent,
  deleteCreatorContent,
  getContentForCurrentCreator,
  getGuardedPublishedContent,
  parseContentSavePayload,
  unarchiveCreatorContent,
  updateCreatorContent,
} from "@/lib/mongodb/content";

/**
 * Same JSON contract as POST /api/content. Files are uploaded
 * directly to R2 first (see `POST /api/storage/upload`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const scope = req.nextUrl.searchParams.get("scope");

    if (scope === "creator") {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const content = await getContentForCurrentCreator(contentId);
      if (!content) return NextResponse.json({ error: "Content not found." }, { status: 404 });
      return NextResponse.json({ content });
    }

    const content = await getGuardedPublishedContent(contentId);
    if (!content) return NextResponse.json({ error: "Content not found." }, { status: 404 });
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load content.";
    if (
      message === "Only creator accounts can manage creator content." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[content:item:get]", error);
    return NextResponse.json({ error: "Unable to load content." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch (error) {
    console.error("[content:item:patch:json]", error);
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON." },
      { status: 400 }
    );
  }

  try {
    const { contentId } = await params;
    const payload = parseContentSavePayload(raw);
    const content = await updateCreatorContent(contentId, payload);
    if (!content) return NextResponse.json({ error: "Content not found." }, { status: 404 });
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update content.";
    if (
      message === "Only creator accounts can manage creator content." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[content:item:patch]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * Mode-dispatch DELETE:
 *
 *   - `?mode=archive`  (default, preserves history) → status -> "archived"
 *   - `?mode=unarchive`                              → status -> "draft"
 *   - `?mode=hard` (or `?hard=true`, destructive)    → row + R2 assets removed
 *
 * The mode is in the query string (not the body) because some HTTP
 * clients refuse to send DELETE bodies; this keeps the surface flat
 * and curl-friendly.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { contentId } = await params;
    const url = req.nextUrl;
    const modeRaw = (url.searchParams.get("mode") || "").toLowerCase();
    const isHard =
      modeRaw === "hard" ||
      url.searchParams.get("hard") === "true" ||
      url.searchParams.get("hard") === "1";
    const isUnarchive = modeRaw === "unarchive";

    if (isHard) {
      const result = await deleteCreatorContent(contentId);
      if (!result) {
        return NextResponse.json(
          { error: "Content not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ deleted: true, id: result.id });
    }

    if (isUnarchive) {
      const content = await unarchiveCreatorContent(contentId);
      if (!content) {
        return NextResponse.json(
          { error: "Content not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ content });
    }

    const content = await archiveCreatorContent(contentId);
    if (!content) return NextResponse.json({ error: "Content not found." }, { status: 404 });
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete content.";
    if (
      message === "Only creator accounts can manage creator content." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[content:item:delete]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
