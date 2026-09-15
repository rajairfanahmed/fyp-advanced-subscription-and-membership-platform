"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Eye, UserPlus, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";

const STEPS = [
  {
    number: "01",
    icon: Eye,
    title: "Browse as a guest",
    description:
      "Open creator pages and public previews with no account. You can look around first and decide later.",
  },
  {
    number: "02",
    icon: UserPlus,
    title: "Create a free account",
    description:
      "Sign up to follow a creator, keep a library, and receive in-app notices. Free following does not require a paid plan.",
  },
  {
    number: "03",
    icon: Unlock,
    title: "Subscribe to unlock",
    description:
      "Pay for Basic or Premium on a specific creator. That membership opens gated videos, articles, and files for that creator only.",
  },
];

export function GuestHowItWorks() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded || isSignedIn) {
    return null;
  }

  return (
    <section
      aria-labelledby="guest-how-it-works-heading"
      className="py-16 md:py-24 lg:py-32 bg-white border-b border-[var(--color-border)]"
    >
      <Container>
        <MotionReveal className="max-w-3xl mb-14">
          <MotionItem>
            <Badge variant="emerald">For first-time visitors</Badge>
          </MotionItem>
          <MotionItem>
            <h2
              id="guest-how-it-works-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mt-6 mb-6 tracking-tight"
            >
              How the platform works
            </h2>
          </MotionItem>
          <MotionItem>
            <p className="text-base sm:text-xl text-[var(--color-muted)] leading-relaxed">
              You do not need an account to look around. Create one when you want
              to follow a creator, subscribe, or open paid content.
            </p>
          </MotionItem>
        </MotionReveal>

        <MotionReveal
          className="grid md:grid-cols-3 gap-6 lg:gap-8 relative"
          staggerChildren={0.1}
        >
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-[3.25rem] left-[16%] right-[16%] h-px bg-slate-200"
          />

          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <MotionItem key={step.number}>
                <article className="relative h-full p-6 sm:p-8 rounded-[2rem] bg-[var(--color-paper)] border border-slate-200 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center justify-between mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[var(--color-emerald)]" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-black font-display tracking-[0.2em] text-slate-400">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold font-display text-[var(--color-ink)] mb-3">
                    {step.title}
                  </h3>
                  <p className="text-base text-[var(--color-muted)] leading-relaxed">
                    {step.description}
                  </p>
                </article>
              </MotionItem>
            );
          })}
        </MotionReveal>

        <MotionReveal className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:flex-wrap">
          <Button variant="primary" size="lg" href="/sign-up">
            Create free account
          </Button>
          <Button variant="secondary" size="lg" href="/creators">
            Browse as guest
          </Button>
          <p className="text-sm font-medium text-slate-500 sm:ml-2">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-[var(--color-ink)] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </MotionReveal>
      </Container>
    </section>
  );
}
