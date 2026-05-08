"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ContentForm } from "@/components/forms/ContentForm";
import { CreatorShell } from "@/components/dashboard/CreatorShell";
import type { ContentResponse } from "@/types/content";

export default function EditContentPage() {
  const params = useParams<{ contentId: string }>();
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const res = await fetch(`/api/content/${encodeURIComponent(params.contentId)}?scope=creator`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Content could not be loaded.");
        const data = (await res.json()) as { content: ContentResponse };
        if (!cancelled) setContent(data.content);
      } catch {
        if (!cancelled) setError("This content could not be loaded, or you do not own it.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (params.contentId) loadContent();
    return () => {
      cancelled = true;
    };
  }, [params.contentId]);

  if (isLoading) {
    return (
      <CreatorShell>
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 text-sm font-bold text-slate-500">
          Loading content...
        </div>
      </CreatorShell>
    );
  }

  if (error || !content) {
    return (
      <CreatorShell>
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8">
          <Link href="/creator/content" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-teal-600 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Content
          </Link>
          <p className="text-sm font-bold text-red-600">{error || "Content not found."}</p>
        </div>
      </CreatorShell>
    );
  }

  return <ContentForm mode="edit" initialContent={content} />;
}
