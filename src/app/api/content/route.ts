import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  createCreatorContent,
  listCurrentCreatorContent,
  listPublishedContent,
  parseContentSavePayload,
} from "@/lib/mongodb/content";

/**
 * Content metadata save. Files (video, downloadable, thumbnail) are
 * uploaded directly to R2 via `POST /api/storage/upload` first, and
 * this endpoint receives a small JSON body with the resulting object
 * keys + URLs. We never parse multipart here, which is what was
 * causing "Could not parse the upload" on large videos.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");

  try {
    if (scope === "creator") {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const content = await listCurrentCreatorContent();
      return NextResponse.json({ content });
    }

    const { userId } = await auth();
    const content = await listPublishedContent({ viewerClerkUserId: userId ?? undefined });
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load content.";
    if (
      message === "Only creator accounts can manage creator content." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[content:get]", error);
    return NextResponse.json({ error: "Unable to load content." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch (error) {
    console.error("[content:post:json]", error);
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON." },
      { status: 400 }
    );
  }

  try {
    const payload = parseContentSavePayload(raw);
    const content = await createCreatorContent(payload);
    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create content.";
    if (
      message === "Only creator accounts can manage creator content." ||
      message === "This account is suspended."
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[content:post]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
