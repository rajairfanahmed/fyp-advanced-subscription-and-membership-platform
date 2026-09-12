"use client";

import React from "react";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  CreditCard, FolderLock, BellOff, LineChart, 
  Layers, LockKeyhole, UserCog, Settings,
  Video, BookOpen, Building2, Users2,
  CheckCircle2,
  Eye, User, LayoutDashboard, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Static Data ---
const PROBLEMS = [
  { icon: <CreditCard className="w-5 h-5" />, title: "Manual payment tracking." },
  { icon: <FolderLock className="w-5 h-5" />, title: "Unclear content access." },
  { icon: <BellOff className="w-5 h-5" />, title: "Missed billing notices." },
  { icon: <LineChart className="w-5 h-5" />, title: "Poor engagement visibility." },
];

const SOLUTIONS = [
  {
    icon: <Layers className="w-6 h-6 text-emerald-500" />,
    title: "Subscription plans for Free, Basic, and Premium access.",
  },
  {
    icon: <LockKeyhole className="w-6 h-6 text-sky-500" />,
    title: "Locked content rules for videos, articles, and PDF, ZIP, or RAR files.",
  },
  {
    icon: <UserCog className="w-6 h-6 text-violet-500" />,
    title: "Creator tools for subscribers, revenue, and engagement tracking.",
  },
  {
    icon: <Settings className="w-6 h-6 text-slate-500" />,
    title: "Admin controls for users, subscriptions, payments, and platform health.",
  },
];

const AUDIENCES = [
  {
    icon: <Video className="w-6 h-6 text-emerald-500" />,
    title: "Digital Creators",
    description: "Creators selling premium videos, articles, and downloadable files.",
  },
  {
    icon: <BookOpen className="w-6 h-6 text-sky-500" />,
    title: "Educators",
    description: "Teachers, coaches, and course creators offering structured learning content.",
  },
  {
    icon: <Building2 className="w-6 h-6 text-violet-500" />,
    title: "Content Businesses",
    description: "Small content teams turning expertise into recurring subscription products.",
  },
  {
    icon: <Users2 className="w-6 h-6 text-amber-500" />,
    title: "Community Led Brands",
    description: "Brands building paid member experiences around exclusive content and resources.",
  },
];

const PRINCIPLES = [
  "Subscribers should know exactly what they can access.",
  "Creators should know which content drives engagement.",
  "Plans should be simple to compare and manage.",
  "Premium content should feel valuable, not confusing.",
  "The platform should stay clean as the business grows.",
];

