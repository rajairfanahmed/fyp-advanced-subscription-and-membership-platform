"use client";

import React, { useState } from "react";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  UserCircle, CreditCard, LockKeyhole, FolderLock, 
  Settings2, ShieldCheck, ChevronDown,
  HelpCircle, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// --- Static Data ---
const CATEGORIES = [
  {
    icon: <UserCircle className="w-6 h-6 text-emerald-500" />,
    title: "Account Access",
    description: "Help with login, sign up, password recovery, and email verification.",
  },
  {
    icon: <LockKeyhole className="w-6 h-6 text-sky-500" />,
    title: "Subscription Plans",
    description: "Understand Free, Basic, and Premium plans, upgrades, and cancellations.",
  },
  {
    icon: <CreditCard className="w-6 h-6 text-violet-500" />,
    title: "Billing And Payments",
    description: "Help with Stripe billing, failed payments, invoices, renewals, and payment status.",
  },
  {
    icon: <FolderLock className="w-6 h-6 text-amber-500" />,
    title: "Content Access",
    description: "Understand locked content, plan access, videos, articles, PDF files, and ZIP downloads.",
  },
  {
    icon: <Settings2 className="w-6 h-6 text-rose-500" />,
    title: "Creator Tools",
    description: "Support for publishing content, managing subscribers, setting plan access, and viewing revenue.",
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-slate-500" />,
    title: "Admin Controls",
    description: "Help with platform users, creators, subscribers, payments, notifications, and analytics.",
  },
];

const FAQS = [
  {
    question: "Why is content locked?",
    answer: "Content is locked when the subscriber does not have the required plan. Locked content should show which plan is needed.",
  },
  {
    question: "Can subscribers access videos and files?",
    answer: "Yes. Advanced Subscription & Membership Platform supports video content, articles, PDF files, ZIP files, templates, and private resources.",
  },
  {
    question: "Will Stripe handle payments?",
    answer: "Yes. Stripe is live for recurring billing: checkout, the billing portal, invoices, refunds, and webhook-driven membership status.",
  },
  {
    question: "Can creators publish different content types?",
    answer: "Yes. Creators can publish videos, articles, PDFs, ZIP files, templates, and private resources.",
  },
  {
    question: "Do subscribers get a dashboard?",
    answer: "Subscribers use a clean content library, subscription page, billing page, account page, and notifications page. Creators and admins use dashboards.",
  },
  {
    question: "Can creators track engagement?",
    answer: "Yes. Creators can track active subscribers, revenue, cancellations, content views, and engagement from their analytics, revenue, and subscribers dashboards.",
  },
  {
    question: "Can admins manage the whole platform?",
    answer: "Yes. Admins can manage users, creators, subscribers, plans, content, subscriptions, payments, notifications, and analytics.",
  },
  {
    question: "Can plans be upgraded?",
    answer: "Yes. Open a creator's profile and Subscribe to Basic or Premium. Follow free only unlocks that creator's Free content. There is no in-place downgrade — cancel at period end, then Subscribe to a lower tier if you still want access. Paid cancellations keep access until the billing period ends.",
  },
];

