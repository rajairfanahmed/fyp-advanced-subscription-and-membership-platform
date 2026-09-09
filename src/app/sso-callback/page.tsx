"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

import { consumeReturnPath } from "@/lib/auth/post-login-redirect";

/**
 * SSO Callback page for Google OAuth (signup and login).
 *
 * Flow:
 * 1. /login/sso-callback or /sign-up/sso-callback handles the Clerk token exchange.
 * 2. Once the session is active (verified by /api/auth/redirect returning 200),
 *    we check sessionStorage for the selected role from the signup page.
 * 3. If a role was stored (Google signup), we POST to /api/auth/set-role to
 *    persist it in Clerk publicMetadata (server-side, trusted).
 * 4. Then redirect to the correct dashboard based on role + admin email check.
 */
export default function SSOCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const processing = useRef(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Prevent concurrent processing
      if (processing.current) return;

      try {
        // Check if session is active
        const res = await fetch("/api/auth/redirect", {
            cache: "no-store",
            credentials: "include",
          });

        if (!res.ok) {
          // Session not active yet — retry
          if (attempts < 12) {
            setAttempts((prev) => prev + 1);
          } else {
            setError("Google sign in could not be completed. Please check Clerk Google OAuth settings and try again.");
          }
          return;
        }

        processing.current = true;

        // Session is active. Check for stored role from Google signup.
        const storedRole = sessionStorage.getItem("platform_signup_role");
        const intent = sessionStorage.getItem("platform_oauth_intent");

        if (intent === "signup" && (storedRole === "creator" || storedRole === "subscriber")) {
          // Persist role to Clerk publicMetadata via server endpoint
          try {
            await fetch("/api/auth/set-role", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: storedRole }),
              credentials: "include",
            });
          } catch {
            // Role save failed — user will default to subscriber.
            // Not critical enough to block the redirect.
            console.warn("[sso-callback] Failed to save role, defaulting to subscriber.");
          }
        }

        // Clean up sessionStorage
        sessionStorage.removeItem("platform_signup_role");
        sessionStorage.removeItem("platform_oauth_intent");

        // Re-fetch redirect now that role may have been updated
        const redirectRes = await fetch("/api/auth/redirect", {
            cache: "no-store",
            credentials: "include",
          });
        const data = (await redirectRes.json()) as { redirect?: string };
        const fallback = data.redirect || "/library";
        router.replace(consumeReturnPath(fallback));
      } catch {
        if (attempts < 12) {
          setAttempts((prev) => prev + 1);
        } else {
          setError("Google sign in could not be completed. Please check Clerk Google OAuth settings and try again.");
        }
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [attempts, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-paper)]">
      <div className="text-center max-w-sm mx-auto px-6">
        {!error ? (
          <>
            <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-500">Completing authentication...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <p className="text-sm font-bold text-red-600 mb-4">{error}</p>
            <div className="flex flex-col gap-3">
              <Link href="/login" className="text-sm font-bold text-sky-600 hover:text-sky-700 transition-colors">
                Back to Login
              </Link>
              <Link href="/sign-up" className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">
                Back to Sign Up
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
