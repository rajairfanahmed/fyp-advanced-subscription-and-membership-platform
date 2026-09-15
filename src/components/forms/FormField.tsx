import React from "react";
import { fieldInputClass } from "@/lib/auth/form-validation";

type FormFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  tone?: "sky" | "emerald" | "violet";
  trailing?: React.ReactNode;
};

export function FormField({
  id,
  label,
  error,
  hint,
  tone = "emerald",
  trailing,
  className = "",
  ...inputProps
}: FormFieldProps) {
  const describedBy =
    [error ? `${id}-error` : null, !error && hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold text-slate-700">
          {label}
        </label>
        {trailing}
      </div>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`${fieldInputClass(Boolean(error), tone)} ${className}`}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs font-medium text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
