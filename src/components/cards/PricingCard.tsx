import React from "react";
import { Button } from "@/components/ui/Button";

interface PricingCardProps {
  name: string;
  price: string;
  interval?: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  buttonText: string;
  buttonHref: string;
}

export function PricingCard({
  name,
  price,
  interval = "month",
  description,
  features,
  isPopular = false,
  buttonText,
  buttonHref,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col p-8 rounded-3xl bg-white border transition-all duration-300 ${
        isPopular
          ? "border-indigo-500 shadow-2xl shadow-indigo-500/10 scale-105 z-10 ring-1 ring-indigo-500"
          : "border-slate-200 shadow-sm hover:shadow-md"
      }`}
    >
      {isPopular && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
          Most Popular
        </div>
      )}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-900 mb-2">{name}</h3>
        <p className="text-slate-500 text-sm mb-6 h-10">{description}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-extrabold text-slate-900 tracking-tight">{price}</span>
          {price !== "Free" && (
            <span className="text-slate-500 font-medium">/{interval}</span>
          )}
        </div>
      </div>
      
      <ul className="flex-1 space-y-4 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <svg
              className={`w-5 h-5 shrink-0 ${isPopular ? "text-indigo-600" : "text-slate-400"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-slate-600 text-sm leading-tight">{feature}</span>
          </li>
        ))}
      </ul>
      
      <Button
        variant={isPopular ? "primary" : "outline"}
        className={`w-full ${!isPopular && "border-slate-300 hover:border-slate-400"}`}
        href={buttonHref}
      >
        {buttonText}
      </Button>
    </div>
  );
}
