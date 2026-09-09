"use client";

import React, { useState, useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Shield, CreditCard, Eye, FileText, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Static Data ---
const PRIVACY_SECTIONS = [
  {
    id: "overview",
    title: "1. Overview",
    content: "Advanced Subscription & Membership Platform is committed to protecting the privacy of creators, subscribers, and all platform visitors. This Privacy Policy explains how we collect, use, and safeguard personal information across our membership infrastructure.",
  },
  {
    id: "information-we-collect",
    title: "2. Information We Collect",
    content: "We collect information necessary to provide subscription services. This includes account credentials, profile details, and behavioral data required to deliver locked content securely.",
  },
  {
    id: "account-information",
    title: "3. Account Information",
    content: "When registering as a creator or subscriber, we store your name, email address, and encrypted password. This data is used solely for authentication and necessary platform communication.",
  },
  {
    id: "subscription-billing",
    title: "4. Subscription And Billing Data",
    content: "Advanced Subscription & Membership Platform uses secure third-party payment processors (Stripe). We do not store raw credit card numbers. We only retain subscription status, plan levels, billing history, and renewal dates to manage content access.",
  },
  {
    id: "content-access",
    title: "5. Content Access Activity",
    content: "We track which videos, articles, PDFs, and ZIP files subscribers access. This ensures that content locks are enforced properly and provides creators with aggregate metrics on content performance.",
  },
  {
    id: "creator-analytics",
    title: "6. Creator Analytics",
    content: "Creators have access to aggregated analytics regarding subscriber engagement and revenue. This data is anonymized where appropriate to protect individual subscriber privacy while helping creators improve their offerings.",
  },
  {
    id: "cookies-usage",
    title: "7. Cookies And Product Usage",
    content: "We use essential cookies to maintain your login session and remember your preferences. We also collect anonymized product usage data to identify bugs and improve the overall Advanced Subscription & Membership Platform platform experience.",
  },
  {
    id: "data-security",
    title: "8. Data Security",
    content: "We implement industry-standard encryption and security protocols to protect your data against unauthorized access, alteration, disclosure, or destruction.",
  },
  {
    id: "data-retention",
    title: "9. Data Retention",
    content: "We retain your personal information only for as long as necessary to fulfill the purposes outlined in this policy. When you delete your account, your data is securely purged from our active databases.",
  },
  {
    id: "contact",
    title: "10. Contact",
    content: "If you have specific privacy concerns or wish to request a data export or deletion, please reach out to our privacy team via the official support channels.",
  },
];

const PRINCIPLES = [
  {
    icon: <Shield className="w-6 h-6 text-emerald-500" />,
    title: "Clear Data Use",
    description: "Users should understand what data is needed for accounts, subscriptions, billing, and content access.",
  },
  {
    icon: <CreditCard className="w-6 h-6 text-sky-500" />,
    title: "Secure Billing",
    description: "Payment details are handled through Stripe. Advanced Subscription & Membership Platform does not store raw card details.",
  },
  {
    icon: <Eye className="w-6 h-6 text-violet-500" />,
    title: "Access Transparency",
    description: "Subscribers should understand how content access, plan level, and usage activity relate to their account.",
  },
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = PRIVACY_SECTIONS.map(s => document.getElementById(s.id));
      const scrollPosition = window.scrollY + 200;

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const el = sectionElements[i];
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(PRIVACY_SECTIONS[i].id);
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
      
      {/* ── 1. Privacy Hero ── */}
      <section className="relative mb-24">
        <div className="absolute top-0 right-0 translate-x-1/4 w-[60vw] h-[60vw] bg-emerald-400/10 rounded-full blur-[140px] opacity-50 -z-10 pointer-events-none" />
        
        <Container className="relative z-10 max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="flex flex-wrap gap-3 mb-6">
              <Badge variant="emerald">Account Data</Badge>
              <Badge variant="sky">Billing Records</Badge>
              <Badge variant="default">Usage Activity</Badge>
            </MotionItem>

            <MotionItem>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.05] mb-6">
                Privacy <span className="text-gradient-primary">Policy</span>
              </h1>
            </MotionItem>

            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] leading-relaxed font-medium max-w-2xl">
                How Advanced Subscription & Membership Platform handles account data, subscription data, content access data, and platform usage data.
              </p>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      {/* ── 3. Privacy Principle Cards ── */}
      <section className="mb-24 relative z-20">
        <Container>
          <MotionReveal className="grid md:grid-cols-3 gap-6" staggerChildren={0.1}>
            {PRINCIPLES.map((principle, i) => (
              <MotionItem key={i} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 hover:shadow-lg transition-shadow duration-300">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6">
                  {principle.icon}
                </div>
                <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-3">{principle.title}</h3>
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  {principle.description}
                </p>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 2. Privacy Content Layout ── */}
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
                  {PRIVACY_SECTIONS.map((section) => (
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
              
              {/* ── 4. Important Notice Card ── */}
              <MotionReveal>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4 items-start shadow-sm mb-8">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-2">About this policy</h4>
                    <p className="text-slate-700 text-sm font-medium leading-relaxed">
                      This policy describes how Advanced Subscription & Membership Platform uses Clerk for accounts, Stripe for billing, and stored membership data to enforce content access. It is product documentation, not legal advice.
                    </p>
                  </div>
                </div>
              </MotionReveal>

              {/* Sections */}
              <MotionReveal className="space-y-12 lg:space-y-16" staggerChildren={0.1}>
                {PRIVACY_SECTIONS.map((section, i) => (
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

      {/* ── 5. Final CTA ── */}
      <section className="py-32 relative overflow-hidden bg-white border-t border-[var(--color-border)]">
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[40vw] h-[40vw] bg-sky-400/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem>
              <h2 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-8 tracking-tight leading-[1.05]">
                Questions About Privacy Or <span className="text-gradient-primary">Account Data?</span>
              </h2>
            </MotionItem>
            <MotionItem className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10">
              <Button variant="primary" size="lg" href="/contact" className="w-full sm:w-auto min-w-[200px]">
                Contact Support
              </Button>
              <Button variant="secondary" size="lg" href="/terms" className="w-full sm:w-auto min-w-[200px]">
                View Terms
              </Button>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

    </div>
  );
}
