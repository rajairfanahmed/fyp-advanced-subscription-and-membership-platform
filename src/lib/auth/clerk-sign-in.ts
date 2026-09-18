export type ClerkFormError = {
  code?: string;
  message?: string;
  longMessage?: string;
};

type FactorLike = {
  strategy?: string;
  emailAddressId?: string;
};

type SignInLike = {
  status: string | null;
  supportedFirstFactors?: FactorLike[] | null;
  supportedSecondFactors?: FactorLike[] | null;
  createdSessionId?: string | null;
  prepareFirstFactor: (params: {
    strategy: "email_code";
    emailAddressId: string;
  }) => Promise<unknown>;
  prepareSecondFactor: (params: {
    strategy: "email_code";
    emailAddressId: string;
  }) => Promise<unknown>;
};

export const GOOGLE_ONLY_LOGIN_MESSAGE =
  "This email was registered with Google, so there is no password yet. Use Continue with Google. To log in with email later, use Forgot password and set one.";

export function clerkSignInErrorMessage(err: unknown) {
  const clerkError = err as { errors?: ClerkFormError[]; status?: number };
  const firstError = clerkError.errors?.[0];
  const errCode = firstError?.code || "";

  if (errCode === "form_password_pwned") {
    return "This password cannot be used. Please reset your password.";
  }
  if (
    errCode === "strategy_for_user_invalid" ||
    errCode === "form_conditional_param_missing"
  ) {
    return GOOGLE_ONLY_LOGIN_MESSAGE;
  }
  if (errCode === "session_exists") {
    return "You are already signed in. Redirecting...";
  }
  if (errCode === "form_identifier_not_found") {
    return "No account exists for this email. Sign up first, or try Continue with Google.";
  }
  if (errCode === "form_password_incorrect") {
    return "Invalid email or password. Please try again.";
  }

  return "Invalid email or password. Please try again.";
}

export function signInHasPasswordFactor(signIn: {
  supportedFirstFactors?: FactorLike[] | null;
}) {
  return Boolean(
    signIn.supportedFirstFactors?.some((factor) => factor.strategy === "password")
  );
}

export function signInHasGoogleFactor(signIn: {
  supportedFirstFactors?: FactorLike[] | null;
}) {
  return Boolean(
    signIn.supportedFirstFactors?.some((factor) => factor.strategy === "oauth_google")
  );
}

function emailCodeFactor(
  factors: FactorLike[] | null | undefined
): FactorLike | undefined {
  return factors?.find(
    (factor) => factor.strategy === "email_code" && factor.emailAddressId
  );
}

/**
 * Clerk production / new-device sign-in often returns needs_second_factor
 * and will not email a code until prepare*Factor is called. Localhost
 * usually skips this, which is why Vercel looked broken.
 */
export async function prepareSignInEmailCode(signIn: SignInLike): Promise<boolean> {
  const second = emailCodeFactor(signIn.supportedSecondFactors);
  if (second?.emailAddressId) {
    await signIn.prepareSecondFactor({
      strategy: "email_code",
      emailAddressId: second.emailAddressId,
    });
    return true;
  }

  const first = emailCodeFactor(signIn.supportedFirstFactors);
  if (first?.emailAddressId) {
    await signIn.prepareFirstFactor({
      strategy: "email_code",
      emailAddressId: first.emailAddressId,
    });
    return true;
  }

    return false;
}
