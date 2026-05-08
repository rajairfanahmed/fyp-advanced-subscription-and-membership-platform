import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "emerald" | "sky" | "locked";
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({ children, variant = "default", icon, className = "" }: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-700 border border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border border-sky-200",
    locked: "bg-slate-900 text-white border border-slate-800 shadow-md",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase ${variants[variant]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
