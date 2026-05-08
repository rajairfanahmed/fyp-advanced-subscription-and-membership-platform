import React from "react";

interface BenefitCardProps {
  title: string;
  description: string;
  number: string;
}

export function BenefitCard({ title, description, number }: BenefitCardProps) {
  return (
    <div className="relative p-8 rounded-[2rem] bg-white border border-slate-200 shadow-[var(--shadow-soft)] hover:shadow-xl transition-all duration-300 group overflow-hidden">
      <div className="absolute -right-6 -top-6 text-[8rem] font-black font-display text-slate-50 opacity-50 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        {number}
      </div>
      <div className="relative z-10">
        <h3 className="text-2xl font-bold font-display text-[var(--color-ink)] mb-4">{title}</h3>
        <p className="text-lg text-[var(--color-muted)] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
