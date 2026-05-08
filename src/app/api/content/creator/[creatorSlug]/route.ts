import { NextResponse } from "next/server";

import { listPublishedContentByCreatorSlug } from "@/lib/mongodb/content";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ creatorSlug: string }> }
) {
  try {
    const { creatorSlug } = await params;
    const content = await listPublishedContentByCreatorSlug(creatorSlug);
    return NextResponse.json({ content });
  } catch (error) {
    console.error("[content:creator:get]", error);
    return NextResponse.json({ error: "Unable to load creator content." }, { status: 500 });
  }
}
