"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/forms/FormField";
import { ArrowRight, ChevronLeft, Loader2, CheckCircle2 } from "lucide-react";
import { assertAuthThrottle } from "@/lib/auth/auth-throttle";
import { validateEmail } from "@/lib/auth/form-validation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isLoaded, signIn } = useSignIn();
  const { isSignedIn } = useAuth();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  React.useEffect(() => {
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

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    const nextEmailError = validateEmail(email) ?? undefined;
    setEmailError(nextEmailError);
    if (nextEmailError) return;

    setError("");
    setIsSubmitting(true);

    try {
      const gated = await assertAuthThrottle("forgot-password");
      if (!gated.ok) {
        setError(gated.message);
        return;
      }

      try {
        await signIn.create({
          strategy: "reset_password_email_code",
          identifier: email.trim().toLowerCase(),
        });
      } catch {
        // Identical success path whether or not the email exists.
      }

      sessionStorage.setItem("platform_reset_email", email.trim().toLowerCase());
      setCodeSent(true);

      setTimeout(() => {
        router.push("/reset-password");
      }, 1500);
    } catch {
      setError("We could not send a reset code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)] relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-violet-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />

      <Container className="max-w-xl">
        <MotionReveal instant className="flex flex-col items-center text-center">

          <MotionItem className="w-full mb-8">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[var(--color-ink)] transition-colors self-start mb-8 mr-auto">
              <ChevronLeft className="w-4 h-4" />
              Back to Login
            </Link>
            <Badge variant="default" className="mb-4 mx-auto">Account Recovery</Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-4 tracking-tight">
              Reset your password
            </h1>
            <p className="text-lg text-[var(--color-muted)] font-medium leading-relaxed">
              Enter your account email and we will send a secure reset code.
            </p>
          </MotionItem>

          <MotionItem className="w-full">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-5 sm:p-8 md:p-10 relative overflow-hidden text-left">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-400 to-sky-400" />

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {codeSent && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  If an account exists for that email, a reset code is on its way. Redirecting…
                </div>
              )}

              <form className="space-y-6" onSubmit={handleFormSubmit} noValidate>
                <FormField
                  id="forgot-email"
                  label="Email Address"
                  type="email"
                  autoComplete="email"
                  placeholder="jane@example.com"
                  value={email}
                  tone="violet"
                  disabled={codeSent}
                  error={emailError}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(validateEmail(e.target.value) ?? undefined);
                  }}
                  onBlur={() => setEmailError(validateEmail(email) ?? undefined)}
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full bg-violet-600 hover:bg-violet-700"
                    disabled={isSubmitting || codeSent || !isLoaded}
                    icon={isSubmitting ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <ArrowRight className="w-4 h-4 ml-1" />}
                  >
                    {isSubmitting ? "Sending code..." : codeSent ? "Code Sent!" : "Send Reset Code"}
                  </Button>
                </div>
              </form>
            </div>
          </MotionItem>

        </MotionReveal>
      </Container>
    </div>
  );
}
