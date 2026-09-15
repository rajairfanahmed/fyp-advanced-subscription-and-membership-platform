"use client";

import React from "react";
import { useAuth } from "@clerk/nextjs";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LockKeyhole, ArrowRight, CheckCircle2, ChevronLeft, Zap } from "lucide-react";
import Link from "next/link";
import { loginHref } from "@/lib/auth/post-login-redirect";

export default function LockedContentPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const libraryHref = isLoaded && isSignedIn ? "/library" : loginHref("/library");
  const creatorsHref = "/creators";

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
      
      <Container className="max-w-4xl">
        {/* Back Button */}
        <MotionReveal className="mb-12">
          <Link href={isLoaded && isSignedIn ? "/library" : "/creators"} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[var(--color-ink)] transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </MotionReveal>

        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-8 md:p-16 relative overflow-hidden text-center">
          
          {/* Decorative Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-sky-400/5 blur-[80px] pointer-events-none" />

          <MotionReveal staggerChildren={0.1}>
            {/* Lock Icon */}
            <MotionItem className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-8 shadow-sm">
              <LockKeyhole className="w-10 h-10 text-slate-400" />
            </MotionItem>

            <MotionItem>
              <h1 className="text-3xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-6 tracking-tight">
                This Content Requires A <span className="text-gradient-primary">Higher Plan</span>
              </h1>
            </MotionItem>

            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] font-medium max-w-2xl mx-auto mb-12 leading-relaxed">
                Upgrade on that creator&apos;s profile. Follow free only unlocks Free content. Subscribe to Basic or Premium to unlock their paid videos, articles, and files.
              </p>
            </MotionItem>

            {/* Plan Comparison Cards */}
            <MotionItem className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
              
              {/* Current Plan */}
              <div className="w-full sm:w-64 bg-slate-50 rounded-2xl border border-slate-100 p-6 flex flex-col items-center">
                <span className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-widest">Current access</span>
                <Badge variant="emerald" className="mb-3">This creator</Badge>
                <span className="text-slate-600 font-medium">Free or a lower tier</span>
              </div>

              {/* Arrow Indicator */}
              <div className="shrink-0 w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center -my-2 sm:my-0 sm:-mx-2 z-10 text-slate-400">
                <ArrowRight className="w-5 h-5 hidden sm:block" />
                <ArrowRight className="w-5 h-5 block sm:hidden rotate-90" />
              </div>

              {/* Required Plan */}
              <div className="w-full sm:w-64 bg-[var(--color-ink)] rounded-2xl border border-slate-800 p-6 flex flex-col items-center relative overflow-hidden shadow-lg shadow-slate-900/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/20 blur-2xl" />
                <span className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest relative z-10">Needed</span>
                <Badge variant="sky" className="mb-3 relative z-10">Basic or Premium</Badge>
                <span className="text-white font-medium relative z-10 flex items-center gap-1">
                  <Zap className="w-4 h-4 text-amber-400" /> Subscribe on their profile
                </span>
              </div>

            </MotionItem>

            {/* What Unlocks */}
            <MotionItem className="max-w-md mx-auto text-left bg-slate-50 rounded-2xl border border-slate-100 p-8 mb-12">
              <h3 className="font-bold text-[var(--color-ink)] mb-4 text-center">What a paid plan unlocks</h3>
              <ul className="space-y-3">
                {[
                  "That creator's Basic and Premium videos and articles",
                  "PDF, ZIP, and other file downloads in the paid tier",
                  "Access for the rest of the billing period if you cancel later",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-slate-600 font-medium text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </MotionItem>

            {/* CTAs */}
            <MotionItem className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button variant="primary" size="lg" href={creatorsHref} className="w-full sm:w-auto min-w-[200px]">
                Browse Creators
              </Button>
              <Button variant="secondary" size="lg" href={libraryHref} className="w-full sm:w-auto min-w-[200px]">
                {isLoaded && isSignedIn ? "Back To Library" : "Sign in to Library"}
              </Button>
            </MotionItem>

          </MotionReveal>
        </div>
      </Container>
    </div>
  );
}
