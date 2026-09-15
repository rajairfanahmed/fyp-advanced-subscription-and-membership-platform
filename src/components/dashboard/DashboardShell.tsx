"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { MotionReveal } from "@/components/ui/MotionReveal";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Video, 
  Users, 
  CreditCard, 
  LineChart, 
  Settings, 
  LogOut, 
  PlaySquare,
  DollarSign,
  ShieldCheck,
  UserSquare2,
  UserCheck,
  Repeat,
  Receipt,
  BellRing,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

interface DashboardShellProps {
  children: React.ReactNode;
  role: "creator" | "admin";
}

const CREATOR_LINKS = [
  { name: "Overview", href: "/creator", icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: "Content", href: "/creator/content", icon: <Video className="w-5 h-5" /> },
  { name: "Subscribers", href: "/creator/subscribers", icon: <Users className="w-5 h-5" /> },
  { name: "Plans", href: "/creator/plans", icon: <CreditCard className="w-5 h-5" /> },
  { name: "Revenue", href: "/creator/revenue", icon: <DollarSign className="w-5 h-5" /> },
  { name: "Analytics", href: "/creator/analytics", icon: <LineChart className="w-5 h-5" /> },
  { name: "Settings", href: "/creator/settings", icon: <Settings className="w-5 h-5" /> },
  { name: "Notifications", href: "/notifications", icon: <BellRing className="w-5 h-5" /> },
];

const ADMIN_LINKS = [
  { name: "Overview", href: "/admin", icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: "Users", href: "/admin/users", icon: <Users className="w-5 h-5" /> },
  { name: "Creators", href: "/admin/creators", icon: <UserSquare2 className="w-5 h-5" /> },
  { name: "Subscribers", href: "/admin/subscribers", icon: <UserCheck className="w-5 h-5" /> },
  { name: "Plans", href: "/admin/plans", icon: <CreditCard className="w-5 h-5" /> },
  { name: "Content", href: "/admin/content", icon: <Video className="w-5 h-5" /> },
  { name: "Subscriptions", href: "/admin/subscriptions", icon: <Repeat className="w-5 h-5" /> },
  { name: "Payments", href: "/admin/payments", icon: <Receipt className="w-5 h-5" /> },
  { name: "Notifications", href: "/admin/notifications", icon: <BellRing className="w-5 h-5" /> },
  { name: "Analytics", href: "/admin/analytics", icon: <BarChart3 className="w-5 h-5" /> },
  { name: "Settings", href: "/admin/settings", icon: <Settings className="w-5 h-5" /> },
];

export function DashboardShell({ children, role }: DashboardShellProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const links = role === "creator" ? CREATOR_LINKS : ADMIN_LINKS;
  const accentColorClass = role === "creator" ? "text-teal-600 bg-teal-50/50 border-teal-100" : "text-violet-600 bg-violet-50/50 border-violet-100";
  const accentTextClass = role === "creator" ? "text-teal-600" : "text-violet-600";
  const brandIconColor = role === "creator" ? "bg-teal-500" : "bg-violet-600";
  const BrandIcon = role === "creator" ? PlaySquare : ShieldCheck;
  const brandLabel = role === "creator" ? "Creator Studio" : "Platform Admin";

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen min-w-0 max-w-full bg-slate-50/30 font-sans selection:bg-teal-100 selection:text-teal-900">
      
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-72 fixed inset-y-0 left-0 bg-white border-r border-slate-200/60 z-50 shadow-[4px_0_24px_rgba(10,17,40,0.02)]">
        {/* Sidebar Header */}
        <div className="p-8 shrink-0">
          <Link href="/" className="flex items-center gap-3 group">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm group-hover:rotate-6", brandIconColor)}>
              <BrandIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black font-display text-slate-900 text-xl tracking-tighter leading-none uppercase">
                {siteConfig.shortName}
              </h1>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5 block opacity-80">
                {brandLabel}
              </span>
            </div>
          </Link>
        </div>

        {/* Sidebar Nav — fixed scroll */}
        <nav data-lenis-prevent className="flex-1 px-4 space-y-1 py-2 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(148,163,184,0.2) transparent" }}>
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/creator" && link.href !== "/admin" && pathname.startsWith(link.href + "/"));
            return (
              <Link 
                key={link.name} 
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-[13px] transition-all duration-300 border border-transparent",
                  isActive 
                    ? cn(accentColorClass, "shadow-[0_2px_8px_rgba(0,0,0,0.02)]") 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span className={cn("transition-colors duration-300", isActive ? accentTextClass : "text-slate-400")}>
                  {link.icon}
                </span>
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer — Sign Out */}
        <div className="p-6 shrink-0 border-t border-slate-100 bg-white">
          <button 
            onClick={() => signOut({ redirectUrl: "/login" })}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-[13px] text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-300 group w-full"
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile Header (same position as homepage navbar) ── */}
      <header data-dashboard className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <Link href="/" className="relative z-50 flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-sm", brandIconColor)}>
            <BrandIcon className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-black font-display text-slate-900 tracking-tighter leading-none uppercase text-sm">
            {siteConfig.shortName}
          </h1>
        </Link>

        {/* Hamburger toggle — same style as homepage MainNav */}
        <button
          className="relative z-50 w-10 h-10 flex flex-col items-center justify-center gap-1.5 focus-visible:outline-none"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Menu"
        >
          <span className={`w-6 h-0.5 bg-slate-900 transition-transform duration-300 ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`w-6 h-0.5 bg-slate-900 transition-opacity duration-300 ${mobileMenuOpen ? "opacity-0" : ""}`} />
          <span className={`w-6 h-0.5 bg-slate-900 transition-transform duration-300 ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </header>

      {/* ── Mobile Full-Screen Overlay (same pattern as homepage) ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            data-lenis-prevent
            className="fixed inset-0 z-40 lg:hidden bg-white/95 backdrop-blur-3xl flex flex-col pt-20 sm:pt-24 px-4 sm:px-6 pb-12 overflow-y-auto"
          >
            {/* Role badge */}
            <div className="mb-6">
              <span className={cn("text-[10px] font-black uppercase tracking-[0.25em] opacity-60", accentTextClass)}>
                {brandLabel}
              </span>
            </div>

            {/* Nav links — large touch-friendly style */}
            <nav className="flex flex-col gap-1 flex-1">
              {links.map((link, i) => {
                return (
                  <motion.div
                    key={link.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.03 }}
                  >
                    <Link 
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-base text-slate-600 active:text-slate-900 active:bg-slate-50 transition-all"
                    >
                      <span className="text-slate-400">
                        {link.icon}
                      </span>
                      {link.name}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* Sign Out at bottom */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pt-6 border-t border-slate-100 mt-6"
            >
              <button 
                onClick={() => { setMobileMenuOpen(false); signOut({ redirectUrl: "/login" }); }}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-base text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all group w-full"
              >
                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Sign Out
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content Wrapper ── */}
      <main className="flex-1 min-w-0 max-w-full lg:ml-72 min-h-screen pt-20 lg:pt-0 relative overflow-x-clip">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-16 w-full min-w-0">
          <MotionReveal className="min-w-0 w-full max-w-full">
            {children}
          </MotionReveal>
        </div>
      </main>
    </div>
  );
}
