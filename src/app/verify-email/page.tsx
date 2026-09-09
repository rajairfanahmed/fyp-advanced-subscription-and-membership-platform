"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignUp } from "@clerk/nextjs/legacy";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { MailCheck, ArrowRight, RefreshCcw, Loader2, ChevronLeft } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { isLoaded, signUp } = useSignUp();
  const { isSignedIn } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // If already signed in, redirect based on role/admin.
  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/redirect", { cache: "no-store" });
        const data = (await res.json()) as { redirect?: string };
        if (!cancelled) router.replace(data.redirect || "/library");
      } catch {
        if (!cancelled) router.replace("/library");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, router]);

  if (isSignedIn) {
    return null;
  }

  // If there's no active signup attempt, show a fallback state
  const hasActiveSignUp = Boolean(isLoaded && signUp && signUp.status);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    if (!code.trim() || code.length < 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        // Do NOT call setActive — user must log in explicitly after verification.
        // Redirect to /login with success indicator.
        sessionStorage.removeItem("platform_signup_role");
        window.location.href = "/login?verified=true";
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(
        clerkError.errors?.[0]?.message ||
        "The verification code is invalid or expired."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (!isLoaded || !signUp) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    setError("");
    setIsResending(true);
    setResendSuccess(false);

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(
        clerkError.errors?.[0]?.message ||
        "We could not resend the code. Please try again."
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)] relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-sky-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />

      <Container className="max-w-xl">
        <MotionReveal instant className="flex flex-col items-center text-center">

          <MotionItem className="w-full">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-emerald-400" />

              <div className="w-20 h-20 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto mb-8 shadow-sm">
                <MailCheck className="w-10 h-10 text-sky-500" />
              </div>

              <h1 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)] mb-4 tracking-tight">
                Verify Your Email
              </h1>

              {!hasActiveSignUp ? (
                /* ── No active signup: fallback state ── */
                <div>
                  <p className="text-base md:text-lg text-[var(--color-muted)] font-medium leading-relaxed mb-8">
                    Please return to sign up and request a new verification code.
                  </p>
                  <Button variant="primary" size="lg" className="w-full" href="/sign-up" icon={<ArrowRight className="w-4 h-4 ml-1" />}>
                    Back To Sign Up
                  </Button>
                </div>
              ) : (
                /* ── Active signup: show verification form ── */
                <div>
                  <p className="text-base md:text-lg text-[var(--color-muted)] font-medium leading-relaxed mb-8">
                    Enter the 6-digit code we sent to your email address.
                  </p>

                  {/* Error */}
                  {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700 text-left">
                      {error}
                    </div>
                  )}

                  {/* Resend Success */}
                  {resendSuccess && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700">
                      A new code has been sent to your email!
                    </div>
                  )}

                  <form onSubmit={handleVerify} className="space-y-6">
                    <input
                      type="text"
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-bold text-[var(--color-ink)] text-center text-3xl tracking-[0.4em]"
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting}
                      icon={isSubmitting ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <ArrowRight className="w-4 h-4 ml-1" />}
                    >
                      {isSubmitting ? "Verifying..." : "Verify Email"}
                    </Button>
                  </form>

                  <div className="flex flex-col gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={isResending}
                      className="inline-flex items-center justify-center gap-2 text-sm font-bold text-sky-600 hover:text-sky-700 transition-colors disabled:opacity-50"
                    >
                      {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                      {isResending ? "Sending..." : "Resend Code"}
                    </button>

                    <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-[var(--color-ink)] transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                      Back To Sign Up
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </MotionItem>

        </MotionReveal>
      </Container>
    </div>
  );
}
