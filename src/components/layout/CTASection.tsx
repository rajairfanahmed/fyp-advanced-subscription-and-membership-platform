import React from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";

interface CTASectionProps {
  title: string;
  subtitle: string;
  primaryButtonText: string;
  primaryButtonHref: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
}

export function CTASection({
  title,
  subtitle,
  primaryButtonText,
  primaryButtonHref,
  secondaryButtonText,
  secondaryButtonHref,
}: CTASectionProps) {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background with dark aesthetic */}
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 mix-blend-overlay" />
      
      {/* Decorative blurs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      
      <Container className="relative z-10 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight font-heading">
          {title}
        </h2>
        <p className="text-lg md:text-xl text-indigo-100/80 max-w-2xl mx-auto mb-10 leading-relaxed">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button variant="primary" size="lg" className="w-full sm:w-auto bg-white text-slate-900 hover:bg-slate-50 shadow-lg shadow-white/10" href={primaryButtonHref}>
            {primaryButtonText}
          </Button>
          {secondaryButtonText && secondaryButtonHref && (
            <Button variant="outline" size="lg" className="w-full sm:w-auto text-white border-white/20 hover:bg-white/10" href={secondaryButtonHref}>
              {secondaryButtonText}
            </Button>
          )}
        </div>
      </Container>
    </section>
  );
}
