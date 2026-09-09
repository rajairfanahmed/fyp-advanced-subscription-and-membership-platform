import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string;
  compact?: boolean;
  className?: string;
  markId?: string;
};

export function BrandLogo({
  href = "/",
  compact = false,
  className,
  markId = "brand-mark",
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={cn("relative z-50 flex items-center gap-2 group min-w-0", className)}
    >
      <svg
        className={cn(
          "shrink-0 group-hover:scale-105 transition-transform",
          compact ? "w-8 h-8" : "w-8 h-8"
        )}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="32" height="32" rx="8" fill={`url(#${markId})`} />
        <rect x="8" y="10" width="16" height="5" rx="1.5" stroke="white" strokeWidth="1.8" />
        <rect x="8" y="17" width="16" height="5" rx="1.5" stroke="white" strokeWidth="1.8" />
        <defs>
          <linearGradient id={markId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-emerald)" />
            <stop offset="1" stopColor="var(--color-sky)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="font-display font-bold text-xl text-[var(--color-ink)] tracking-tight">
        {siteConfig.shortName}
      </span>
    </Link>
  );
}
