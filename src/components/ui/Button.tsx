import React from "react";
import Link from "next/link";

type ButtonOwnProps = {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
};

type ButtonAsAnchor = ButtonOwnProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    /**
     * When true, render a plain <a> instead of next/link so the
     * browser performs a real navigation (used for downloads or
     * non-page URLs like /api/* CSV exports).
     */
    download?: boolean | string;
  };

type ButtonAsNative = ButtonOwnProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

export type ButtonProps = ButtonAsAnchor | ButtonAsNative;

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  icon,
  className = "",
  ...rest
}: ButtonProps) {
  const baseStyles =
    "inline-flex justify-center items-center gap-2 font-semibold transition-all duration-300 ease-in-out rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary:
      "bg-[var(--color-emerald)] text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5",
    secondary:
      "bg-white text-[var(--color-ink)] border border-[var(--color-border)] hover:border-slate-300 shadow-[var(--shadow-soft)] hover:bg-slate-50",
    outline:
      "bg-transparent text-[var(--color-ink)] border-2 border-[var(--color-border)] hover:border-[var(--color-ink)]",
    ghost: "bg-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-slate-100",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    const { download, ...anchorRest } = rest as Omit<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      "children" | "className"
    > & { download?: boolean | string };

    if (download !== undefined || /^(https?:|mailto:|tel:)|^\/api\//.test(href)) {
      const downloadAttr =
        typeof download === "string"
          ? download
          : download === true
            ? ""
            : undefined;
      return (
        <a
          href={href}
          className={classes}
          {...(downloadAttr !== undefined ? { download: downloadAttr } : {})}
          {...anchorRest}
        >
          {children}
          {icon}
        </a>
      );
    }

    return (
      <Link href={href} className={classes} {...anchorRest}>
        {children}
        {icon}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
      {icon}
    </button>
  );
}
