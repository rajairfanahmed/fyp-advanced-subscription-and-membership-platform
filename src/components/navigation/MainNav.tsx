"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import {
  LogOut, User, LayoutDashboard, BookOpen, CreditCard, Bell,
  Settings, BarChart3, DollarSign, ShieldCheck, Users
} from "lucide-react";

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/content-preview", label: "Content" },
  { href: "/creators", label: "Creators" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
];

// Identity payload returned by /api/auth/me. Admin is server-decided from
// ADMIN_EMAILS, never inferred from client-visible Clerk metadata.
type AuthMeUser = {
  id: string;
  email: string;
  role: "subscriber" | "creator";
  isAdmin: boolean;
  displayName: string;
  avatarUrl: string;
};

export default function MainNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const [me, setMe] = useState<AuthMeUser | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setMe(null);
      return;
    }

    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: { user: AuthMeUser | null }) => {
        if (!cancelled) setMe(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  // Lock background scroll while the mobile menu is open. Without this the
  // page underneath can move on touch and Lenis (smooth-scroll) hijacks the
  // gesture before the overlay can scroll itself. The overlay opts out of
  // Lenis via `data-lenis-prevent`.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Admin precedence > creator > subscriber, mirroring middleware.
  const isAdmin = me?.isAdmin === true;
  const isCreator = !isAdmin && me?.role === "creator";

  function handleSignOut() {
    setIsOpen(false);
    signOut({ redirectUrl: "/login" });
  }

  // ── Desktop center nav links (max 4 items to prevent overflow) ──
  const getDesktopLinks = () => {
    if (isAdmin) {
      return [
        { href: "/admin", label: "Admin", icon: ShieldCheck },
        { href: "/admin/users", label: "Users", icon: User },
        { href: "/admin/creators", label: "Creators", icon: LayoutDashboard },
        { href: "/admin/notifications", label: "Notifications", icon: Bell },
        { href: "/account", label: "Account", icon: User },
      ];
    }

    if (isCreator) {
      return [
        { href: "/creator", label: "Creator Studio", icon: LayoutDashboard },
        { href: "/creator/content", label: "Content", icon: BookOpen },
        { href: "/creator/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/creator/settings", label: "Settings", icon: Settings },
      ];
    }
    // Subscriber
    return [
      { href: "/library", label: "Library", icon: BookOpen },
      { href: "/creators", label: "Creators", icon: Users },
      { href: "/subscription", label: "Subscription", icon: CreditCard },
      { href: "/billing", label: "Billing", icon: DollarSign },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/account", label: "Account", icon: User },
    ];
  };

  // ── Mobile nav links (can show more items since vertical) ──
  const getMobileLinks = () => {
    if (isAdmin) {
      return [
        { href: "/admin", label: "Admin", icon: ShieldCheck },
        { href: "/admin/users", label: "Users", icon: User },
        { href: "/admin/creators", label: "Creators", icon: LayoutDashboard },
        { href: "/admin/notifications", label: "Notifications", icon: Bell },
        { href: "/account", label: "Account", icon: User },
      ];
    }

    if (isCreator) {
      return [
        { href: "/creator", label: "Creator Studio", icon: LayoutDashboard },
        { href: "/creator/content", label: "Content", icon: BookOpen },
        { href: "/creator/subscribers", label: "Subscribers", icon: User },
        { href: "/creator/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/creator/settings", label: "Settings", icon: Settings },
      ];
    }
    return [
      { href: "/library", label: "Library", icon: BookOpen },
      { href: "/creators", label: "Creators", icon: Users },
      { href: "/subscription", label: "Subscription", icon: CreditCard },
      { href: "/billing", label: "Billing", icon: DollarSign },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/account", label: "Account", icon: User },
    ];
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 glass-panel border-x-0 border-t-0 rounded-none mix-blend-normal">
        <Link href="/" className="relative z-50 flex items-center gap-2 group">
          <svg className="w-8 h-8 group-hover:scale-105 transition-transform" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="url(#nexora-gradient)" />
            <path d="M10 22V10L22 22V10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="nexora-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="var(--color-emerald)" />
                <stop offset="1" stopColor="var(--color-sky)" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-display font-bold text-xl text-[var(--color-ink)] tracking-tight">Nexora</span>
        </Link>

        {/* Desktop Center Links */}
        <nav className="hidden md:flex items-center gap-5 absolute left-1/2 -translate-x-1/2">
          {(!isLoaded || !isSignedIn) ? (
            PUBLIC_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
              >
                {link.label}
              </Link>
            ))
          ) : (
            getDesktopLinks().map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-bold text-slate-600 hover:text-[var(--color-ink)] transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            ))
          )}
        </nav>

        {/* Desktop Right Actions */}
        <div className="hidden md:flex items-center gap-3">
          {(!isLoaded || !isSignedIn) ? (
            <>
              <Button variant="ghost" size="sm" href="/login">
                Log In
              </Button>
              <Button variant="primary" size="sm" href="/sign-up">
                Start Free
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/account"
                className="flex items-center gap-2 px-1 rounded-xl hover:bg-slate-50 transition-colors group"
                aria-label="Open account settings"
                title={me?.displayName || me?.email || "Signed in"}
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-sky-400 ring-2 ring-white shadow-sm overflow-hidden flex items-center justify-center text-white text-xs font-black">
                  {me?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={me.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (me?.displayName || me?.email || "U").charAt(0).toUpperCase()
                  )}
                </span>
                <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 max-w-[120px] truncate">
                  {isAdmin ? "Admin" : isCreator ? "Creator" : "Member"}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden />
                Sign Out
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="relative z-50 md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 focus-visible:outline-none"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Menu"
        >
          <span className={`w-6 h-0.5 bg-[var(--color-ink)] transition-transform duration-300 ${isOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`w-6 h-0.5 bg-[var(--color-ink)] transition-opacity duration-300 ${isOpen ? "opacity-0" : ""}`} />
          <span className={`w-6 h-0.5 bg-[var(--color-ink)] transition-transform duration-300 ${isOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            data-lenis-prevent
            // z-40 puts the drawer above sticky page chrome (filter
            // bars, table headers — those sit at z-30) but still
            // below the header (z-50) so the close button remains
            // tappable. Background is fully opaque so library
            // sections never bleed through in mobile view.
            className="fixed inset-0 z-40 bg-[var(--color-paper)] flex flex-col pt-24 px-6 pb-10 overflow-y-auto overscroll-contain [touch-action:pan-y] [-webkit-overflow-scrolling:touch]"
          >
            <nav className="flex flex-col gap-5">
              {(!isLoaded || !isSignedIn) ? (
                PUBLIC_LINKS.map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="font-display font-bold text-3xl text-[var(--color-ink)] hover:text-[var(--color-emerald)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))
              ) : (
                getMobileLinks().map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="font-display font-bold text-2xl text-[var(--color-ink)] hover:text-[var(--color-emerald)] transition-colors flex items-center gap-3"
                    >
                      <link.icon className="w-5 h-5" />
                      {link.label}
                    </Link>
                  </motion.div>
                ))
              )}
            </nav>
            <div className="mt-auto flex flex-col gap-4 pt-6">
              {(!isLoaded || !isSignedIn) ? (
                <>
                  <Button variant="outline" href="/login" onClick={() => setIsOpen(false)}>Log In</Button>
                  <Button variant="primary" href="/sign-up" onClick={() => setIsOpen(false)}>Start Free</Button>
                </>
              ) : (
                <>
                  <div className="pt-4 border-t border-slate-200/80">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Signed in as</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{me?.displayName || me?.email || "Account"}</p>
                    <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                      {isAdmin ? "Admin" : isCreator ? "Creator" : "Member"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold text-red-600 bg-red-50 border-2 border-red-200 rounded-2xl hover:bg-red-100 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                  >
                    <LogOut className="w-4 h-4" aria-hidden />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
