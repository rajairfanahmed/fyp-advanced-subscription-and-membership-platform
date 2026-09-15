"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MotionItem, MotionReveal } from "@/components/ui/MotionReveal";
import {
  fetchWithTimeout,
  readJsonSafe,
  RequestTimeoutError,
} from "@/lib/http/fetch-timeout";
import type { PublicCreator } from "@/lib/mongodb/public-data";
import { Eye, FileText, Sparkles, Users } from "lucide-react";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CreatorsPage() {
  const [creators, setCreators] = useState<PublicCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadNonce, setLoadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCreators() {
      setLoadError("");
      setIsLoading(true);
      try {
        const res = await fetchWithTimeout("/api/public/creators", {
          cache: "no-store",
          timeoutMs: 15_000,
        });
        const data = await readJsonSafe<{ creators?: PublicCreator[] }>(res);
        if (!res.ok) {
          throw new Error("Couldn’t load creators.");
        }
        if (!cancelled) setCreators(data.creators ?? []);
      } catch (error) {
        if (!cancelled) {
          setCreators([]);
          setLoadError(
            error instanceof RequestTimeoutError
              ? error.message
              : "Couldn’t load creators. Check your connection and try again."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadCreators();
    return () => {
      cancelled = true;
    };
  }, [loadNonce]);

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
      <Container>
        <MotionReveal staggerChildren={0.1}>
          <MotionItem className="mb-4">
            <Badge variant="emerald">Creators</Badge>
          </MotionItem>
          <MotionItem>
            <h1 className="text-4xl md:text-5xl font-black font-display tracking-tight text-[var(--color-ink)] mb-4">
              Browse Creators
            </h1>
          </MotionItem>
          <MotionItem>
            <p className="text-lg text-slate-600 font-medium max-w-2xl">
              Find published creator profiles and explore videos, articles, PDFs, ZIP files, and RAR downloads.
            </p>
          </MotionItem>
        </MotionReveal>

        {isLoading ? (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"
              >
                <div className="h-24 bg-slate-100" />
                <div className="p-6 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100" />
                  <div className="h-5 w-2/3 bg-slate-100 rounded-lg" />
                  <div className="h-4 w-full bg-slate-50 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="mt-10 bg-white rounded-[2rem] border border-slate-200 p-10 md:p-14 text-center max-w-xl mx-auto">
            <h2 className="text-xl font-black font-display text-slate-900 mb-2">
              Couldn’t load creators
            </h2>
            <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed">
              {loadError}
            </p>
            <Button type="button" variant="primary" onClick={() => setLoadNonce((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : creators.length === 0 ? (
          <div className="mt-10 bg-white rounded-[2rem] border border-slate-200 p-10 md:p-14 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-black font-display text-slate-900 mb-2">
              No published creators yet
            </h2>
            <p className="text-sm font-medium text-slate-600 mb-8 leading-relaxed">
              Published creator studios will appear here. If you create, publish your profile from Creator Settings.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" href="/sign-up">
                Become a creator
              </Button>
              <Button variant="secondary" href="/">
                Back home
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((creator) => (
              <Link
                key={creator.slug}
                href={`/creators/${creator.slug}`}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-teal-300 hover:shadow-lg transition-all"
              >
                <div className="h-24 bg-gradient-to-r from-emerald-50 to-sky-50 relative overflow-hidden">
                  {creator.bannerUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={creator.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </div>
                <div className="px-6 pt-5 pb-6">
                  {/* Avatar sits below the banner instead of overlapping
                      it. With a white card background it stays cleanly
                      separated from the banner image — no more visual
                      "mixing" with whatever the creator uploaded. */}
                  <div className="mb-4 w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center text-teal-700 font-black text-lg">
                    {creator.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={creator.avatarUrl} alt={creator.name} className="w-full h-full object-cover" />
                    ) : (
                      initials(creator.name)
                    )}
                  </div>
                  <h2 className="text-xl font-black font-display text-slate-950 mb-2">{creator.name}</h2>
                  <p className="text-sm font-medium text-slate-600 line-clamp-3 min-h-[3.75rem]">
                    {creator.bio || "This creator hasn’t added a bio yet."}
                  </p>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <Users className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                      <p className="text-sm font-black text-slate-900">{creator.subscriberCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <FileText className="w-4 h-4 text-sky-600 mx-auto mb-1" />
                      <p className="text-sm font-black text-slate-900">{creator.contentCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <Eye className="w-4 h-4 text-violet-600 mx-auto mb-1" />
                      <p className="text-sm font-black text-slate-900">{creator.totalViews}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
