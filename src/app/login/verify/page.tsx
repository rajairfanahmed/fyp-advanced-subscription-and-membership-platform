"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { MailCheck, ArrowRight, RefreshCcw, Loader2, ChevronLeft } from "lucide-react";
import { consumeReturnPath } from "@/lib/auth/post-login-redirect";
import { prepareSignInEmailCode } from "@/lib/auth/clerk-sign-in";

/**
 * Completes Clerk email-code verification after password sign-in
 * (needs_second_factor / extra device check). Signup still uses /verify-email.
 */
export default function LoginVerifyPage() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const status = signIn?.status ?? null;
  const hasActiveSignIn = Boolean(
    isLoaded &&
      signIn &&
      (status === "needs_second_factor" || status === "needs_first_factor")
  );

  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/redirect", {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json()) as { redirect?: string };
        if (!cancelled) router.replace(consumeReturnPath(data.redirect || "/library"));
      } catch {
        if (!cancelled) router.replace(consumeReturnPath("/library"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, router]);

  if (isSignedIn) {
    return null;
  }

  async function finishSession(sessionId: string | null | undefined) {
    if (!sessionId) {
      setError("Sign-in did not finish. Try logging in again.");
      return;
    }
    await setActive({ session: sessionId });
    const res = await fetch("/api/auth/redirect", {
      cache: "no-store",
      credentials: "include",
    });
    const data = (await res.json()) as { redirect?: string };
    router.push(consumeReturnPath(data.redirect || "/library"));
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) {
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
      const attempt =
        signIn.status === "needs_first_factor"
          ? await signIn.attemptFirstFactor({ strategy: "email_code", code })
          : await signIn.attemptSecondFactor({ strategy: "email_code", code });

      if (attempt.status === "complete") {
        await finishSession(attempt.createdSessionId);
        return;
      }
      setError("Verification incomplete. Please try the code again.");
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message?: string }[] };
      setError(
        clerkError.errors?.[0]?.message ||
          "The verification code is invalid or expired."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (!isLoaded || !signIn) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    setError("");
    setIsResending(true);
    setResendSuccess(false);

    try {
      const sent = await prepareSignInEmailCode(signIn);
      if (!sent) {
        setError(
          "We could not send a code for this sign-in. Go back to log in and try again."
        );
        return;
      }
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message?: string }[] };
      setError(
        clerkError.errors?.[0]?.message ||
          "We could not send the email. Check spam, and in Clerk add your Vercel domain under allowed redirect origins."
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)] relative overflow-hidden">
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
                Check your email
              </h1>

              {!hasActiveSignIn ? (
                <div>
                  <p className="text-base md:text-lg text-[var(--color-muted)] font-medium leading-relaxed mb-8">
                    This extra step starts from the log in form. Enter your email and password again so we can send a new code.
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    href="/login"
                    icon={<ArrowRight className="w-4 h-4 ml-1" />}
                  >
                    Back to log in
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-base md:text-lg text-[var(--color-muted)] font-medium leading-relaxed mb-8">
                    Enter the 6-digit code we just sent. Production sign-in (including Vercel) often requires this extra check; it is skipped on many localhost setups.
                  </p>

                  {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700 text-left">
                      {error}
                    </div>
                  )}

                  {resendSuccess && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700">
                      A new code has been sent. Check inbox and spam.
                    </div>
                  )}

                  <form onSubmit={handleVerify} className="space-y-6">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      maxLength={6}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-bold text-[var(--color-ink)] text-center text-3xl tracking-[0.4em]"
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting}
                      icon={
                        isSubmitting ? (
                          <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4 ml-1" />
                        )
                      }
                    >
                      {isSubmitting ? "Verifying..." : "Verify and log in"}
                    </Button>
                  </form>

                  <div className="flex flex-col gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={isResending}
                      className="inline-flex items-center justify-center gap-2 text-sm font-bold text-sky-600 hover:text-sky-700 transition-colors disabled:opacity-50"
                    >
                      {isResending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="w-4 h-4" />
                      )}
                      {isResending ? "Sending..." : "Resend code"}
                    </button>

                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-[var(--color-ink)] transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to log in
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
