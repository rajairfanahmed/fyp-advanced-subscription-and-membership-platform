export const EMAIL_MAX = 200;
export const NAME_MAX = 80;
export const PASSWORD_MIN = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Please enter your email address.";
  if (email.length > EMAIL_MAX) return "Email is too long.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  return null;
}

export function validateRequiredName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Full name is required.";
  if (name.length > NAME_MAX) return "Name is too long.";
  return null;
}

export type PasswordRules = {
  minLength?: boolean;
  number?: boolean;
  uppercase?: boolean;
};

export function passwordStrength(value: string): PasswordRules {
  return {
    minLength: value.length >= PASSWORD_MIN,
    number: /\d/.test(value),
    uppercase: /[A-Z]/.test(value),
  };
}

/** Login: presence only. Sign-up / reset: full strength rules. */
export function validatePassword(
  value: string,
  mode: "login" | "strength" = "login"
): string | null {
  if (!value) return "Please enter your password.";
  if (mode === "login") return null;
  if (value.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (!/\d/.test(value)) return "Password must include at least one number.";
  if (!/[A-Z]/.test(value)) {
    return "Password must include at least one uppercase letter.";
  }
  return null;
}

export function validatePasswordConfirm(
  password: string,
  confirm: string
): string | null {
  if (!confirm) return "Please confirm your password.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export function fieldInputClass(hasError: boolean, tone: "sky" | "emerald" | "violet" = "emerald") {
  const ring =
    tone === "sky"
      ? "focus:ring-sky-500"
      : tone === "violet"
        ? "focus:ring-violet-500"
        : "focus:ring-emerald-500";
  return [
    "w-full px-4 py-3 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium text-[var(--color-ink)] disabled:opacity-50",
    hasError
      ? "bg-red-50 border border-red-400 focus:ring-red-500"
      : `bg-slate-50 border border-slate-200 ${ring}`,
  ].join(" ");
}