const ROLES = [
  {
    icon: <Eye className="w-6 h-6 text-[var(--color-ink)]" />,
    title: "Visitor",
    description: "discovers the platform and compares plans.",
    color: "bg-slate-100",
  },
  {
    icon: <User className="w-6 h-6 text-emerald-600" />,
    title: "Subscriber",
    description: "browses content and manages subscription.",
    color: "bg-emerald-50 border-emerald-200",
  },
  {
    icon: <LayoutDashboard className="w-6 h-6 text-sky-600" />,
    title: "Creator",
    description: "publishes content, manages plans, tracks subscribers, and reviews revenue.",
    color: "bg-sky-50 border-sky-200",
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-violet-600" />,
    title: "Admin",
    description: "manages users, creators, content, payments, notifications, and analytics.",
    color: "bg-violet-50 border-violet-200",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-48 bg-[var(--color-paper)]">
      
      {/* ── 1. Hero Section ── */}
      <section className="relative mb-32 overflow-hidden lg:overflow-visible">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-sky-400/10 rounded-full blur-[140px] opacity-60 -z-10" />
        <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-emerald-400/10 rounded-full blur-[100px] opacity-50 -z-10" />
        
        <Container className="relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Hero Text */}
            <MotionReveal staggerChildren={0.1}>
              <MotionItem className="flex flex-wrap gap-3 mb-6">
                <Badge variant="emerald">Built For Creators</Badge>
                <Badge variant="sky">Subscriber Access</Badge>
                <Badge variant="default">Recurring Revenue</Badge>
              </MotionItem>

              <MotionItem>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.05] mb-6">
                  A Membership Platform Built For <span className="text-gradient-primary">Creator Revenue</span>
                </h1>
              </MotionItem>

              <MotionItem>
                <p className="text-lg md:text-xl text-[var(--color-muted)] leading-relaxed font-medium max-w-lg">
                  Advanced Subscription & Membership Platform helps digital creators, educators, and content businesses turn videos, articles, and downloadable files into per-creator subscription experiences.
                </p>
              </MotionItem>
            </MotionReveal>

            {/* Hero Visual: Layered Cards Ecosystem */}
            <MotionReveal className="hidden lg:block relative h-[500px]">
              
              {/* 1. Creator workspace card */}
              <MotionItem 
                className="absolute top-0 left-0 w-64 bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 z-20 hover:-translate-y-2 transition-transform duration-500"
                delay={0.2}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--color-ink)]">Creator Space</div>
                    <div className="text-xs text-slate-500">24 active posts</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-slate-100 rounded-full" />
                  <div className="h-2 w-4/5 bg-slate-100 rounded-full" />
                  <div className="h-2 w-3/5 bg-slate-100 rounded-full" />
                </div>
              </MotionItem>

              {/* 2. Subscriber library card */}
              <MotionItem 
                className="absolute top-32 right-0 w-72 bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 z-30 hover:-translate-y-2 transition-transform duration-500"
                delay={0.4}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-bold text-[var(--color-ink)]">Subscriber Library</div>
                  <Badge variant="sky">Premium</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="aspect-video bg-slate-100 rounded-xl" />
                  <div className="aspect-video bg-slate-100 rounded-xl" />
                  <div className="aspect-video bg-slate-100 rounded-xl" />
                  <div className="aspect-video bg-slate-100 rounded-xl" />
                </div>
              </MotionItem>

              {/* 3. Plan access card */}
              <MotionItem 
                className="absolute bottom-20 left-12 w-64 bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 z-40 hover:-translate-y-2 transition-transform duration-500"
                delay={0.6}
              >
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <LockKeyhole className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--color-ink)]">Basic Access</div>
                    <div className="text-xs text-slate-500">$19 / month</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Articles & PDFs unlocked</span>
                </div>
              </MotionItem>

              {/* 4. Revenue insight card */}
              <MotionItem 
                className="absolute -bottom-10 right-20 w-60 bg-[var(--color-ink)] text-white rounded-3xl border border-slate-800 shadow-2xl p-5 z-50 hover:-translate-y-2 transition-transform duration-500"
                delay={0.8}
              >
                <div className="text-xs text-slate-400 mb-1">Monthly Revenue</div>
                <div className="text-2xl font-bold font-display mb-4">$4,250.00</div>
                <div className="h-16 w-full flex items-end gap-1">
                  {[40, 60, 45, 80, 50, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 bg-emerald-500 rounded-t-sm" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </MotionItem>

            </MotionReveal>
          </div>
        </Container>
      </section>

      {/* ── 2. Problem Section ── */}
      <section className="py-24 bg-white border-y border-[var(--color-border)]">
        <Container>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <MotionReveal>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black font-display text-[var(--color-ink)] leading-[1.1] mb-6">
                Creators Should Not Manage Paid Content Manually
              </h2>
              <p className="text-lg text-[var(--color-muted)] leading-relaxed">
                Manual payments, scattered files, unclear member access, missed billing notices, and weak engagement tracking make paid content harder to scale.
              </p>
            </MotionReveal>

            <MotionReveal className="grid sm:grid-cols-2 gap-4" staggerChildren={0.1}>
              {PROBLEMS.map((prob, i) => (
                <MotionItem key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400">
                    {prob.icon}
                  </div>
                  <h4 className="font-bold text-[var(--color-ink)]">{prob.title}</h4>
                </MotionItem>
              ))}
            </MotionReveal>
          </div>
        </Container>
      </section>

      {/* ── 3. Advanced Subscription & Membership Platform Solution Section ── */}
      <section className="py-32 bg-[var(--color-paper)]">
        <Container>
          <MotionReveal className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black font-display text-[var(--color-ink)] leading-[1.1]">
              Advanced Subscription & Membership Platform Turns Content Into A Managed Membership System
            </h2>
          </MotionReveal>

          <MotionReveal className="grid md:grid-cols-2 gap-8" staggerChildren={0.15}>
            {SOLUTIONS.map((sol, i) => (
              <MotionItem key={i} className="glass-panel p-8 rounded-3xl border border-slate-200 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6">
                  {sol.icon}
                </div>
                <h3 className="text-xl font-bold font-display text-[var(--color-ink)] leading-snug">
                  {sol.title}
                </h3>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 4. Who Advanced Subscription & Membership Platform Is For ── */}
      <section className="py-24 bg-white border-y border-[var(--color-border)]">
        <Container>
          <MotionReveal className="mb-16">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)]">Who uses Advanced Subscription & Membership Platform?</h2>
          </MotionReveal>

          <MotionReveal className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" staggerChildren={0.1}>
            {AUDIENCES.map((aud, i) => (
              <MotionItem key={i} className="p-8 rounded-3xl bg-[var(--color-paper)] border border-slate-100 hover:shadow-lg transition-shadow duration-300">
                <div className="mb-6">{aud.icon}</div>
                <h3 className="text-lg font-bold font-display text-[var(--color-ink)] mb-3">{aud.title}</h3>
                <p className="text-slate-600 font-medium text-sm leading-relaxed">{aud.description}</p>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 5. Product Principles ── */}
      <section className="py-24 bg-[var(--color-paper)]">
        <Container className="max-w-4xl">
          <MotionReveal className="mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)] leading-[1.2]">
              Designed Around Clear Access, Simple Revenue, And Better Content Experience
            </h2>
          </MotionReveal>

          <MotionReveal className="space-y-4" staggerChildren={0.1}>
            {PRINCIPLES.map((principle, i) => (
              <MotionItem key={i} className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </div>
                <p className="font-bold text-[var(--color-ink)] sm:text-lg">{principle}</p>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 6. Role Based Platform Overview ── */}
      <section className="py-24 bg-white border-y border-[var(--color-border)]">
        <Container>
          <MotionReveal className="mb-16">
            <h2 className="text-3xl md:text-4xl font-black font-display text-[var(--color-ink)]">A space for everyone</h2>
            <p className="text-lg text-[var(--color-muted)] mt-2">How different roles interact with Advanced Subscription & Membership Platform.</p>
          </MotionReveal>

          <MotionReveal className="grid md:grid-cols-2 gap-6" staggerChildren={0.1}>
            {ROLES.map((role, i) => (
              <MotionItem key={i} className={cn("p-8 rounded-3xl border transition-all duration-300 hover:shadow-md", role.color)}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    {role.icon}
                  </div>
                  <h3 className="text-xl font-bold font-display text-[var(--color-ink)]">{role.title}</h3>
                </div>
                <p className="text-slate-700 font-medium leading-relaxed">
                  <span className="font-bold text-[var(--color-ink)] capitalize">{role.title}</span> {role.description}
                </p>
              </MotionItem>
            ))}
          </MotionReveal>
        </Container>
      </section>

      {/* ── 7. Final Call to Action ── */}
      <section className="py-32 relative overflow-hidden bg-[var(--color-paper)]">
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 w-[50vw] h-[50vw] bg-sky-400/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[40vw] h-[40vw] bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black font-display text-[var(--color-ink)] mb-8 tracking-tight leading-[1.05]">
                Build A Paid Content System That Feels <span className="text-gradient-primary">Professional From Day One</span>
              </h2>
            </MotionItem>
            <MotionItem>
              <p className="text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
                Start with a clear membership structure, then grow into subscription billing, content access, and creator analytics.
              </p>
            </MotionItem>
            <MotionItem className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button variant="primary" size="lg" href="/pricing" className="w-full sm:w-auto min-w-[200px]">
                View Pricing
              </Button>
              <Button variant="secondary" size="lg" href="/content-preview" className="w-full sm:w-auto min-w-[200px]">
                Preview Content
              </Button>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

    </div>
  );
}
