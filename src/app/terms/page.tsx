"use client";

import React, { useState, useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FileText, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Static Data ---
const TERMS_SECTIONS = [
  {
    id: "overview",
    title: "1. Overview",
    content: "These terms govern the use of Nexora for all digital creators, educators, and subscribers. By accessing the platform, you agree to comply with these foundational terms and understand that this is a premium managed membership environment.",
  },
  {
    id: "account-responsibilities",
    title: "2. Account Responsibilities",
    content: "Users must maintain the security of their accounts and passwords. Nexora is not responsible for unauthorized access resulting from user negligence. Creators are responsible for the content they publish and must ensure they hold appropriate rights.",
  },
  {
    id: "creator-content",
    title: "3. Creator Content",
    content: "Creators retain full ownership of the videos, articles, PDFs, ZIP files, and templates they upload. Nexora acts purely as the hosting and access management infrastructure. Content must comply with our community guidelines and not violate any laws.",
  },
  {
    id: "subscriber-access",
    title: "4. Subscriber Access",
    content: "Subscribers receive access to specific content exclusively based on their active subscription plan (e.g., Free, Basic, or Premium). Access is revoked automatically if a subscription expires, fails to renew, or is cancelled.",
  },
  {
    id: "subscription-plans",
    title: "5. Subscription Plans",
    content: "Creators have the right to define the pricing, billing frequency, and specific content assigned to their subscription tiers. Nexora reserves the right to modify platform-level features included in these tiers with prior notice.",
  },
  {
    id: "payments-and-renewals",
    title: "6. Payments And Renewals",
    content: "All payments are processed securely via our payment partners (Stripe). Subscription fees are billed on a recurring basis. It is the subscriber's responsibility to ensure payment methods are valid to avoid uninterrupted access.",
  },
  {
    id: "cancellations",
    title: "7. Cancellations",
    content: "Subscribers may cancel their recurring plans at any time through their account dashboard. Access will remain active until the end of the current billing cycle. Creators can also cancel or pause their membership offerings.",
  },
  {
    id: "restricted-use",
    title: "8. Restricted Use",
    content: "Users may not reverse engineer the platform, distribute malware, scrape content, or use Nexora for illegal purposes. Violation of these restricted uses will result in immediate permanent account termination without refund.",
  },
  {
    id: "platform-changes",
    title: "9. Platform Changes",
    content: "We continuously improve Nexora and may modify or discontinue features, tools, or analytics over time. We will provide reasonable advance notice for any major changes that impact creator revenue or subscriber access.",
  },
  {
    id: "contact",
    title: "10. Contact",
    content: "If you have questions about these Terms of Service, your subscription, or platform policies, please reach out via our official support channels or the contact page for timely assistance.",
  },
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  // Simple scroll spy logic
  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = TERMS_SECTIONS.map(s => document.getElementById(s.id));
      const scrollPosition = window.scrollY + 200; // Offset

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const el = sectionElements[i];
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(TERMS_SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-48 bg-[var(--color-paper)]">
      
      {/* ── 1. Terms Hero ── */}
      <section className="relative mb-24">
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-[60vw] h-[60vw] bg-sky-400/10 rounded-full blur-[140px] opacity-50 -z-10 pointer-events-none" />
        
        <Container className="relative z-10 max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="flex flex-wrap gap-3 mb-6">
              <Badge variant="sky">Platform Use</Badge>
              <Badge variant="emerald">Subscriptions</Badge>
              <Badge variant="default">Content Access</Badge>
            </MotionItem>

            <MotionItem>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.05] mb-6">
                Terms Of <span className="text-gradient-primary">Service</span>
              </h1>
            </MotionItem>

            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] leading-relaxed font-medium max-w-2xl">
                Clear usage terms for creators, subscribers, and platform users using Nexora. Last updated: September 2026.
              </p>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      {/* ── 2. Terms Content Layout ── */}
      <section className="mb-32 relative z-20">
        <Container>
          <div className="grid lg:grid-cols-4 gap-12 lg:gap-16 items-start">
            
            {/* Left Col: Section Index */}
            <MotionReveal className="hidden lg:block lg:col-span-1">
              <div className="sticky top-32 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6 pb-6 border-b border-slate-100">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-[var(--color-ink)]">Index</h3>
                </div>
                <nav className="flex flex-col gap-2">
                  {TERMS_SECTIONS.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      onClick={(e) => scrollToSection(e, section.id)}
                      className={cn(
                        "text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200",
                        activeSection === section.id
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-500 hover:text-[var(--color-ink)] hover:bg-slate-50"
                      )}
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </MotionReveal>

            {/* Right Col: Legal Content */}
            <div className="lg:col-span-3 space-y-12 lg:space-y-16">
              
              {/* ── 3. Important Notice Card ── */}
              <MotionReveal>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4 items-start shadow-sm mb-8">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 mb-2">Legal Review Required</h4>
                    <p className="text-amber-800 text-sm font-medium leading-relaxed">
                      This page contains placeholder terms for product development. Final legal text should be reviewed before production launch. Do not consider this actual legal advice.
                    </p>
                  </div>
                </div>
              </MotionReveal>

              {/* Sections */}
              <MotionReveal className="space-y-12 lg:space-y-16" staggerChildren={0.1}>
                {TERMS_SECTIONS.map((section, i) => (
                  <MotionItem key={i} id={section.id} className="scroll-mt-32">
                    <h2 className="text-2xl font-black font-display text-[var(--color-ink)] mb-4">
                      {section.title}
                    </h2>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      {section.content}
                    </p>
                  </MotionItem>
                ))}
              </MotionReveal>
            </div>

          </div>
        </Container>
      </section>

      {/* ── 4. Final CTA ── */}
      <section className="py-32 relative overflow-hidden bg-white border-t border-[var(--color-border)]">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[40vw] h-[40vw] bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem>
              <h2 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-8 tracking-tight leading-[1.05]">
                Need Help Understanding The <span className="text-gradient-primary">Platform Terms?</span>
              </h2>
            </MotionItem>
            <MotionItem className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10">
              <Button variant="primary" size="lg" href="/contact" className="w-full sm:w-auto min-w-[200px]">
                Contact Support
              </Button>
              <Button variant="secondary" size="lg" href="/privacy" className="w-full sm:w-auto min-w-[200px]">
                View Privacy Policy
              </Button>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

    </div>
  );
}
