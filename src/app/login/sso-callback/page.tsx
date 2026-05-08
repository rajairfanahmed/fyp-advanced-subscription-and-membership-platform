"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Login SSO Callback — handles Google OAuth return during login.
 * Clerk redirects here after Google authenticates the user.
 * <AuthenticateWithRedirectCallback /> completes the sign-in and
 * redirects to redirectUrlComplete (our /sso-callback for post-auth logic).
 */
export default function LoginSSOCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInUrl="/login?oauth_error=google_account_not_found"
      signUpUrl="/sign-up"
      continueSignUpUrl="/login?oauth_error=google_account_not_found"
      signInFallbackRedirectUrl="/sso-callback"
      signUpFallbackRedirectUrl="/sso-callback"
      transferable={false}
    />
  );
}
