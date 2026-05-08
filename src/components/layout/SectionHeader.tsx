import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  alignment?: "left" | "center";
  badge?: string;
}

export function SectionHeader({ title, subtitle, alignment = "center", badge }: SectionHeaderProps) {
  return (
    <div className={`mb-12 md:mb-16 ${alignment === "center" ? "text-center mx-auto max-w-3xl" : "text-left max-w-2xl"}`}>
      {badge && (
        <span className="inline-block py-1 px-3 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-semibold tracking-wide uppercase mb-4">
          {badge}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 font-heading mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
