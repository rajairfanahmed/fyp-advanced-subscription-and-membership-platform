import { NextResponse } from "next/server";
import { getPublishedContent } from "@/lib/mongodb/public-data";

export async function GET() {
  try {
    const content = await getPublishedContent(80);
    return NextResponse.json({ content });
  } catch (error) {
    console.error("[public:content]", error);
    return NextResponse.json({ content: [] }, { status: 200 });
  }
}
