"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignUp } from "@clerk/nextjs/legacy";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/forms/FormField";
import { CheckCircle2, User, LayoutDashboard, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  consumeReturnPath,
  rememberReturnPathFromSearchParams,
} from "@/lib/auth/post-login-redirect";
import { assertAuthThrottle } from "@/lib/auth/auth-throttle";
import {
  passwordStrength,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateRequiredName,
} from "@/lib/auth/form-validation";

const BENEFITS = [
  "Browse premium content.",
  "Create subscription plans.",
  "Lock videos, articles, PDFs, and ZIP files.",
  "Subscribe to creators with Stripe recurring billing.",
];

export default function SignUpPage() {
  const router = useRouter();
  const { isLoaded, signUp } = useSignUp();
  const { isSignedIn } = useAuth();

  // ── Form State ──
  const [accountType, setAccountType] = useState<"subscriber" | "creator" | "">("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ── UI State ──
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    accountType?: string;
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [touched, setTouched] = useState<{
    fullName?: boolean;
    email?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
  }>({});
  const strength = passwordStrength(password);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    rememberReturnPathFromSearchParams(params);
  }, []);

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

  function collectErrors() {
    return {
      accountType: accountType ? undefined : "Please choose Subscriber or Creator.",
      fullName: validateRequiredName(fullName) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password, "strength") ?? undefined,
      confirmPassword: validatePasswordConfirm(password, confirmPassword) ?? undefined,
    };
  }

  function validate(): boolean {
    const next = collectErrors();
    setFieldErrors(next);
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    return !next.accountType && !next.fullName && !next.email && !next.password && !next.confirmPassword;
  }

  function getFriendlySignUpError(err: unknown) {
    const clerkError = err as { errors?: { code?: string; message?: string }[] };
    const code = clerkError.errors?.[0]?.code || "";
    if (code === "form_identifier_exists" || code === "form_email_address_exists") {
      return "We could not create this account. Try logging in, or use a different email.";
    }
    if (code === "form_password_pwned") {
      return "This password cannot be used. Please choose a different password.";
    }
    if (code === "form_password_length_too_short" || code === "form_password_not_strong_enough") {
      return "Password does not meet the requirements.";
    }
    return "We could not create this account. Please check your details and try again.";
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    if (!validate()) return;

    setError("");
    setIsSubmitting(true);

    try {
      const gated = await assertAuthThrottle("register");
      if (!gated.ok) {
        setError(gated.message);
        return;
      }

      const selectedRole = accountType === "creator" ? "creator" : "subscriber";
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        password,
        firstName,
        lastName,
        unsafeMetadata: {
          role: selectedRole,
        },
      });

      // Start email verification code flow
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      // Redirect to /verify-email page to enter the 6-digit code.
      // Using window.location.href ensures reliable navigation even if
      // the component re-renders during the async operation.
      window.location.href = "/verify-email";
    } catch (err: unknown) {
      setError(getFriendlySignUpError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Google OAuth Signup ──
  async function handleGoogleSignUp() {
    if (!isLoaded || !signUp) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }
    if (!accountType) {
      setFieldErrors((prev) => ({ ...prev, accountType: "Please choose Subscriber or Creator." }));
      setError("Please choose Subscriber or Creator.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const gated = await assertAuthThrottle("register");
      if (!gated.ok) {
        setError(gated.message);
        setIsSubmitting(false);
        return;
      }

      sessionStorage.setItem("platform_signup_role", accountType);
      sessionStorage.setItem("platform_oauth_intent", "signup");

      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sign-up/sso-callback",
        redirectUrlComplete: "/sso-callback",
      });
    } catch (err: unknown) {
      setError(getFriendlySignUpError(err));
      setIsSubmitting(false);
    }
  }

  // ── Main Signup View ──
  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)] relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-sky-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />

      <Container className="max-w-6xl">
        <MotionReveal instant className="grid lg:grid-cols-5 gap-10 lg:gap-16 items-center">

          {/* ── 1. Form Section (Left) ── */}
          <div className="lg:col-span-3">
            <MotionItem>
              <div className="mb-8">
                <Badge variant="emerald" className="mb-4">Get Started</Badge>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-4 tracking-tight">
                  Create your account
                </h1>
                <p className="text-lg text-[var(--color-muted)] font-medium leading-relaxed">
                  Start building or accessing a paid content membership experience.
                </p>
              </div>
            </MotionItem>

            <MotionItem>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-5 sm:p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-sky-400" />

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                {/* ── Google OAuth Button ── */}
                {/* NOTE: You must enable Google as a Social Connection in your Clerk Dashboard:
                     Dashboard → User & Authentication → Social Connections → Enable Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={isSubmitting || !isLoaded}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all font-bold text-slate-700 mb-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  )}
                  {isSubmitting ? "Please wait..." : "Continue with Google"}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <form className="space-y-6" onSubmit={handleFormSubmit} noValidate>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700">Account Type</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountType("subscriber");
                          setFieldErrors((prev) => ({ ...prev, accountType: undefined }));
                        }}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all flex flex-col gap-2 cursor-pointer",
                          accountType === "subscriber"
                            ? "border-emerald-500 bg-emerald-50"
                            : fieldErrors.accountType
                              ? "border-red-400 bg-red-50"
                              : "border-slate-100 bg-slate-50 hover:border-slate-200"
                        )}
                      >
                        <User className={cn("w-5 h-5", accountType === "subscriber" ? "text-emerald-600" : "text-slate-400")} />
                        <span className={cn("font-bold text-sm", accountType === "subscriber" ? "text-emerald-900" : "text-slate-600")}>Subscriber</span>
                        <span className="text-[11px] text-slate-500 font-medium leading-snug">Browse paid content.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountType("creator");
                          setFieldErrors((prev) => ({ ...prev, accountType: undefined }));
                        }}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all flex flex-col gap-2 cursor-pointer",
                          accountType === "creator"
                            ? "border-sky-500 bg-sky-50"
                            : fieldErrors.accountType
                              ? "border-red-400 bg-red-50"
                              : "border-slate-100 bg-slate-50 hover:border-slate-200"
                        )}
                      >
                        <LayoutDashboard className={cn("w-5 h-5", accountType === "creator" ? "text-sky-600" : "text-slate-400")} />
                        <span className={cn("font-bold text-sm", accountType === "creator" ? "text-sky-900" : "text-slate-600")}>Creator</span>
                        <span className="text-[11px] text-slate-500 font-medium leading-snug">Publish content & manage memberships.</span>
                      </button>
                    </div>
                    {fieldErrors.accountType ? (
                      <p className="text-xs font-medium text-red-600">{fieldErrors.accountType}</p>
                    ) : null}
                  </div>

                  <FormField
                    id="signup-name"
                    label="Full Name"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    value={fullName}
                    error={fieldErrors.fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (touched.fullName) {
                        setFieldErrors((prev) => ({ ...prev, fullName: validateRequiredName(e.target.value) ?? undefined }));
                      }
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, fullName: true }));
                      setFieldErrors((prev) => ({ ...prev, fullName: validateRequiredName(fullName) ?? undefined }));
                    }}
                  />

                  <FormField
                    id="signup-email"
                    label="Email Address"
                    type="email"
                    autoComplete="email"
                    placeholder="jane@example.com"
                    value={email}
                    error={fieldErrors.email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touched.email) {
                        setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) ?? undefined }));
                      }
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, email: true }));
                      setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) ?? undefined }));
                    }}
                  />

                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      id="signup-password"
                      label="Password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      error={fieldErrors.password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (touched.password) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            password: validatePassword(e.target.value, "strength") ?? undefined,
                            confirmPassword: confirmPassword
                              ? validatePasswordConfirm(e.target.value, confirmPassword) ?? undefined
                              : prev.confirmPassword,
                          }));
                        }
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, password: true }));
                        setFieldErrors((prev) => ({ ...prev, password: validatePassword(password, "strength") ?? undefined }));
                      }}
                    />
                    <FormField
                      id="signup-confirm"
                      label="Confirm Password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      error={fieldErrors.confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (touched.confirmPassword) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            confirmPassword: validatePasswordConfirm(password, e.target.value) ?? undefined,
                          }));
                        }
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, confirmPassword: true }));
                        setFieldErrors((prev) => ({
                          ...prev,
                          confirmPassword: validatePasswordConfirm(password, confirmPassword) ?? undefined,
                        }));
                      }}
                    />
                  </div>

                  <div className="text-xs font-medium text-slate-500 space-y-2">
                    <p>Password should include:</p>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn("px-2 py-1 rounded-md border", strength.minLength ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                        At least 8 characters
                      </span>
                      <span className={cn("px-2 py-1 rounded-md border", strength.number ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                        One number
                      </span>
                      <span className={cn("px-2 py-1 rounded-md border", strength.uppercase ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                        One uppercase letter
                      </span>
                    </div>
                  </div>

                  <div id="clerk-captcha" className="mt-4" />

                  <div className="pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting || !isLoaded}
                      icon={isSubmitting ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <ArrowRight className="w-4 h-4 ml-1" />}
                    >
                      {isSubmitting ? "Creating account..." : "Create Account"}
                    </Button>
                  </div>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    Already have an account? <Link href="/login" className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors">Log in</Link>
                  </p>
                </div>
              </div>
            </MotionItem>
          </div>

          {/* ── 2. Trust & Benefits Panel (Right) ── */}
          <div className="lg:col-span-2 space-y-6">
            <MotionItem className="bg-[var(--color-ink)] text-white rounded-[2rem] p-8 md:p-10 relative overflow-hidden shadow-2xl shadow-slate-900/20 hidden lg:block">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl pointer-events-none" />

              <h3 className="text-2xl font-black font-display mb-8 relative z-10">Why join Advanced Subscription & Membership Platform?</h3>

              <ul className="space-y-6 relative z-10">
                {BENEFITS.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="font-medium text-slate-200 leading-relaxed">{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-12 pt-8 border-t border-white/10 relative z-10">
                <p className="text-sm font-medium text-slate-400 leading-relaxed">
                  &ldquo;Advanced Subscription & Membership Platform provides the perfect clean slate to build a real subscription business without the messy plugins.&rdquo;
                </p>
              </div>
            </MotionItem>
          </div>

        </MotionReveal>
      </Container>
    </div>
  );
}
