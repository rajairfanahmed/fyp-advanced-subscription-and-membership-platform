import { NextResponse } from "next/server";

import { getCreatorProfileBySlug } from "@/lib/auth/profile-sync";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const profile = await getCreatorProfileBySlug(slug);

    if (!profile) {
      return NextResponse.json({ profile: null }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[creator-profile:public:get]", error);
    return NextResponse.json({ error: "Unable to load creator profile." }, { status: 500 });
  }
}
