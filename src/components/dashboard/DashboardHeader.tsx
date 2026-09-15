"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  role?: "creator" | "admin";
}

export function DashboardHeader({ eyebrow, title, subtitle, action, role = "creator" }: DashboardHeaderProps) {
  const accentColor = role === "creator" ? "text-teal-600" : "text-violet-600";
  
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 md:gap-6 mb-8 md:mb-10 min-w-0">
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <span className={cn("text-[10px] font-black uppercase tracking-[0.25em] mb-3 md:mb-4 block opacity-80", accentColor)}>
            {eyebrow}
          </span>
        )}
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-black font-display text-slate-900 tracking-tighter leading-[1.1] break-words">
          {title}
        </h1>
        <p className="text-slate-500 font-medium mt-3 md:mt-4 max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed opacity-90 break-words">
          {subtitle}
        </p>
      </div>
      {action && (
        <div className="w-full md:w-auto min-w-0 [&>a]:w-full [&>button]:w-full md:[&>a]:w-auto md:[&>button]:w-auto [&>a]:justify-center [&>button]:justify-center [&>a]:whitespace-normal [&>button]:whitespace-normal animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300 fill-mode-both">
          {action}
        </div>
      )}
    </div>
  );
}
