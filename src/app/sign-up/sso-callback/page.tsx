"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Sign-Up SSO Callback — handles Google OAuth return during signup.
 * Clerk redirects here after Google authenticates the user.
 * <AuthenticateWithRedirectCallback /> completes the signup and
 * redirects to redirectUrlComplete (our /sso-callback for post-auth logic).
 */
export default function SignUpSSOCallbackPage() {
  return (
    <>
      <AuthenticateWithRedirectCallback
        signInUrl="/login"
        signUpUrl="/sign-up"
        continueSignUpUrl="/sign-up"
        signInFallbackRedirectUrl="/sso-callback"
        signUpFallbackRedirectUrl="/sso-callback"
      />
      <div id="clerk-captcha" />
    </>
  );
}
