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
import { CheckCircle2, User, LayoutDashboard, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  consumeReturnPath,
  rememberReturnPathFromSearchParams,
} from "@/lib/auth/post-login-redirect";

const BENEFITS = [
  "Browse premium content.",
  "Create subscription plans.",
  "Lock videos, articles, PDFs, and ZIP files.",
  "Prepare for recurring billing later."
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
  const [isAdminEmail, setIsAdminEmail] = useState(false);
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);

  // Detect when the typed email is on the admin allowlist so we can
  // hide the Subscriber/Creator picker (admin role is granted by
  // email match, not by Clerk metadata). Debounced 250 ms to avoid
  // hammering the endpoint on every keystroke.
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setIsAdminEmail(false);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-admin?email=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          if (!cancelled) setIsAdminEmail(false);
          return;
        }
        const data = (await res.json()) as { isAdmin?: boolean };
        if (!cancelled) setIsAdminEmail(Boolean(data.isAdmin));
      } catch {
        if (!cancelled) setIsAdminEmail(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [email]);

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

  // ── Client-side validation ──
  function validate(): string | null {
    // Admin emails are auto-detected and skip the role selector — the
    // server-side `ADMIN_EMAILS` allowlist grants admin powers on
    // first login regardless of the metadata role we set here.
    if (!isAdminEmail && !accountType) return "Please choose Subscriber or Creator.";
    if (!fullName.trim()) return "Full name is required.";
    if (!email.trim()) return "Please enter your email address.";
    if (!password) return "Please enter your password.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/\d/.test(password)) return "Password must include at least one number.";
    if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  // ── Email/Password Signup ──
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) {
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
      // Admin signups default to subscriber metadata — Clerk doesn't
      // need to know about admin status; that's resolved server-side
      // via `ADMIN_EMAILS` on every request.
      const selectedRole = isAdminEmail
        ? "subscriber"
        : accountType === "creator"
          ? "creator"
          : "subscriber";
      // Split full name into first and last
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      await signUp.create({
        emailAddress: email,
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
      const clerkError = err as { errors?: { message: string }[] };
      setError(
        clerkError.errors?.[0]?.message || "Something went wrong. Please try again."
      );
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
    // Admin emails skip the role picker so we don't gate Google signup
    // on it. We default to subscriber metadata — admin powers attach
    // via the `ADMIN_EMAILS` allowlist server-side.
    if (!isAdminEmail && !accountType) {
      setError("Please choose Subscriber or Creator.");
      return;
    }

    setError("");

    try {
      // Store selected role in sessionStorage before OAuth redirect.
      // TODO: After Google signup, apply role from sessionStorage to Clerk metadata
      // via a webhook or post-signup API call. For now defaults to subscriber on /library.
      sessionStorage.setItem(
        "nexora_signup_role",
        isAdminEmail ? "subscriber" : accountType
      );
      sessionStorage.setItem("nexora_oauth_intent", "signup");

      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sign-up/sso-callback",
        redirectUrlComplete: "/sso-callback",
      });
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(
        clerkError.errors?.[0]?.message ||
        "Google sign in could not be completed. Please check Clerk Google OAuth settings and try again."
      );
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
                <h1 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-4 tracking-tight">
                  Create Your Nexora Account
                </h1>
                <p className="text-lg text-[var(--color-muted)] font-medium leading-relaxed">
                  Start building or accessing a paid content membership experience.
                </p>
              </div>
            </MotionItem>

            <MotionItem>
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-8 md:p-10 relative overflow-hidden">
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

                  {/* Account Type Selector — hidden for admin emails
                      (the email allowlist grants admin powers without
                      a role pick). */}
                  {isAdminEmail ? (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-black text-violet-900 mb-0.5">
                          Admin email detected
                        </p>
                        <p className="text-xs font-medium text-violet-800 leading-relaxed">
                          This email is on the admin allowlist. Admin powers attach automatically once you finish signup — no role picker needed.
                        </p>
                        <p className="text-[11px] font-bold text-violet-900/80 leading-relaxed mt-2">
                          Heads-up: Clerk rejects fake TLDs like <code className="bg-violet-100 rounded px-1">.test</code>, <code className="bg-violet-100 rounded px-1">.invalid</code>, or <code className="bg-violet-100 rounded px-1">.localhost</code> with &ldquo;email is invalid&rdquo;. Use a real deliverable address (Gmail, Outlook, your real domain) and add it to <code className="bg-violet-100 rounded px-1">ADMIN_EMAILS</code> in <code className="bg-violet-100 rounded px-1">.env.local</code>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Account Type</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setAccountType("subscriber")}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all flex flex-col gap-2 cursor-pointer",
                            accountType === "subscriber"
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-100 bg-slate-50 hover:border-slate-200"
                          )}
                        >
                          <User className={cn("w-5 h-5", accountType === "subscriber" ? "text-emerald-600" : "text-slate-400")} />
                          <span className={cn("font-bold text-sm", accountType === "subscriber" ? "text-emerald-900" : "text-slate-600")}>Subscriber</span>
                          <span className="text-[11px] text-slate-500 font-medium leading-snug">Browse paid content.</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountType("creator")}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all flex flex-col gap-2 cursor-pointer",
                            accountType === "creator"
                              ? "border-sky-500 bg-sky-50"
                              : "border-slate-100 bg-slate-50 hover:border-slate-200"
                          )}
                        >
                          <LayoutDashboard className={cn("w-5 h-5", accountType === "creator" ? "text-sky-600" : "text-slate-400")} />
                          <span className={cn("font-bold text-sm", accountType === "creator" ? "text-sky-900" : "text-slate-600")}>Creator</span>
                          <span className="text-[11px] text-slate-500 font-medium leading-snug">Publish content & manage memberships.</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <label className="text-sm font-bold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      placeholder="jane@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Confirm Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-[var(--color-ink)]"
                      />
                    </div>
                  </div>

                  <div className="text-xs font-medium text-slate-500 space-y-2">
                    <p>Password should include:</p>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn("px-2 py-1 rounded-md border", hasMinLength ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                        At least 8 characters
                      </span>
                      <span className={cn("px-2 py-1 rounded-md border", hasNumber ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                        One number
                      </span>
                      <span className={cn("px-2 py-1 rounded-md border", hasUppercase ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200")}>
                        One uppercase letter
                      </span>
                    </div>
                  </div>

                  {/* Clerk Bot Protection CAPTCHA widget mount point.
                      Required when Bot Protection is enabled in Clerk Dashboard.
                      See: https://clerk.com/docs/guides/development/custom-flows/authentication/bot-sign-up-protection */}
                  <div id="clerk-captcha" className="mt-4" />

                  <div className="pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting}
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

              <h3 className="text-2xl font-black font-display mb-8 relative z-10">Why join Nexora?</h3>

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
                  &ldquo;Nexora provides the perfect clean slate to build a real subscription business without the messy plugins.&rdquo;
                </p>
              </div>
            </MotionItem>
          </div>

        </MotionReveal>
      </Container>
    </div>
  );
}
