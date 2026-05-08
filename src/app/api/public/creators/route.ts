import { NextResponse } from "next/server";
import { getPublishedCreators } from "@/lib/mongodb/public-data";

export async function GET() {
  try {
    const creators = await getPublishedCreators();
    return NextResponse.json({ creators });
  } catch (error) {
    console.error("[public:creators]", error);
    return NextResponse.json({ creators: [] }, { status: 200 });
  }
}
