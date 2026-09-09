"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, Loader2, ChevronLeft } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, signIn } = useSignIn();
  const { isSignedIn } = useAuth();

  const [email, setEmail] = useState("");
  const [emailIsReadonly, setEmailIsReadonly] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Retrieve email from query or sessionStorage (set by forgot-password page)
  useEffect(() => {
    const queryEmail = searchParams.get("email");
    if (queryEmail) {
      setEmail(queryEmail);
      setEmailIsReadonly(true);
      return;
    }

    const savedEmail = sessionStorage.getItem("platform_reset_email");
    if (savedEmail && !queryEmail) {
      setEmail(savedEmail);
      setEmailIsReadonly(false);
    }
  }, [searchParams]);

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

  function validate(): string | null {
    if (!email.trim()) return "Please enter your email address.";
    if (!code.trim()) return "Please enter the reset code from your email.";
    if (!newPassword) return "Please enter your new password.";
    if (newPassword.length < 8) return "Password must be at least 8 characters.";
    if (newPassword !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      // Attempt to reset the password with the code
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password: newPassword,
      });

      if (result.status === "complete") {
        // Do NOT auto-login after password reset.
        // Always redirect to /login so user logs in with new password.
        sessionStorage.removeItem("platform_reset_email");
        window.location.href = "/login?reset=success";
      } else {
        setError("Your session could not be completed. Please try again.");
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

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)] relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-emerald-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />

      <Container className="max-w-xl">
        <MotionReveal instant className="flex flex-col items-center text-center">

          <MotionItem className="w-full mb-8">
            <Link href="/forgot-password" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[var(--color-ink)] transition-colors self-start mb-8 mr-auto">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Link>
            <Badge variant="emerald" className="mb-4 mx-auto">Security Update</Badge>
            <h1 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-4 tracking-tight">
              Create A New Password
            </h1>
            <p className="text-lg text-[var(--color-muted)] font-medium leading-relaxed">
              Enter the code from your email and choose a new password.
            </p>
          </MotionItem>

          <MotionItem className="w-full">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-8 md:p-10 relative overflow-hidden text-left">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-sky-400" />

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleFormSubmit}>

                {/* Email (readonly if safely passed from /forgot-password) */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={emailIsReadonly}
                    placeholder="jane@example.com"
                    className={emailIsReadonly
                      ? "w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-500 cursor-not-allowed"
                      : "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                    }
                  />
                  <p className="text-xs font-medium text-slate-500">
                    Start from <Link href="/forgot-password" className="font-bold text-sky-600 hover:text-sky-700 transition-colors">Forgot password</Link> to request a reset code.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Reset Code</label>
                  <input
                    type="text"
                    placeholder="Enter code from email"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)] text-center text-lg tracking-widest"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                  />
                </div>

                <p className="text-xs font-medium text-slate-500">
                  Use a strong password that is not used on another platform.
                </p>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                    icon={isSubmitting ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <ArrowRight className="w-4 h-4 ml-1" />}
                  >
                    {isSubmitting ? "Updating password..." : "Update Password"}
                  </Button>
                </div>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <Link href="/login" className="text-sm font-bold text-sky-600 hover:text-sky-700 transition-colors">
                  Back to Login
                </Link>
              </div>
            </div>
          </MotionItem>

        </MotionReveal>
      </Container>
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js 15
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-paper)]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
