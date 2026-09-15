import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * Global 404. Renders as `children` of `src/app/layout.tsx`, so MainNav
 * and Footer stay in place. Do not wrap this page with those components.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
      <Container className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-2xl bg-white rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-8 md:p-16 relative overflow-hidden text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-emerald-400/5 blur-[80px] pointer-events-none" />

          <MotionReveal instant staggerChildren={0.08}>
            <MotionItem>
              <p
                aria-hidden="true"
                className="font-display font-black text-7xl md:text-8xl leading-none tracking-tight text-slate-100 select-none mb-6"
              >
                404
              </p>
            </MotionItem>

            <MotionItem className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-8 shadow-sm -mt-2">
              <Search className="w-10 h-10 text-slate-400" aria-hidden="true" />
            </MotionItem>

            <MotionItem>
              <Badge variant="default" className="mb-5">
                Page not found
              </Badge>
            </MotionItem>

            <MotionItem>
              <h1 className="text-3xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-6 tracking-tight">
                This page does not exist
              </h1>
            </MotionItem>

            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] font-medium max-w-xl mx-auto mb-10 leading-relaxed">
                The link may be mistyped or the page may have moved. You can return home or keep browsing public creator profiles.
              </p>
            </MotionItem>

            <MotionItem className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-4">
              <Button
                variant="primary"
                size="lg"
                href="/"
                className="w-full sm:w-auto min-w-[200px]"
              >
                Back to home
              </Button>
              <Button
                variant="secondary"
                size="lg"
                href="/creators"
                className="w-full sm:w-auto min-w-[200px]"
              >
                Browse creators
              </Button>
            </MotionItem>

            <MotionItem>
              <p className="mt-8 text-sm font-medium text-slate-500">
                Need help?{" "}
                <Link
                  href="/support"
                  className="font-bold text-[var(--color-ink)] underline-offset-4 hover:underline"
                >
                  Visit support
                </Link>
              </p>
            </MotionItem>
          </MotionReveal>
        </div>
      </Container>
    </div>
  );
}
