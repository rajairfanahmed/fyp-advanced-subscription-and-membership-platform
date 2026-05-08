"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, UserCircle, LayoutDashboard, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import {
  consumeReturnPath,
  rememberReturnPathFromSearchParams,
} from "@/lib/auth/post-login-redirect";

type ClerkFormError = {
  code?: string;
  message?: string;
  longMessage?: string;
  meta?: {
    paramName?: string;
  };
};

function getFriendlySignInError(err: unknown) {
  const clerkError = err as { errors?: ClerkFormError[]; status?: number };
  const firstError = clerkError.errors?.[0];
  const errCode = firstError?.code || "";
  const errMsg = firstError?.longMessage || firstError?.message || "";
  const lowerMessage = errMsg.toLowerCase();

  if (errCode === "form_identifier_not_found" || lowerMessage.includes("identifier")) {
    return "No account found with this email. Please sign up first.";
  }

  if (errCode === "form_password_incorrect" || lowerMessage.includes("password")) {
    return "Incorrect password. Please try again or use Forgot Password to reset it.";
  }

  if (errCode === "form_password_pwned") {
    return "This password cannot be used. Please reset your password.";
  }

  if (errCode === "verification_expired" || lowerMessage.includes("verification")) {
    return "This account needs verification. Please check your email or sign up again.";
  }

  if (errCode === "strategy_for_user_invalid") {
    return "This account uses a different login method. Try Continue with Google or reset your password.";
  }

  if (errCode === "session_exists") {
    return "You are already signed in. Redirecting...";
  }

  if (clerkError.status === 422) {
    return "We could not sign you in with those details. Please check your email and password.";
  }

  return errMsg || "Invalid email or password. Please try again.";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();

  // ── Form State ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── UI State ──
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Success banners ──
  const isVerified = searchParams.get("verified") === "true";
  const isReset = searchParams.get("reset") === "success";
  const oauthError = searchParams.get("oauth_error");
  const oauthErrorMessage =
    oauthError === "google_account_not_found"
      ? "No account is linked to this Google email. Please sign up first, then use Google login next time."
      : oauthError === "google_login_failed"
        ? "Google sign in could not be completed. Please try again."
        : "";

  useEffect(() => {
    rememberReturnPathFromSearchParams(searchParams);
  }, [searchParams]);

  // Redirect if already signed in
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
        const fallback = data.redirect || "/library";
        if (!cancelled) router.replace(consumeReturnPath(fallback));
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

  // ── Client-side validation ──
  function validate(): string | null {
    if (!email.trim()) return "Please enter your email address.";
    if (!password) return "Please enter your password.";
    return null;
  }

  // ── Email/Password Login ──
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
      const result = await signIn.create({
        strategy: "password",
        identifier: email.trim().toLowerCase(),
        password,
      });

      if (result.status === "complete") {
        // Set session active
        await setActive({ session: result.createdSessionId });

        // Fetch role-based redirect from server (handles admin email allowlist)
        try {
          const res = await fetch("/api/auth/redirect", {
            cache: "no-store",
            credentials: "include",
          });
          const data = (await res.json()) as { redirect?: string };
          const fallback = data.redirect || "/library";
          router.push(consumeReturnPath(fallback));
        } catch {
          router.push(consumeReturnPath("/library"));
        }
      } else if (result.status === "needs_first_factor") {
        setError("Please check your email or password and try again.");
      } else {
        // Handle other statuses (e.g., needs_second_factor)
        setError("Additional verification required. Please check your email.");
      }
    } catch (err: unknown) {
      setError(getFriendlySignInError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Google OAuth Login ──
  async function handleGoogleLogin() {
    if (!isLoaded || !signIn) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    setError("");

    try {
      sessionStorage.setItem("nexora_oauth_intent", "login");
      sessionStorage.removeItem("nexora_signup_role");

      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/login/sso-callback",
        redirectUrlComplete: "/sso-callback",
      });
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(
        clerkError.errors?.[0]?.message ||
        "Google sign in could not be completed. Please try again."
      );
    }
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)] relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-0 left-1/4 w-[60vw] h-[60vw] bg-sky-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />

      <Container className="max-w-6xl">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-16 items-start">

          {/* ── 1. Form Section (Left) ── */}
          <MotionReveal instant className="lg:col-span-3">
            <MotionItem>
              <div className="mb-8">
                <Badge variant="sky" className="mb-4">Welcome Back</Badge>
                <h1 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-4 tracking-tight">
                  Log In To Nexora
                </h1>
                <p className="text-lg text-[var(--color-muted)] font-medium leading-relaxed max-w-lg">
                  Access your content library, creator workspace, or admin area.
                </p>
              </div>
            </MotionItem>

            <MotionItem>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-violet-400" />

                {/* ── Success: Email verified ── */}
                {isVerified && (
                  <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    Email verified successfully! Please log in to continue.
                  </div>
                )}

                {/* ── Success: Password reset ── */}
                {isReset && (
                  <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    Password updated successfully! Please log in with your new password.
                  </div>
                )}

                {/* Error Message */}
                {(error || oauthErrorMessage) && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
                    {error || oauthErrorMessage}
                  </div>
                )}

                {/* ── Google OAuth Button ── */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all font-bold text-slate-700 mb-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <form className="space-y-6" onSubmit={handleFormSubmit}>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      placeholder="jane@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium text-[var(--color-ink)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700">Password</label>
                      <Link href="/forgot-password" className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium text-[var(--color-ink)]"
                    />
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full bg-sky-600 hover:bg-sky-700"
                      disabled={isSubmitting}
                      icon={isSubmitting ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <ArrowRight className="w-4 h-4 ml-1" />}
                    >
                      {isSubmitting ? "Signing in..." : "Log In"}
                    </Button>
                  </div>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-600">
                    Don&apos;t have an account? <Link href="/sign-up" className="font-bold text-sky-600 hover:text-sky-700 transition-colors">Sign up</Link>
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    Admins: sign up with your allow-listed email — admin powers attach to the account on first login.
                  </p>
                </div>
              </div>
            </MotionItem>
          </MotionReveal>

          {/* ── 2. Role Reminder Card (Right) ── */}
          <div className="lg:col-span-2 mt-12 lg:mt-0">
            <MotionReveal instant className="sticky top-32 space-y-6">
              <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                <h3 className="text-lg font-black font-display text-[var(--color-ink)] mb-6">One account, all features.</h3>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <UserCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-ink)] text-sm mb-1">Subscribers</h4>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed">Access the premium content library and manage plans.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                      <LayoutDashboard className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-ink)] text-sm mb-1">Creators</h4>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed">Manage content, plans, subscribers, and track revenue.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--color-ink)] text-sm mb-1">Admins</h4>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed">Manage platform users, payments, subscriptions, and analytics.</p>
                    </div>
                  </div>
                </div>
              </div>
            </MotionReveal>
          </div>

        </div>
      </Container>
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js 15
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-paper)]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