const WORKFLOW = [
  "Choose the area you need help with.",
  "Review the matching help topic.",
  "Contact support if the answer is not enough.",
  "Track updates through account notifications.",
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:bg-slate-50 rounded-xl px-2 -mx-2 transition-colors"
      >
        <h4 className="text-lg font-bold font-display text-[var(--color-ink)]">{question}</h4>
        <div className={cn("shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 transition-transform duration-300", isOpen && "rotate-180 bg-emerald-50 text-emerald-500")}>
          <ChevronDown className="w-5 h-5" />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden px-2"
          >
            <p className="pb-6 text-[var(--color-muted)] leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SupportPage() {
  const scrollToFaq = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const el = document.getElementById("faq");
    if (el) {
      window.scrollTo({ top: el.offsetTop - 100, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-48 bg-[var(--color-paper)]">
      
      {/* ── 1. Support Hero ── */}
      <section className="relative mb-24">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] bg-emerald-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="flex flex-wrap justify-center gap-3 mb-6">
              <Badge variant="default">Account Help</Badge>
              <Badge variant="emerald">Billing Support</Badge>
              <Badge variant="sky">Content Access</Badge>
            </MotionItem>

            <MotionItem>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.05] mb-6">
                Get Help With Your <span className="text-gradient-primary">Membership Platform</span>
              </h1>
            </MotionItem>

            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] mb-10 leading-relaxed font-medium max-w-2xl mx-auto">
                Find answers for subscription plans, locked content, billing, creator tools, account access, and platform setup.
              </p>
            </MotionItem>

            <MotionItem className="flex flex-col sm:flex-row justify-center gap-4">
              <Button variant="primary" size="lg" href="#faq" onClick={scrollToFaq} className="w-full sm:w-auto min-w-[200px]">
                Browse FAQs
              </Button>
              <Button variant="secondary" size="lg" href="/contact" className="w-full sm:w-auto min-w-[200px]">
                Contact Support
              </Button>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      {/* ── 2. Support Categories ── */}
      <section className="mb-32 relative z-20">
        <Container>
          <MotionReveal className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" staggerChildren={0.1}>
            {CATEGORIES.map((category, i) => (
              <MotionItem key={i}>
                <button
                  type="button"
                  onClick={scrollToFaq}
                  className="w-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 p-8 flex flex-col group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                    {category.icon}
                  </div>
                  <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-3">{category.title}</h3>
                  <p className="text-[var(--color-muted)] font-medium leading-relaxed mb-6 flex-1">
                    {category.description}
                  </p>
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm group-hover:gap-3 transition-all">
                    Browse topics <ArrowRightIcon className="w-4 h-4" />
                  </div>
                </button>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 3. FAQ Section ── */}
      <section id="faq" className="py-24 bg-white border-y border-[var(--color-border)]">
        <Container className="max-w-4xl">
          <MotionReveal className="text-center mb-16">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)]">Frequently Asked Questions</h2>
          </MotionReveal>
          
          <MotionReveal className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-8">
            {FAQS.map((faq, i) => (
              <MotionItem key={i}>
                <FAQItem question={faq.question} answer={faq.answer} />
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 4. Support Workflow Section ── */}
      <section className="py-24 bg-[var(--color-paper)]">
        <Container>
          <MotionReveal className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)] mb-4">How Support Works</h2>
            <p className="text-lg text-[var(--color-muted)]">We aim to resolve your questions as quickly as possible through a simple, structured process.</p>
          </MotionReveal>

          <MotionReveal className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" staggerChildren={0.1}>
            {WORKFLOW.map((step, i) => (
              <MotionItem key={i} className="glass-panel p-8 relative overflow-hidden group">
                <div className="text-6xl font-black font-display text-slate-100 absolute -top-4 -right-2 z-0 group-hover:scale-110 transition-transform duration-500">
                  {i + 1}
                </div>
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-6 text-[var(--color-ink)] font-bold">
                    {i + 1}
                  </div>
                  <p className="font-bold text-[var(--color-ink)] text-lg leading-snug">{step}</p>
                </div>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 5. Support CTA ── */}
      <section className="py-32 relative overflow-hidden bg-white border-t border-[var(--color-border)]">
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[40vw] h-[40vw] bg-sky-400/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Container className="relative z-10 text-center max-w-3xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="w-20 h-20 rounded-3xl bg-slate-50 border border-slate-100 shadow-sm flex items-center justify-center mx-auto mb-8">
              <MessageSquare className="w-10 h-10 text-sky-500" />
            </MotionItem>
            <MotionItem>
              <h2 className="text-4xl md:text-5xl font-black font-display text-[var(--color-ink)] mb-6 tracking-tight">
                Still Need Help?
              </h2>
            </MotionItem>
            <MotionItem>
              <p className="text-xl text-[var(--color-muted)] mx-auto mb-10 leading-relaxed font-medium">
                Contact the Advanced Subscription & Membership Platform team with your account, billing, subscription, or content access question.
              </p>
            </MotionItem>
            <MotionItem>
              <Button variant="primary" size="lg" href="/contact" className="min-w-[200px]">
                Contact Support
              </Button>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

    </div>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
