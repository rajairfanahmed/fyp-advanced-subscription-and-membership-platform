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
import { FormField } from "@/components/forms/FormField";
import { ArrowRight, Loader2, ChevronLeft } from "lucide-react";
import {
  passwordStrength,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/auth/form-validation";
import { cn } from "@/lib/utils";

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
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    code?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const strength = passwordStrength(newPassword);

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

  function validate(): boolean {
    const next = {
      email: validateEmail(email) ?? undefined,
      code: code.trim() ? undefined : "Please enter the reset code from your email.",
      newPassword: validatePassword(newPassword, "strength") ?? undefined,
      confirmPassword: validatePasswordConfirm(newPassword, confirmPassword) ?? undefined,
    };
    setFieldErrors(next);
    return !next.email && !next.code && !next.newPassword && !next.confirmPassword;
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    if (!validate()) return;

    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
        password: newPassword,
      });

      if (result.status === "complete") {
        sessionStorage.removeItem("platform_reset_email");
        window.location.href = "/login?reset=success";
      } else {
        setError("Your session could not be completed. Please try again.");
      }
    } catch {
      setError("The verification code is invalid or expired. Please request a new one.");
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
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-4 tracking-tight">
              Create a new password
            </h1>
            <p className="text-lg text-[var(--color-muted)] font-medium leading-relaxed">
              Enter the code from your email and choose a new password.
            </p>
          </MotionItem>

          <MotionItem className="w-full">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-5 sm:p-8 md:p-10 relative overflow-hidden text-left">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-sky-400" />

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleFormSubmit} noValidate>
                <FormField
                  id="reset-email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={emailIsReadonly}
                  placeholder="jane@example.com"
                  error={fieldErrors.email}
                  hint="Start from Forgot password to request a reset code."
                />

                <FormField
                  id="reset-code"
                  label="Reset Code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter code from email"
                  value={code}
                  error={fieldErrors.code}
                  className="text-center text-lg tracking-widest"
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (fieldErrors.code) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        code: e.target.value.trim() ? undefined : "Please enter the reset code from your email.",
                      }));
                    }
                  }}
                />

                <FormField
                  id="reset-password"
                  label="New Password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={newPassword}
                  error={fieldErrors.newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />

                <FormField
                  id="reset-confirm"
                  label="Confirm New Password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  error={fieldErrors.confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <span className={cn("px-2 py-1 rounded-md border text-xs font-medium", strength.minLength ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                    At least 8 characters
                  </span>
                  <span className={cn("px-2 py-1 rounded-md border text-xs font-medium", strength.number ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                    One number
                  </span>
                  <span className={cn("px-2 py-1 rounded-md border text-xs font-medium", strength.uppercase ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                    One uppercase letter
                  </span>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting || !isLoaded}
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
