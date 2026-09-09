"use client";

import React, { useState } from "react";
import { Container } from "@/components/layout/Container";
import { MotionReveal, MotionItem } from "@/components/ui/MotionReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Send, CreditCard, LayoutDashboard, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2
} from "lucide-react";

// --- Static Data ---
const CONTACT_CARDS = [
  {
    icon: <CreditCard className="w-6 h-6 text-emerald-500" />,
    title: "Billing Questions",
    description: "Questions about Stripe billing, renewals, failed payments, invoices, and subscription status.",
  },
  {
    icon: <LayoutDashboard className="w-6 h-6 text-sky-500" />,
    title: "Creator Setup",
    description: "Questions about publishing content, setting access rules, creating plans, and running paid checkout and subscriptions.",
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-violet-500" />,
    title: "Platform Support",
    description: "Questions about account access, content library behaviour, locked content, and admin management.",
  },
];

const TIPS = [
  "Your account email.",
  "Your role on the platform.",
  "The page or feature involved.",
  "A short description of the issue.",
];

type FormStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success" };

export default function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ kind: "submitting" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, email, role, topic, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "We couldn't deliver your message. Please try again.");
      }
      setStatus({ kind: "success" });
      setFullName("");
      setEmail("");
      setRole("");
      setTopic("");
      setMessage("");
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error ? err.message : "We couldn't deliver your message. Please try again.",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-48 bg-[var(--color-paper)]">
      
      {/* ── 1. Contact Hero ── */}
      <section className="relative mb-24">
        <div className="absolute top-0 right-1/4 w-[60vw] h-[60vw] bg-sky-400/10 rounded-full blur-[140px] opacity-60 -z-10 pointer-events-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem className="flex flex-wrap justify-center gap-3 mb-6">
              <Badge variant="emerald">Creator Support</Badge>
              <Badge variant="sky">Billing Questions</Badge>
              <Badge variant="default">Platform Help</Badge>
            </MotionItem>

            <MotionItem>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black font-display tracking-tight text-[var(--color-ink)] leading-[1.05] mb-6">
                Contact The <span className="text-gradient-primary">Advanced Subscription & Membership Platform Team</span>
              </h1>
            </MotionItem>

            <MotionItem>
              <p className="text-lg md:text-xl text-[var(--color-muted)] leading-relaxed font-medium max-w-2xl mx-auto">
                Send a question about subscription setup, content access, billing, creator tools, or platform management.
              </p>
            </MotionItem>
          </MotionReveal>
        </Container>
      </section>

      {/* ── 2. Form & Cards Split Layout ── */}
      <section className="mb-32 relative z-20">
        <Container>
          <div className="grid lg:grid-cols-5 gap-12 items-start">
            
            {/* Left Col: Contact Form UI */}
            <MotionReveal className="lg:col-span-3">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8 md:p-12 relative overflow-hidden">
                {/* Decorative glowing edge */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-sky-400" />
                
                <h2 className="text-2xl font-black font-display text-[var(--color-ink)] mb-8">Send us a message</h2>

                {status.kind === "success" && (
                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                    <p>
                      Thanks — your message is on its way. We&apos;ll reply to your email shortly.
                    </p>
                  </div>
                )}

                {status.kind === "error" && (
                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <p>{status.message}</p>
                  </div>
                )}

                <form className="space-y-6" onSubmit={handleFormSubmit}>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700" htmlFor="contact-name">Full Name</label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700" htmlFor="contact-email">Email Address</label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700" htmlFor="contact-role">Your Role</label>
                      <select
                        id="contact-role"
                        required
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-[var(--color-ink)] appearance-none cursor-pointer"
                      >
                        <option value="" disabled>Select a role...</option>
                        <option value="Visitor">Visitor</option>
                        <option value="Subscriber">Subscriber</option>
                        <option value="Creator">Creator</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700" htmlFor="contact-topic">Support Topic</label>
                      <select
                        id="contact-topic"
                        required
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-[var(--color-ink)] appearance-none cursor-pointer"
                      >
                        <option value="" disabled>Select a topic...</option>
                        <option value="Account Access">Account Access</option>
                        <option value="Billing">Billing</option>
                        <option value="Subscription Plans">Subscription Plans</option>
                        <option value="Content Access">Content Access</option>
                        <option value="Creator Tools">Creator Tools</option>
                        <option value="Admin Controls">Admin Controls</option>
                        <option value="General Question">General Question</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700" htmlFor="contact-message">Message</label>
                    <textarea
                      id="contact-message"
                      rows={5}
                      required
                      minLength={10}
                      maxLength={2000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help you today?"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={status.kind === "submitting"}
                    className="w-full sm:w-auto mt-4"
                    icon={
                      status.kind === "submitting" ? (
                        <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 ml-1" />
                      )
                    }
                  >
                    {status.kind === "submitting" ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </div>
            </MotionReveal>

            {/* Right Col: Contact Cards & Expectations */}
            <div className="lg:col-span-2 space-y-8">
              {/* ── 3. Contact Cards ── */}
              <MotionReveal className="space-y-4" staggerChildren={0.1}>
                {CONTACT_CARDS.map((card, i) => (
                  <MotionItem key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex gap-4 hover:-translate-y-1 transition-transform duration-300">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                      {card.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--color-ink)] mb-1">{card.title}</h3>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">{card.description}</p>
                    </div>
                  </MotionItem>
                ))}
              </MotionReveal>

              {/* ── 4. Response Expectation ── */}
              <MotionReveal>
                <div className="bg-[var(--color-ink)] text-white rounded-2xl p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/20 rounded-full blur-2xl" />
                  
                  <h3 className="text-xl font-bold font-display mb-6 relative z-10">What To Include In Your Message</h3>
                  <ul className="space-y-4 relative z-10">
                    {TIPS.map((tip, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span className="text-slate-300 font-medium text-sm">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </MotionReveal>
            </div>

          </div>
        </Container>
      </section>

      {/* ── 5. Final CTA ── */}
      <section className="py-32 relative overflow-hidden bg-white border-t border-[var(--color-border)]">
        <div className="absolute top-0 left-1/4 w-[40vw] h-[40vw] bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Container className="relative z-10 text-center max-w-4xl">
          <MotionReveal staggerChildren={0.1}>
            <MotionItem>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black font-display text-[var(--color-ink)] mb-8 tracking-tight leading-[1.05]">
                Building A Membership Platform Should <span className="text-gradient-primary">Feel Clear</span>
              </h2>
            </MotionItem>
            <MotionItem>
              <p className="text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
                Advanced Subscription & Membership Platform keeps creator revenue, subscriber access, and platform management structured from the first version.
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
